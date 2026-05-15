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
      // ─ master mix ─
      gain: 0.22, // overall ambient bus
      attack: 5.0, // fade-in time (sec)
      release: 10.0, // fade-out time
      wetMix: 0.65, // reverb wet/dry
      reverbSeconds: 8.0, // IR length / tail
      reverbDecay: 2.4, // IR decay curve exponent

      // ─ Layer 1: deep sine drone (4 oscillators) ─
      droneGain: 0.45,
      drone1: 42,
      drone2: 56,
      drone3: 73,
      drone4: 88,
      droneDetune: 6, // cents drift per drone LFO
      droneLfoRate: 0.04, // very slow pitch drift

      // ─ Layer 2: singing-bowl harmonics (4 partials w/ FM) ─
      bowlGain: 0.28,
      bowlA: 180,
      bowlB: 358, // very slightly inharmonic for metallic shimmer
      bowlC: 723,
      bowlD: 1198,
      bowlPartialGain: 0.18, // gain of each partial before sum
      bowlFmRate: 0.7, // FM modulator freq (Hz)
      bowlFmDepth: 2.5, // FM depth in Hz (subtle)
      bowlAttack: 6.0,

      // ─ Layer 3: filtered pink-noise air ─
      airGain: 0.08, // VERY quiet
      airCutoff: 5500, // LP filter base
      airCutoffSweep: 1800, // LFO depth on filter
      airSweepRate: 0.03, // Hz
    },
    tunnel: {
      maxGain: 0.25,
      gainMult: 0.32,
      minFreq: 400,
      maxFreq: 2600,
      bpQ: 1.2,
      hpFreq: 200,
    },
    forge: {
      baseFreq: 660,
      bendStart: 0.94,
      bendTime: 0.08,
      attack: 0.005,
      partial1Ratio: 1.0,
      partial1Gain: 0.6,
      partial1Decay: 1.6,
      partial2Ratio: 2.71,
      partial2Gain: 0.25,
      partial2Decay: 1.1,
      partial3Ratio: 4.18,
      partial3Gain: 0.12,
      partial3Decay: 0.7,
      outGain: 0.4,
    },
    motion: {
      // Bright + metallic via additive sine partials + subtle FM shimmer.
      // baseFreq is the FUNDAMENTAL when stationary; pitches scale with velocity.
      baseFreq: 220, // higher base for "brighter" rest tone
      maxFreq: 880, // full-speed pitch
      // Partial ratios — odd-leaning + one inharmonic for metallic clang.
      // (Pure harmonic series = brassy. Slight inharmonicity = bell/coin-edge.)
      p1Ratio: 1.0,
      p1Gain: 1.0,
      p2Ratio: 2.0,
      p2Gain: 0.42,
      p3Ratio: 3.01, // slight inharmonic
      p3Gain: 0.28,
      p4Ratio: 5.07, // slight inharmonic
      p4Gain: 0.16,
      // FM "shimmer" — a mid-rate modulator on partial 3+4 frequencies
      fmRate: 4.2,
      fmDepth: 6, // Hz
      // Envelope
      minGain: 0.0, // silent at exact rest
      maxGain: 0.16, // peak at full speed
      sensitivity: 0.08, // velocity normalization divisor
      floor: 0.0008, // below this, mute
      attack: 0.04, // pitch follow
      gainAttack: 0.05, // gain follow
      // Brightness — at low speed only fundamental + 2nd, at high speed all 4
      brightnessSensitivity: 1.0,
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

      // Main bus before fade-in envelope
      const bus = ctx.createGain();
      bus.gain.value = 0;

      // Wire: bus → (dry + conv→wet) → out fade → master
      const out = ctx.createGain();
      out.gain.value = p.gain;
      bus.connect(dry).connect(out);
      bus.connect(conv).connect(wet).connect(out);
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

    // ── Tunnel whoosh ────────────────────────────────────────────────
    startTunnel() {
      if (!this.ctx || this._tunnel) return;
      const ctx = this.ctx;
      const p = this.params.tunnel;

      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = p.minFreq;
      bp.Q.value = p.bpQ;

      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = p.hpFreq;

      const gain = ctx.createGain();
      gain.gain.value = 0;

      src.connect(hp).connect(bp).connect(gain).connect(this.master);
      src.start();

      this._tunnel = { src, bp, hp, gain };
    }

    setTunnelIntensity(i) {
      if (!this._tunnel) return;
      const p = this.params.tunnel;
      const t = this.ctx.currentTime;
      const cutoff = p.minFreq + i * (p.maxFreq - p.minFreq);
      const vol = Math.min(p.maxGain, i * p.gainMult);
      this._tunnel.bp.frequency.setTargetAtTime(cutoff, t, 0.12);
      this._tunnel.gain.gain.setTargetAtTime(vol, t, 0.12);
    }

    stopTunnel() {
      if (!this._tunnel) return;
      const t = this.ctx.currentTime;
      this._tunnel.gain.gain.cancelScheduledValues(t);
      this._tunnel.gain.gain.setValueAtTime(this._tunnel.gain.gain.value, t);
      this._tunnel.gain.gain.linearRampToValueAtTime(0, t + 0.8);
      const tunnel = this._tunnel;
      setTimeout(() => {
        try {
          tunnel.src.stop();
        } catch {}
      }, 900);
      this._tunnel = null;
    }

    // ── Forge complete chime ─────────────────────────────────────────
    playForgeComplete() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const p = this.params.forge;
      const now = ctx.currentTime;
      const baseHz = p.baseFreq;

      const partials = [
        { ratio: p.partial1Ratio, gain: p.partial1Gain, decay: p.partial1Decay },
        { ratio: p.partial2Ratio, gain: p.partial2Gain, decay: p.partial2Decay },
        { ratio: p.partial3Ratio, gain: p.partial3Gain, decay: p.partial3Decay },
      ];

      const out = ctx.createGain();
      out.gain.value = p.outGain;
      out.connect(this.master);

      partials.forEach((pt) => {
        const o = ctx.createOscillator();
        o.type = "sine";
        const f = baseHz * pt.ratio;
        o.frequency.setValueAtTime(f * p.bendStart, now);
        o.frequency.linearRampToValueAtTime(f, now + p.bendTime);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(pt.gain, now + p.attack);
        g.gain.exponentialRampToValueAtTime(0.0001, now + pt.decay);
        o.connect(g).connect(out);
        o.start(now);
        o.stop(now + pt.decay + 0.05);
      });
    }

    // ── Medal motion — sine partials + FM shimmer (clear + metallic) ──
    // Additive synthesis on 4 sine partials gives a bell/coin-edge timbre
    // without the buzzy warmth of sawtooth. Slight inharmonicity (3.01,
    // 5.07) is what reads as "metal" rather than "brass" or "voice".
    // FM modulator wobbles the upper partials for shimmer.
    startMotion() {
      if (!this.ctx || this._motion) return;
      const ctx = this.ctx;
      const p = this.params.motion;

      const out = ctx.createGain();
      out.gain.value = 0;
      out.connect(this.master);

      // Create 4 partial oscillators
      const ratios = [p.p1Ratio, p.p2Ratio, p.p3Ratio, p.p4Ratio];
      const partGains = [p.p1Gain, p.p2Gain, p.p3Gain, p.p4Gain];
      const partials = ratios.map((r, i) => {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = p.baseFreq * r;
        const g = ctx.createGain();
        // Per-partial gain — gets re-targeted in setMotionVelocity for
        // brightness sweep. Initial: just fundamental + 2nd at rest.
        g.gain.value = i < 2 ? partGains[i] * 0.25 : 0;
        o.connect(g).connect(out);
        o.start();
        return { o, g, baseGain: partGains[i] };
      });

      // FM shimmer — single modulator routed to upper partials' frequency
      const fm = ctx.createOscillator();
      fm.type = "sine";
      fm.frequency.value = p.fmRate;
      const fmG = ctx.createGain();
      fmG.gain.value = p.fmDepth;
      fm.connect(fmG);
      // Only upper partials get the shimmer
      fmG.connect(partials[2].o.frequency);
      fmG.connect(partials[3].o.frequency);
      fm.start();

      this._motion = { out, partials, fm, fmG };
    }

    setMotionVelocity(v) {
      if (!this._motion) return;
      const p = this.params.motion;
      const t = this.ctx.currentTime;
      const mag = Math.abs(v);
      const isMoving = mag > p.floor;

      const norm = Math.min(1, Math.max(0, (mag - p.floor) / p.sensitivity));

      // Pitch: fundamental scales between baseFreq and maxFreq.
      const fund = p.baseFreq + norm * (p.maxFreq - p.baseFreq);

      // Brightness curve — at low speed only fundamental + 2nd partial
      // audible. At high speed all 4 ring out. Squared norm so the change
      // is gentle at the start, dramatic when really spinning.
      const bright = Math.pow(norm, 1 / Math.max(0.1, p.brightnessSensitivity));

      // Per-partial frequency + gain
      const ratios = [p.p1Ratio, p.p2Ratio, p.p3Ratio, p.p4Ratio];
      const baseGains = [p.p1Gain, p.p2Gain, p.p3Gain, p.p4Gain];
      this._motion.partials.forEach(({ o, g }, i) => {
        o.frequency.setTargetAtTime(fund * ratios[i], t, p.attack);
        let pGain;
        if (i === 0) pGain = baseGains[0]; // fundamental always present
        else if (i === 1) pGain = baseGains[1] * (0.3 + bright * 0.7);
        else if (i === 2) pGain = baseGains[2] * bright;
        else pGain = baseGains[3] * bright * bright; // top partial only when fast
        g.gain.setTargetAtTime(pGain, t, p.gainAttack);
      });

      // Output envelope
      const outVol = isMoving
        ? p.minGain + norm * (p.maxGain - p.minGain)
        : 0;
      this._motion.out.gain.setTargetAtTime(outVol, t, p.gainAttack);
    }

    stopMotion() {
      if (!this._motion) return;
      const m = this._motion;
      const t = this.ctx.currentTime;
      m.out.gain.cancelScheduledValues(t);
      m.out.gain.setValueAtTime(m.out.gain.value, t);
      m.out.gain.linearRampToValueAtTime(0, t + 0.3);
      setTimeout(() => {
        try {
          m.partials.forEach(({ o }) => o.stop());
          m.fm.stop();
        } catch {}
      }, 400);
      this._motion = null;
    }
  }

  AudioEngine.DEFAULT_PARAMS = DEFAULT_PARAMS;
  window.AudioEngine = AudioEngine;
})();
