/* ============================================================
   Ultimate Speed Test — procedural audio engine
   Pure Web Audio synthesis (no sample files). Four sounds:
     1. Ambient drone   — slow detuned sines, very low gain
     2. Tunnel whoosh   — bandpassed noise, intensity-modulated
     3. Forge complete  — quick harmonic bell with envelope
     4. Medal motion    — pitch/gain driven by rotation velocity
                          (lightsaber-style: silent at rest, hum on motion)

   All tunable values live on this.params so audio-tune.js can adjust
   them in real time. Methods read from this.params at the moment of
   start/trigger; for continuous sounds, change → stop → start to apply.
   ============================================================ */
(function () {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) {
    console.warn("[audio] Web Audio API not supported — sound disabled");
    return;
  }

  // Default tunable parameters. audio-tune.js can read/write this whole tree.
  const DEFAULT_PARAMS = {
    master: 0.35,
    ambient: {
      gain: 0.18,
      freq1: 55,
      freq2: 82.5,
      freq3: 110.3,
      partialGain: 0.4,
      filterBase: 320,
      filterQ: 0.4,
      lfoRate: 0.07,
      lfoDepth: 140,
    },
    tunnel: {
      maxGain: 0.25,
      gainMult: 0.32, // gain = min(maxGain, intensity * gainMult)
      minFreq: 400,
      maxFreq: 2600, // cutoff = minFreq + intensity * (maxFreq - minFreq)
      bpQ: 1.2,
      hpFreq: 200,
    },
    forge: {
      baseFreq: 660,
      bendStart: 0.94, // start at 94% of target, bend up to 100%
      bendTime: 0.08, // seconds for pitch bend
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
      baseFreq: 110,
      maxFreq: 420, // pitch = baseFreq + norm * (maxFreq - baseFreq)
      detune: 1.005,
      minGain: 0.04, // gain when moving slowly
      maxGain: 0.14, // gain at max velocity
      filterBase: 600,
      filterMax: 2200,
      filterQ: 1.5,
      sensitivity: 0.08, // normalization divisor for velocity → 0..1
      floor: 0.001, // below this velocity, mute completely
      attack: 0.05, // seconds for pitch follow
      gainAttack: 0.04, // seconds for gain follow
    },
  };

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.muted = false;
      this._ambient = null;
      this._tunnel = null;
      this._motion = null;
      // Deep clone defaults so tuning never mutates the source-of-truth
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

    // Apply current master from params (called by tune panel after slider change)
    applyMaster() {
      if (this.master && !this.muted) {
        this.master.gain.setTargetAtTime(
          this.params.master,
          this.ctx.currentTime,
          0.05,
        );
      }
    }

    // ── Ambient drone ────────────────────────────────────────────────
    startAmbient() {
      if (!this.ctx || this._ambient) return;
      const ctx = this.ctx;
      const p = this.params.ambient;
      const out = ctx.createGain();
      out.gain.value = 0;

      const freqs = [p.freq1, p.freq2, p.freq3];
      const oscs = freqs.map((f) => {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = p.partialGain;
        o.connect(g).connect(out);
        o.start();
        return o;
      });

      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = p.filterBase;
      lp.Q.value = p.filterQ;
      out.connect(lp).connect(this.master);

      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = p.lfoRate;
      lfoG.gain.value = p.lfoDepth;
      lfo.connect(lfoG).connect(lp.frequency);
      lfo.start();

      out.gain.linearRampToValueAtTime(p.gain, ctx.currentTime + 2.5);
      this._ambient = { out, oscs, lp, lfo };
    }

    stopAmbient() {
      if (!this._ambient) return;
      const a = this._ambient;
      const t = this.ctx.currentTime;
      a.out.gain.cancelScheduledValues(t);
      a.out.gain.setValueAtTime(a.out.gain.value, t);
      a.out.gain.linearRampToValueAtTime(0, t + 1.5);
      setTimeout(() => {
        try {
          a.oscs.forEach((o) => o.stop());
          a.lfo.stop();
        } catch {}
      }, 1700);
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

    // ── Medal motion (lightsaber-style) ──────────────────────────────
    startMotion() {
      if (!this.ctx || this._motion) return;
      const ctx = this.ctx;
      const p = this.params.motion;

      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.type = "sawtooth";
      o2.type = "sawtooth";
      o1.frequency.value = p.baseFreq;
      o2.frequency.value = p.baseFreq * p.detune;

      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = p.filterBase;
      lp.Q.value = p.filterQ;

      const gain = ctx.createGain();
      gain.gain.value = 0;

      o1.connect(lp);
      o2.connect(lp);
      lp.connect(gain).connect(this.master);
      o1.start();
      o2.start();

      this._motion = { o1, o2, lp, gain };
    }

    setMotionVelocity(v) {
      if (!this._motion) return;
      const p = this.params.motion;
      const t = this.ctx.currentTime;
      const mag = Math.abs(v);
      const isMoving = mag > p.floor;

      const norm = Math.min(1, Math.max(0, (mag - p.floor) / p.sensitivity));
      const pitch = p.baseFreq + norm * (p.maxFreq - p.baseFreq);
      const vol = isMoving ? p.minGain + norm * (p.maxGain - p.minGain) : 0;
      const filt = p.filterBase + norm * (p.filterMax - p.filterBase);

      this._motion.o1.frequency.setTargetAtTime(pitch, t, p.attack);
      this._motion.o2.frequency.setTargetAtTime(pitch * p.detune, t, p.attack);
      this._motion.lp.frequency.setTargetAtTime(filt, t, p.attack);
      this._motion.gain.gain.setTargetAtTime(vol, t, p.gainAttack);
    }

    stopMotion() {
      if (!this._motion) return;
      const m = this._motion;
      const t = this.ctx.currentTime;
      m.gain.gain.cancelScheduledValues(t);
      m.gain.gain.setValueAtTime(m.gain.gain.value, t);
      m.gain.gain.linearRampToValueAtTime(0, t + 0.3);
      setTimeout(() => {
        try {
          m.o1.stop();
          m.o2.stop();
        } catch {}
      }, 400);
      this._motion = null;
    }
  }

  AudioEngine.DEFAULT_PARAMS = DEFAULT_PARAMS;
  window.AudioEngine = AudioEngine;
})();
