/* ============================================================
   Ultimate Speed Test — procedural audio engine
   Pure Web Audio synthesis (no sample files). Four sounds:
     1. Ambient drone   — slow detuned sines, very low gain
     2. Tunnel whoosh   — bandpassed noise, intensity-modulated
     3. Forge complete  — quick harmonic bell with envelope
     4. Medal motion    — pitch/gain driven by rotation velocity
                          (lightsaber-style: silent at rest, hum on motion)
   ============================================================ */
(function () {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) {
    console.warn("[audio] Web Audio API not supported — sound disabled");
    return;
  }

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.muted = false;
      this._ambient = null;
      this._tunnel = null;
      this._motion = null;
    }

    // Lazy init — AudioContext can only start on a user gesture.
    init() {
      if (this.ctx) return;
      try {
        this.ctx = new AC({ latencyHint: "interactive" });
      } catch (e) {
        console.warn("[audio] AudioContext init failed:", e);
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.35;
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
          this.muted ? 0 : 0.35,
          this.ctx.currentTime,
          0.08,
        );
    }

    // ── Ambient drone ────────────────────────────────────────────────
    // Three slowly-detuned sine partials build a "space hum". Filter LFO
    // gives it gentle motion so it doesn't sound static.
    startAmbient() {
      if (!this.ctx || this._ambient) return;
      const ctx = this.ctx;
      const out = ctx.createGain();
      out.gain.value = 0;
      out.connect(this.master);

      // Three sines at slightly offset frequencies → beating, "wide" feel
      const freqs = [55, 82.5, 110.3];
      const oscs = freqs.map((f) => {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = 0.4;
        o.connect(g).connect(out);
        o.start();
        return o;
      });

      // Slow lowpass LFO for breath
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 320;
      lp.Q.value = 0.4;

      // Re-route through filter
      out.disconnect();
      out.connect(lp).connect(this.master);

      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 0.07;
      lfoG.gain.value = 140;
      lfo.connect(lfoG).connect(lp.frequency);
      lfo.start();

      // Fade in
      out.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 2.5);

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
    // White noise → bandpass filter, with cutoff + gain modulated by an
    // "intensity" value (0..1). Sounds like wind/streaks passing by.
    startTunnel() {
      if (!this.ctx || this._tunnel) return;
      const ctx = this.ctx;

      // 2-second buffer of white noise, looped — cheaper than scriptnode
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 600;
      bp.Q.value = 1.2;

      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 200;

      const gain = ctx.createGain();
      gain.gain.value = 0;

      src.connect(hp).connect(bp).connect(gain).connect(this.master);
      src.start();

      this._tunnel = { src, bp, gain };
    }

    setTunnelIntensity(i) {
      if (!this._tunnel) return;
      const t = this.ctx.currentTime;
      // Map 0..1 to filter sweep + gain
      const cutoff = 400 + i * 2200; // 400Hz → 2.6kHz
      const vol = Math.min(0.25, i * 0.32);
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
    // Quick metallic bell — three sine partials at metallic ratios,
    // sharp attack, exponential decay. Slight upward pitch bend at the
    // start gives the "tempered steel" character.
    playForgeComplete() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const baseHz = 660;

      // Metallic partial ratios (non-integer = bell-ish, not pure tone)
      const partials = [
        { ratio: 1.0, gain: 0.6, decay: 1.6 },
        { ratio: 2.71, gain: 0.25, decay: 1.1 },
        { ratio: 4.18, gain: 0.12, decay: 0.7 },
      ];

      const out = ctx.createGain();
      out.gain.value = 0.4;
      out.connect(this.master);

      partials.forEach((p) => {
        const o = ctx.createOscillator();
        o.type = "sine";
        const f = baseHz * p.ratio;
        // Slight upward pitch bend (0.94→1.0) over 80ms
        o.frequency.setValueAtTime(f * 0.94, now);
        o.frequency.linearRampToValueAtTime(f, now + 0.08);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(p.gain, now + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);
        o.connect(g).connect(out);
        o.start(now);
        o.stop(now + p.decay + 0.05);
      });
    }

    // ── Medal motion (lightsaber-style) ──────────────────────────────
    // A continuous oscillator that's only audible when the medal moves.
    // Higher rotation velocity → higher pitch + more gain.
    // Silent at rest so the ambient drone stays the dominant background.
    startMotion() {
      if (!this.ctx || this._motion) return;
      const ctx = this.ctx;

      // Two detuned sawtooth oscs for "buzz" warmth
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.type = "sawtooth";
      o2.type = "sawtooth";
      o1.frequency.value = 110;
      o2.frequency.value = 110 * 1.005; // tiny detune

      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 800;
      lp.Q.value = 1.5;

      const gain = ctx.createGain();
      gain.gain.value = 0;

      o1.connect(lp);
      o2.connect(lp);
      lp.connect(gain).connect(this.master);
      o1.start();
      o2.start();

      this._motion = { o1, o2, lp, gain };
    }

    // Drive motion sound from rotation velocity. `v` should be ≈ instant
    // angular speed (rad/frame would be a reasonable proxy). Above a tiny
    // floor it ramps pitch + gain; below it the sound fades out smoothly.
    setMotionVelocity(v) {
      if (!this._motion) return;
      const t = this.ctx.currentTime;
      const mag = Math.abs(v);
      const isMoving = mag > 0.001;

      // Map magnitude (0.001..0.15+) to pitch 110..420Hz, gain 0..0.12
      const norm = Math.min(1, Math.max(0, (mag - 0.001) / 0.08));
      const pitch = 110 + norm * 310;
      const vol = isMoving ? 0.04 + norm * 0.1 : 0;

      this._motion.o1.frequency.setTargetAtTime(pitch, t, 0.05);
      this._motion.o2.frequency.setTargetAtTime(pitch * 1.005, t, 0.05);
      this._motion.lp.frequency.setTargetAtTime(600 + norm * 1600, t, 0.05);
      this._motion.gain.gain.setTargetAtTime(vol, t, 0.04);
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

  window.AudioEngine = AudioEngine;
})();
