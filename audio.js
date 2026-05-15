/* ============================================================
   Ultimate Speed Test — procedural audio engine
   Pure Web Audio synthesis (no sample files). Four sounds:
     1. Ambient drone   — 3-layer cosmic ambience per user spec:
                          sine drone + singing-bowl FM resonance +
                          filtered pink noise air, into long reverb.
     2. Tunnel whoosh   — bandpassed noise, intensity-modulated
     3. Forge complete  — quick harmonic bell with envelope
     4. Medal motion    — bright additive sine partials with FM shimmer,
                          pitch/gain/brightness driven by rotation velocity
                          (lightsaber-style: silent at rest, hum on motion)

   All tunable values live on this.params so audio-tune.js can adjust
   them in real time. For continuous sounds, change → stop → start to apply.
   ============================================================ */
(function () {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) {
    console.warn("[audio] Web Audio API not supported — sound disabled");
    return;
  }

  const DEFAULT_PARAMS = {
    master: 0.35,
    ambient: {
      // ─ master mix (heavier + louder +30%) ─
      gain: 0.29, // +30% vs old 0.22
      attack: 5.0,
      release: 10.0,
      wetMix: 0.7, // a bit wetter — more reverb depth = heavier
      reverbSeconds: 9.0, // longer tail
      reverbDecay: 2.2,
      // Low-shelf boost on the ambient bus for "weight". Hz = corner, gain = dB
      lowShelfHz: 140,
      lowShelfGain: 4, // +4 dB on lows

      // ─ Layer 1: deep sine drone — pitched down for heavier feel ─
      droneGain: 0.58, // was 0.45
      drone1: 36, // was 42 (deeper fundamental)
      drone2: 48, // was 56
      drone3: 62, // was 73
      drone4: 78, // was 88
      droneDetune: 6,
      droneLfoRate: 0.04,
      // Sub-octave drone — purely felt, mostly inaudible, adds weight
      subFreq: 24,
      subGain: 0.22,

      // ─ Layer 2: singing-bowl — slightly less sparkle, more grounded ─
      bowlGain: 0.30, // was 0.28
      bowlA: 174,
      bowlB: 348,
      bowlC: 712,
      bowlD: 1080, // was 1198 (lowered to dial back the brightness)
      bowlPartialGain: 0.18,
      bowlFmRate: 0.7,
      bowlFmDepth: 2.5,
      bowlAttack: 6.0,

      // ─ Layer 3: filtered pink-noise air ─
      airGain: 0.07, // slightly less air so drones dominate
      airCutoff: 5200,
      airCutoffSweep: 1800,
      airSweepRate: 0.03,
    },
    tunnel: {
      // Wormhole traversal — 4-layer hybrid (noise + subtractive + FM + spatial).
      // Each layer responds to "intensity" (0..1) in its own way; together they
      // build into a sense of forward motion through compressed space.
      // No transients, no melody — continuous evolution only.

      // ─ master ─
      outGain: 0.55,
      attack: 1.5, // smooth fade-in (sec)
      release: 1.2, // smooth fade-out

      // ─ Layer 4: Spatial (reverb + stereo) ─
      reverbSeconds: 4.0,
      reverbDecay: 2.4,
      wetMixBase: 0.18, // wet at idle
      wetMixMax: 0.55, // wet at full speed
      panRate: 0.17, // stereo LFO Hz (slow drift)
      panDepthBase: 0.08, // pan width at idle
      panDepthMax: 0.55, // pan width at full speed

      // ─ Layer 1: Particle stream (HP + BP filtered white noise) ─
      // Speed drives both filter brightness AND gain (more, faster particles).
      particleHP: 800,
      particleHPMax: 3200,
      particleBP: 1500,
      particleBPMax: 6000,
      particleQ: 1.4,
      particleGainBase: 0.02,
      particleGainMax: 0.22,

      // ─ Layer 2: Tunnel body (bandpassed pink noise + low-mid oscs) ─
      // Doppler-style pitch rise with speed; filter slow sweep.
      bodyFreqBase: 180, // bandpass center at idle
      bodyFreqMax: 380, // bandpass center at full speed
      bodyQ: 1.4,
      bodyGainBase: 0.06,
      bodyGainMax: 0.16,
      bodyOsc1: 80, // low-mid drone freqs
      bodyOsc2: 124,
      bodyOscGain: 0.08,
      dopplerCents: 220, // upward detune (cents) at full speed

      // ─ Layer 3: Energy compression (FM, slightly inharmonic) ─
      // Soft metallic tension building forward — never aggressive.
      fmCarrier: 440,
      fmRatio: 1.414, // sqrt(2) → inharmonic
      fmDepthBase: 30, // Hz of FM at idle
      fmDepthMax: 320, // Hz at full speed (compresses the spectrum)
      fmGainBase: 0.015,
      fmGainMax: 0.08,
    },
    forge: {
      // 3-stage cinematic forging sound:
      //   Stage 1  charge   — pitch + filter sweep up (Mega Man-style, refined)
      //   Stage 2  release  — radiant filtered-noise + shimmer expansion
      //   Stage 3  metallic — FM bell + resonant inharmonic partials
      // Stages overlap so the listener hears one continuous evolution
      // rather than three disjoint events. Total ~2.6s.

      // ─ master ─
      outGain: 0.5,
      reverbSeconds: 2.6,
      reverbDecay: 2.6,
      wetMix: 0.5,

      // ─ Stage 1: Energy Charging (~0.7s) ─
      chargeTime: 0.7,
      chargeAttack: 0.15, // smooth fade-in, no transient
      chargeStartFreq: 160,
      chargeEndFreq: 540, // rising fundamental (triangle + sine)
      chargeLPStart: 380, // LP filter opens during charge
      chargeLPEnd: 4200,
      chargeLPQ: 4.0, // mild resonance for "energy buildup"
      chargeGain: 0.4,
      chargeVibRate: 7.0, // tension vibrato
      chargeVibDepth: 6.0, // Hz

      // ─ Stage 2: Radiant Release (~0.5s) ─
      releaseOverlap: 0.12, // release begins this many sec before charge ends
      releaseTime: 0.55,
      releaseGain: 0.28,
      releaseBPStart: 1500, // band-pass sweeps outward = "spread"
      releaseBPEnd: 5200,
      releaseBPQ: 1.6,
      releaseHP: 700, // highpass keeps it bright, no low rumble
      // Shimmer layer — 3 sines at metallic intervals on top
      releaseShimmerBase: 1800,
      releaseShimmerGain: 0.14,

      // ─ Stage 3: Metallic Formation (~1.5s tail) ─
      metalDelay: 0.28, // start after release begins
      metalAttack: 0.008, // short but not transient-sharp
      metalDecay: 1.5, // resonance tail
      metalGain: 0.5,
      metalBase: 880, // fundamental of the formed metal
      metalModRatio: 1.41, // sqrt(2) for inharmonic FM partial
      metalModDepth: 80, // Hz of FM (gives the "bright but controlled" tone)
      // 3 additional resonant partials (sine, inharmonic for metal feel)
      metalP1Ratio: 1.0,
      metalP1Gain: 1.0,
      metalP2Ratio: 1.46,
      metalP2Gain: 0.42,
      metalP3Ratio: 2.18,
      metalP3Gain: 0.22,
    },
    medal: {
      // "Pluck" character — short metallic ring per rotation event.
      // Each pluck is an additive sine burst with quick attack and short
      // decay, routed through a small reverb tail so the ring lingers
      // briefly. Triggered (NOT continuous) — driven by velocity events
      // from the medal rotation, throttled to minInterval per pluck.

      // ─ trigger gating ─
      threshold: 0.003, // velocity below this fires no pluck
      sensitivity: 0.05, // velocity normalization divisor → 0..1
      minInterval: 0.07, // seconds between plucks (max ~14 plucks/sec)

      // ─ pitch ─
      basePitch: 880, // slowest pluck pitch (Hz)
      maxPitch: 2200, // fastest pluck pitch
      pitchBend: 0.96, // each pluck bends down to 96% of pitch over decay

      // ─ envelope / output ─
      attack: 0.003,
      decay: 0.45, // fundamental decay (sec)
      outGain: 0.5,
      gainMin: 0.4, // gain scaling at velocity threshold
      gainMax: 1.0, // gain scaling at full velocity

      // ─ partials (sine additive — slightly inharmonic for metallic ring) ─
      p1Ratio: 1.0,
      p1Gain: 1.0,
      p1Decay: 0.45, // bottom rings longest
      p2Ratio: 2.01,
      p2Gain: 0.55,
      p2Decay: 0.32,
      p3Ratio: 3.07,
      p3Gain: 0.35,
      p3Decay: 0.22,
      p4Ratio: 5.13,
      p4Gain: 0.18,
      p4Decay: 0.18, // top sparkle dies fast

      // ─ reverb send (short metallic tail — Sonic ring feel) ─
      reverbSeconds: 1.6,
      reverbDecay: 3.2,
      wetMix: 0.55, // how much of pluck goes to reverb
    },
  };

  // Synthetic reverb IR — exponentially decaying noise burst per channel.
  function makeReverbIR(ctx, seconds, decay) {
    const sr = ctx.sampleRate;
    const len = Math.max(1, Math.floor(sr * seconds));
    const buf = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  // Pink-ish noise buffer (Paul Kellet's "instrumentation pink" coefficients).
  // 3-second loopable buffer is plenty — we loop it.
  function makePinkNoiseBuffer(ctx, seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    return buf;
  }

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.muted = false;
      this._ambient = null;
      this._tunnel = null;
      this._motion = null;
      this._pinkBuf = null;
      this.params = JSON.parse(JSON.stringify(DEFAULT_PARAMS));
    }

    init() {
      if (this.ctx) return;
      try {
        this.ctx = new AC({ latencyHint: "interactive" });
      } catch (e) {
        console.warn("[audio] AudioContext init failed:", e);
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.params.master;
      this.master.connect(this.ctx.destination);
    }

    resume() {
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
    }

    setMuted(m) {
      this.muted = !!m;
      if (this.master)
        this.master.gain.setTargetAtTime(
          this.muted ? 0 : this.params.master,
          this.ctx.currentTime,
          0.08,
        );
    }

    applyMaster() {
      if (this.master && !this.muted) {
        this.master.gain.setTargetAtTime(
          this.params.master,
          this.ctx.currentTime,
          0.05,
        );
      }
    }

    // ── Ambient drone (3-layer cosmic) ───────────────────────────────
    startAmbient() {
      if (!this.ctx || this._ambient) return;
      const ctx = this.ctx;
      const p = this.params.ambient;

      // ── Reverb bus ──────────────────────────────────────────
      const conv = ctx.createConvolver();
      conv.buffer = makeReverbIR(ctx, p.reverbSeconds, p.reverbDecay);

      const wet = ctx.createGain();
      wet.gain.value = p.wetMix;
      const dry = ctx.createGain();
      dry.gain.value = 1 - p.wetMix;

      // Low-shelf filter on the ambient bus for "heavier" tone
      const lowShelf = ctx.createBiquadFilter();
      lowShelf.type = "lowshelf";
      lowShelf.frequency.value = p.lowShelfHz;
      lowShelf.gain.value = p.lowShelfGain;

      // Main bus before fade-in envelope
      const bus = ctx.createGain();
      bus.gain.value = 0;

      // Wire: bus → lowShelf → (dry + conv→wet) → out fade → master
      const out = ctx.createGain();
      out.gain.value = p.gain;
      bus.connect(lowShelf);
      lowShelf.connect(dry).connect(out);
      lowShelf.connect(conv).connect(wet).connect(out);
      out.connect(this.master);

      // ── Layer 1: deep sine drone (4 oscs with slow detune LFOs) ──
      const droneBus = ctx.createGain();
      droneBus.gain.value = p.droneGain;
      droneBus.connect(bus);

      const freqs = [p.drone1, p.drone2, p.drone3, p.drone4];
      const droneNodes = freqs.map((f, i) => {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = 0.25;
        o.connect(g).connect(droneBus);

        // Each drone has its own slow drift LFO modulating detune
        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = p.droneLfoRate * (0.7 + i * 0.21); // offset rates
        const lfoG = ctx.createGain();
        lfoG.gain.value = p.droneDetune; // in cents
        lfo.connect(lfoG).connect(o.detune);
        o.start();
        lfo.start();
        return { o, g, lfo, lfoG };
      });

      // Sub-octave drone — adds felt weight, very low gain
      const subOsc = ctx.createOscillator();
      subOsc.type = "sine";
      subOsc.frequency.value = p.subFreq;
      const subG = ctx.createGain();
      subG.gain.value = p.subGain;
      subOsc.connect(subG).connect(droneBus);
      subOsc.start();

      // ── Layer 2: singing-bowl partials with subtle FM ────────────
      const bowlBus = ctx.createGain();
      bowlBus.gain.value = 0;
      bowlBus.connect(bus);

      const bowlFreqs = [p.bowlA, p.bowlB, p.bowlC, p.bowlD];
      const bowlNodes = bowlFreqs.map((f, i) => {
        const o = ctx.createOscillator();
        o.type = i < 2 ? "sine" : "triangle"; // higher partials slightly richer
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = p.bowlPartialGain * (1 - i * 0.15); // higher = quieter
        o.connect(g).connect(bowlBus);

        // FM modulator → small frequency wobble for metallic shimmer
        const mod = ctx.createOscillator();
        mod.type = "sine";
        mod.frequency.value = p.bowlFmRate * (1 + i * 0.13);
        const modG = ctx.createGain();
        modG.gain.value = p.bowlFmDepth;
        mod.connect(modG).connect(o.frequency);
        o.start();
        mod.start();
        return { o, g, mod, modG };
      });

      // Slow attack into bowl bus
      bowlBus.gain.linearRampToValueAtTime(
        p.bowlGain,
        ctx.currentTime + p.bowlAttack,
      );

      // ── Layer 3: filtered pink-noise air ─────────────────────────
      if (!this._pinkBuf) this._pinkBuf = makePinkNoiseBuffer(ctx, 3);
      const noise = ctx.createBufferSource();
      noise.buffer = this._pinkBuf;
      noise.loop = true;

      const airLP = ctx.createBiquadFilter();
      airLP.type = "lowpass";
      airLP.frequency.value = p.airCutoff;
      airLP.Q.value = 0.5;

      const airG = ctx.createGain();
      airG.gain.value = p.airGain;
      noise.connect(airLP).connect(airG).connect(bus);
      noise.start();

      // Slow filter sweep on air layer
      const airLfo = ctx.createOscillator();
      airLfo.type = "sine";
      airLfo.frequency.value = p.airSweepRate;
      const airLfoG = ctx.createGain();
      airLfoG.gain.value = p.airCutoffSweep;
      airLfo.connect(airLfoG).connect(airLP.frequency);
      airLfo.start();

      // ── Master envelope: slow attack ─────────────────────────────
      bus.gain.linearRampToValueAtTime(1.0, ctx.currentTime + p.attack);

      this._ambient = {
        bus,
        out,
        droneBus,
        droneNodes,
        subOsc,
        bowlBus,
        bowlNodes,
        noise,
        airLP,
        airG,
        airLfo,
        airLfoG,
        conv,
        wet,
        dry,
        lowShelf,
      };
    }

    stopAmbient() {
      if (!this._ambient) return;
      const a = this._ambient;
      const t = this.ctx.currentTime;
      const rel = this.params.ambient.release;
      a.bus.gain.cancelScheduledValues(t);
      a.bus.gain.setValueAtTime(a.bus.gain.value, t);
      a.bus.gain.linearRampToValueAtTime(0, t + rel);
      setTimeout(
        () => {
          try {
            a.droneNodes.forEach(({ o, lfo }) => {
              o.stop();
              lfo.stop();
            });
            if (a.subOsc) a.subOsc.stop();
            a.bowlNodes.forEach(({ o, mod }) => {
              o.stop();
              mod.stop();
            });
            a.noise.stop();
            a.airLfo.stop();
          } catch {}
        },
        rel * 1000 + 200,
      );
      this._ambient = null;
    }

    // ── Tunnel — 4-layer wormhole traversal ──────────────────────────
    // Layer 1: Particle stream  — HP+BP filtered white noise (stars/dust)
    // Layer 2: Tunnel body      — BP pink noise + low-mid oscs (mass + Doppler)
    // Layer 3: Energy compression — FM with inharmonic ratio (spatial tension)
    // Layer 4: Spatial depth    — ConvolverNode reverb + LFO-driven stereo pan
    // All layers continuous; intensity (0..1) drives filter, gain, pitch,
    // pan width, and reverb send. Smooth fade-in / fade-out at start/stop.
    startTunnel() {
      if (!this.ctx || this._tunnel) return;
      const ctx = this.ctx;
      const p = this.params.tunnel;

      // ── Output bus & spatial depth ───────────────────────────────
      // Topology:
      //   layers → out (dry sum)
      //   layers → conv → wet → out  (wet feeds back into out, NOT parallel)
      //   out → panner → master
      // This way the master fade (out.gain) cleanly controls everything —
      // wet path can't outlive the fade-out, no surprise reverb at startup.
      const out = ctx.createGain();
      out.gain.value = 0; // smooth fade-in below

      const panner = ctx.createStereoPanner();
      panner.pan.value = 0;
      out.connect(panner).connect(this.master);

      const conv = ctx.createConvolver();
      conv.buffer = makeReverbIR(ctx, p.reverbSeconds, p.reverbDecay);
      const wet = ctx.createGain();
      wet.gain.value = p.wetMixBase;
      conv.connect(wet).connect(out); // wet routed THROUGH out, not parallel

      // Pan LFO + gain that scales depth by intensity
      const panLfo = ctx.createOscillator();
      panLfo.type = "sine";
      panLfo.frequency.value = p.panRate;
      const panDepthG = ctx.createGain();
      panDepthG.gain.value = p.panDepthBase;
      panLfo.connect(panDepthG).connect(panner.pan);
      panLfo.start();

      // ── White noise buffer (shared for particle layer) ───────────
      if (!this._whiteBuf) {
        const wb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const d = wb.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this._whiteBuf = wb;
      }
      if (!this._pinkBuf) this._pinkBuf = makePinkNoiseBuffer(ctx, 3);

      // ── Layer 1: Particle stream ─────────────────────────────────
      const pSrc = ctx.createBufferSource();
      pSrc.buffer = this._whiteBuf;
      pSrc.loop = true;
      const pHP = ctx.createBiquadFilter();
      pHP.type = "highpass";
      pHP.frequency.value = p.particleHP;
      const pBP = ctx.createBiquadFilter();
      pBP.type = "bandpass";
      pBP.frequency.value = p.particleBP;
      pBP.Q.value = p.particleQ;
      const pG = ctx.createGain();
      pG.gain.value = p.particleGainBase;
      pSrc.connect(pHP).connect(pBP).connect(pG);
      pG.connect(out);
      pG.connect(conv); // also feed reverb send
      pSrc.start();

      // ── Layer 2: Tunnel body (filtered noise + low-mid oscs) ─────
      const bSrc = ctx.createBufferSource();
      bSrc.buffer = this._pinkBuf;
      bSrc.loop = true;
      const bBP = ctx.createBiquadFilter();
      bBP.type = "bandpass";
      bBP.frequency.value = p.bodyFreqBase;
      bBP.Q.value = p.bodyQ;
      const bG = ctx.createGain();
      bG.gain.value = p.bodyGainBase;
      bSrc.connect(bBP).connect(bG);
      bG.connect(out);
      bG.connect(conv);
      bSrc.start();

      const bOsc1 = ctx.createOscillator();
      bOsc1.type = "sine";
      bOsc1.frequency.value = p.bodyOsc1;
      const bOsc2 = ctx.createOscillator();
      bOsc2.type = "triangle";
      bOsc2.frequency.value = p.bodyOsc2;
      const bOscG = ctx.createGain();
      bOscG.gain.value = p.bodyOscGain;
      bOsc1.connect(bOscG);
      bOsc2.connect(bOscG);
      bOscG.connect(out);
      bOscG.connect(conv);
      bOsc1.start();
      bOsc2.start();

      // ── Layer 3: Energy compression (FM, inharmonic) ─────────────
      const fmCarrier = ctx.createOscillator();
      fmCarrier.type = "sine";
      fmCarrier.frequency.value = p.fmCarrier;
      const fmMod = ctx.createOscillator();
      fmMod.type = "sine";
      fmMod.frequency.value = p.fmCarrier * p.fmRatio;
      const fmDepth = ctx.createGain();
      fmDepth.gain.value = p.fmDepthBase;
      fmMod.connect(fmDepth).connect(fmCarrier.frequency);
      const fmG = ctx.createGain();
      fmG.gain.value = p.fmGainBase;
      fmCarrier.connect(fmG);
      fmG.connect(out);
      fmG.connect(conv);
      fmCarrier.start();
      fmMod.start();

      // ── Smooth fade-in ───────────────────────────────────────────
      out.gain.linearRampToValueAtTime(p.outGain, ctx.currentTime + p.attack);

      this._tunnel = {
        out,
        panner,
        conv,
        wet,
        panLfo,
        panDepthG,
        pSrc,
        pHP,
        pBP,
        pG,
        bSrc,
        bBP,
        bG,
        bOsc1,
        bOsc2,
        bOscG,
        fmCarrier,
        fmMod,
        fmDepth,
        fmG,
      };
    }

    setTunnelIntensity(i) {
      if (!this._tunnel) return;
      const p = this.params.tunnel;
      const t = this.ctx.currentTime;
      const norm = Math.max(0, Math.min(1, i));
      const tau = 0.15; // smooth follow time

      // Layer 1: particles — filter brightness + gain rise with speed
      this._tunnel.pHP.frequency.setTargetAtTime(
        p.particleHP + norm * (p.particleHPMax - p.particleHP),
        t,
        tau,
      );
      this._tunnel.pBP.frequency.setTargetAtTime(
        p.particleBP + norm * (p.particleBPMax - p.particleBP),
        t,
        tau,
      );
      this._tunnel.pG.gain.setTargetAtTime(
        p.particleGainBase + norm * (p.particleGainMax - p.particleGainBase),
        t,
        tau,
      );

      // Layer 2: body — filter sweep + gain + Doppler pitch shift
      this._tunnel.bBP.frequency.setTargetAtTime(
        p.bodyFreqBase + norm * (p.bodyFreqMax - p.bodyFreqBase),
        t,
        tau,
      );
      this._tunnel.bG.gain.setTargetAtTime(
        p.bodyGainBase + norm * (p.bodyGainMax - p.bodyGainBase),
        t,
        tau,
      );
      const detune = norm * p.dopplerCents;
      this._tunnel.bOsc1.detune.setTargetAtTime(detune, t, tau);
      this._tunnel.bOsc2.detune.setTargetAtTime(detune, t, tau);
      // Body oscs also share intensity contour
      const bOscVol =
        p.bodyOscGain * (0.5 + 0.5 * norm); // half at idle, full at speed
      this._tunnel.bOscG.gain.setTargetAtTime(bOscVol, t, tau);

      // Layer 3: FM — modulation depth + carrier gain
      this._tunnel.fmDepth.gain.setTargetAtTime(
        p.fmDepthBase + norm * (p.fmDepthMax - p.fmDepthBase),
        t,
        tau,
      );
      this._tunnel.fmG.gain.setTargetAtTime(
        p.fmGainBase + norm * (p.fmGainMax - p.fmGainBase),
        t,
        tau,
      );

      // Layer 4: spatial — reverb wet + stereo pan width
      this._tunnel.wet.gain.setTargetAtTime(
        p.wetMixBase + norm * (p.wetMixMax - p.wetMixBase),
        t,
        tau,
      );
      this._tunnel.panDepthG.gain.setTargetAtTime(
        p.panDepthBase + norm * (p.panDepthMax - p.panDepthBase),
        t,
        tau,
      );
    }

    stopTunnel() {
      if (!this._tunnel) return;
      const t = this.ctx.currentTime;
      const rel = this.params.tunnel.release;
      const tn = this._tunnel;
      tn.out.gain.cancelScheduledValues(t);
      tn.out.gain.setValueAtTime(tn.out.gain.value, t);
      tn.out.gain.linearRampToValueAtTime(0, t + rel);
      setTimeout(
        () => {
          try {
            tn.pSrc.stop();
            tn.bSrc.stop();
            tn.bOsc1.stop();
            tn.bOsc2.stop();
            tn.fmCarrier.stop();
            tn.fmMod.stop();
            tn.panLfo.stop();
          } catch {}
        },
        rel * 1000 + 200,
      );
      this._tunnel = null;
    }

    // ── Forge complete — 3-stage cinematic forging ───────────────────
    // Stage 1: charge (rising tri+sine through opening LP filter)
    // Stage 2: radiant release (BP-swept noise + high shimmer)
    // Stage 3: metallic formation (FM + inharmonic partials with resonance)
    // Stages overlap so it reads as a single evolving event.
    playForgeComplete() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const p = this.params.forge;
      const now = ctx.currentTime;

      // ── Shared output bus + reverb ───────────────────────────────
      const out = ctx.createGain();
      out.gain.value = p.outGain;
      out.connect(this.master);

      const conv = ctx.createConvolver();
      conv.buffer = makeReverbIR(ctx, p.reverbSeconds, p.reverbDecay);
      const wet = ctx.createGain();
      wet.gain.value = p.wetMix;
      conv.connect(wet).connect(out); // wet feeds back into out

      // Helper to route a gain node to both dry (out) and wet (conv)
      const sendBoth = (g) => {
        g.connect(out);
        g.connect(conv);
      };

      // ═══ Stage 1: Energy Charging ═══════════════════════════════
      const ch1 = ctx.createOscillator();
      ch1.type = "triangle";
      ch1.frequency.setValueAtTime(p.chargeStartFreq, now);
      ch1.frequency.exponentialRampToValueAtTime(
        p.chargeEndFreq,
        now + p.chargeTime,
      );

      const ch2 = ctx.createOscillator();
      ch2.type = "sine";
      ch2.frequency.setValueAtTime(p.chargeStartFreq * 2, now);
      ch2.frequency.exponentialRampToValueAtTime(
        p.chargeEndFreq * 2,
        now + p.chargeTime,
      );

      // Vibrato — tension during charge
      const vib = ctx.createOscillator();
      vib.type = "sine";
      vib.frequency.value = p.chargeVibRate;
      const vibG = ctx.createGain();
      vibG.gain.value = p.chargeVibDepth;
      vib.connect(vibG);
      vibG.connect(ch1.frequency);
      vibG.connect(ch2.frequency);

      // Opening LP filter
      const chargeLP = ctx.createBiquadFilter();
      chargeLP.type = "lowpass";
      chargeLP.frequency.setValueAtTime(p.chargeLPStart, now);
      chargeLP.frequency.exponentialRampToValueAtTime(
        p.chargeLPEnd,
        now + p.chargeTime,
      );
      chargeLP.Q.value = p.chargeLPQ;

      const chargeG = ctx.createGain();
      chargeG.gain.setValueAtTime(0, now);
      chargeG.gain.linearRampToValueAtTime(p.chargeGain, now + p.chargeAttack);
      // Hold near full until just before release, then fade as release takes over
      chargeG.gain.setValueAtTime(
        p.chargeGain,
        now + p.chargeTime - p.releaseOverlap - 0.05,
      );
      chargeG.gain.exponentialRampToValueAtTime(
        0.0001,
        now + p.chargeTime + 0.18,
      );

      ch1.connect(chargeLP);
      ch2.connect(chargeLP);
      chargeLP.connect(chargeG);
      sendBoth(chargeG);

      ch1.start(now);
      ch2.start(now);
      vib.start(now);
      const chargeEnd = now + p.chargeTime + 0.25;
      ch1.stop(chargeEnd);
      ch2.stop(chargeEnd);
      vib.stop(chargeEnd);

      // ═══ Stage 2: Radiant Release ═══════════════════════════════
      const releaseT = now + p.chargeTime - p.releaseOverlap;

      // Filtered noise burst
      if (!this._whiteBuf) {
        const wb = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
        const d = wb.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this._whiteBuf = wb;
      }
      const burst = ctx.createBufferSource();
      burst.buffer = this._whiteBuf;

      const burstHP = ctx.createBiquadFilter();
      burstHP.type = "highpass";
      burstHP.frequency.value = p.releaseHP;

      const burstBP = ctx.createBiquadFilter();
      burstBP.type = "bandpass";
      burstBP.frequency.setValueAtTime(p.releaseBPStart, releaseT);
      burstBP.frequency.exponentialRampToValueAtTime(
        p.releaseBPEnd,
        releaseT + p.releaseTime,
      );
      burstBP.Q.value = p.releaseBPQ;

      const burstG = ctx.createGain();
      burstG.gain.setValueAtTime(0, releaseT);
      burstG.gain.linearRampToValueAtTime(p.releaseGain, releaseT + 0.06);
      burstG.gain.exponentialRampToValueAtTime(
        0.0001,
        releaseT + p.releaseTime,
      );

      burst.connect(burstHP).connect(burstBP).connect(burstG);
      sendBoth(burstG);
      burst.start(releaseT);
      burst.stop(releaseT + p.releaseTime + 0.1);

      // Shimmer — 3 sines at metallic intervals, decaying
      [1.0, 1.5, 2.41].forEach((r, i) => {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = p.releaseShimmerBase * r;
        const g = ctx.createGain();
        const gainAmt = p.releaseShimmerGain * (1 - i * 0.28);
        g.gain.setValueAtTime(0, releaseT);
        g.gain.linearRampToValueAtTime(gainAmt, releaseT + 0.04);
        g.gain.exponentialRampToValueAtTime(
          0.0001,
          releaseT + p.releaseTime * 1.25,
        );
        o.connect(g);
        sendBoth(g);
        o.start(releaseT);
        o.stop(releaseT + p.releaseTime * 1.25 + 0.05);
      });

      // ═══ Stage 3: Metallic Formation ════════════════════════════
      const metalT = releaseT + p.metalDelay;

      // FM core: sine carrier + sine modulator at inharmonic ratio
      const fmCar = ctx.createOscillator();
      fmCar.type = "sine";
      fmCar.frequency.value = p.metalBase;
      const fmMod = ctx.createOscillator();
      fmMod.type = "sine";
      fmMod.frequency.value = p.metalBase * p.metalModRatio;
      const fmDepth = ctx.createGain();
      // FM depth decays so the bright shimmer settles into a clean tone
      fmDepth.gain.setValueAtTime(p.metalModDepth, metalT);
      fmDepth.gain.exponentialRampToValueAtTime(
        p.metalModDepth * 0.08,
        metalT + p.metalDecay * 0.6,
      );
      fmMod.connect(fmDepth).connect(fmCar.frequency);

      const fmG = ctx.createGain();
      fmG.gain.setValueAtTime(0, metalT);
      fmG.gain.linearRampToValueAtTime(p.metalGain, metalT + p.metalAttack);
      fmG.gain.exponentialRampToValueAtTime(0.0001, metalT + p.metalDecay);
      fmCar.connect(fmG);
      sendBoth(fmG);

      fmCar.start(metalT);
      fmMod.start(metalT);
      fmCar.stop(metalT + p.metalDecay + 0.05);
      fmMod.stop(metalT + p.metalDecay + 0.05);

      // Resonant partials (inharmonic sines) — the "settled metal" tail
      const metalPartials = [
        { ratio: p.metalP1Ratio, gain: p.metalP1Gain, decay: p.metalDecay },
        {
          ratio: p.metalP2Ratio,
          gain: p.metalP2Gain,
          decay: p.metalDecay * 0.78,
        },
        {
          ratio: p.metalP3Ratio,
          gain: p.metalP3Gain,
          decay: p.metalDecay * 0.55,
        },
      ];
      metalPartials.forEach((pt) => {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = p.metalBase * pt.ratio;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, metalT);
        g.gain.linearRampToValueAtTime(
          p.metalGain * pt.gain * 0.4, // partials are sub-mix of FM core
          metalT + p.metalAttack,
        );
        g.gain.exponentialRampToValueAtTime(0.0001, metalT + pt.decay);
        o.connect(g);
        sendBoth(g);
        o.start(metalT);
        o.stop(metalT + pt.decay + 0.05);
      });
    }

    // ── Medal pluck — event-triggered metallic ring ──────────────────
    // Triggered (not continuous): every "significant" rotation event fires
    // one short additive-sine pluck. Throttled to minInterval so dragging
    // fast doesn't produce a smeared continuous tone — instead you get a
    // sequence of distinct "ting ting ting" rings, each with a reverb tail.
    // Sonic-the-Hedgehog ring-loss feel, but heavier.
    //
    // The reverb send (a small ConvolverNode) is built once on demand and
    // shared across plucks so the tails layer naturally.
    _ensureMedalReverb() {
      if (this._medalReverb) return this._medalReverb;
      const ctx = this.ctx;
      const p = this.params.medal;
      const conv = ctx.createConvolver();
      conv.buffer = makeReverbIR(ctx, p.reverbSeconds, p.reverbDecay);
      const wet = ctx.createGain();
      wet.gain.value = p.wetMix;
      conv.connect(wet).connect(this.master);
      this._medalReverb = { input: conv, wet };
      return this._medalReverb;
    }

    // Public hook: called every frame from app loop with current angular
    // speed. Internally throttles + decides whether to fire a pluck.
    triggerMedalEvent(velocity) {
      if (!this.ctx) return;
      const p = this.params.medal;
      const mag = Math.abs(velocity);
      if (mag < p.threshold) return;
      const now = this.ctx.currentTime;
      if (this._lastPluckT && now - this._lastPluckT < p.minInterval) return;
      this._lastPluckT = now;
      const norm = Math.min(1, (mag - p.threshold) / p.sensitivity);
      this._playPluck(norm);
    }

    // Direct trigger (used by the tune panel for testing)
    playPluck(intensity) {
      if (!this.ctx) return;
      this._playPluck(Math.max(0, Math.min(1, intensity)));
    }

    _playPluck(norm) {
      const ctx = this.ctx;
      const p = this.params.medal;
      const now = ctx.currentTime;

      const reverb = this._ensureMedalReverb();

      // Per-pluck output node — drives dry path + reverb send
      const out = ctx.createGain();
      out.gain.value = p.outGain * (p.gainMin + norm * (p.gainMax - p.gainMin));
      out.connect(this.master); // dry
      out.connect(reverb.input); // wet via shared reverb

      const pitch = p.basePitch + norm * (p.maxPitch - p.basePitch);
      const partials = [
        { ratio: p.p1Ratio, gain: p.p1Gain, decay: p.p1Decay },
        { ratio: p.p2Ratio, gain: p.p2Gain, decay: p.p2Decay },
        { ratio: p.p3Ratio, gain: p.p3Gain * (0.4 + 0.6 * norm), decay: p.p3Decay },
        { ratio: p.p4Ratio, gain: p.p4Gain * norm, decay: p.p4Decay },
      ];

      partials.forEach((pt) => {
        const o = ctx.createOscillator();
        o.type = "sine";
        const f = pitch * pt.ratio;
        // Slight downward pitch bend over the decay — "pluck" feel
        o.frequency.setValueAtTime(f, now);
        o.frequency.exponentialRampToValueAtTime(
          f * p.pitchBend,
          now + pt.decay,
        );
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(pt.gain, now + p.attack);
        g.gain.exponentialRampToValueAtTime(0.0001, now + pt.decay);
        o.connect(g).connect(out);
        o.start(now);
        o.stop(now + pt.decay + 0.05);
      });
    }

    // Compatibility shims so app-v2 doesn't need to know we changed model.
    // (Old code: startMotion/stopMotion/setMotionVelocity.)
    startMotion() {} // no-op — plucks are event-driven, no persistent state
    stopMotion() {} // no-op
    setMotionVelocity(v) {
      this.triggerMedalEvent(v);
    }
  }

  AudioEngine.DEFAULT_PARAMS = DEFAULT_PARAMS;
  window.AudioEngine = AudioEngine;
})();
