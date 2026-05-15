/* ============================================================
   Audio tuning panel — press T to toggle.
   Live sliders for every parameter on AudioEngine.params.
   Click 試聽 to play continuous sounds; 觸發 for one-shot.
   "Copy JSON" dumps the full params object so the user can
   paste it back and the new defaults can be baked in.
   ============================================================ */
(function () {
  // Defer until the AudioEngine instance exists. app-v2.js attaches it.
  function getEngine() {
    return window.__audioEngine || null;
  }

  // Slider spec: [paramPath, label, min, max, step, isFreq?]
  // paramPath is dot-separated; isFreq enables log-scale display
  const SPEC = {
    "全域 Master": [
      ["master", "音量", 0, 1, 0.01],
    ],
    "Ambient — 整體 & 包絡": [
      ["ambient.gain", "Ambient 總音量", 0, 0.8, 0.01],
      ["ambient.attack", "整體 Attack (s)", 0.5, 15, 0.1],
      ["ambient.release", "整體 Release (s)", 1, 20, 0.1],
      ["ambient.wetMix", "Reverb 濕度", 0, 1, 0.01],
      ["ambient.reverbSeconds", "Reverb 尾長 (s)", 1, 15, 0.5],
      ["ambient.reverbDecay", "Reverb 衰減曲線", 0.5, 5, 0.1],
      ["ambient.lowShelfHz", "Low-shelf 拐點 (Hz)", 50, 400, 5],
      ["ambient.lowShelfGain", "Low-shelf 增益 (dB)", -6, 12, 0.5],
    ],
    "Ambient — Layer 1 深層 sine drone": [
      ["ambient.droneGain", "Drone 音量", 0, 1.2, 0.01],
      ["ambient.drone1", "Drone 1 (Hz)", 20, 120, 0.5],
      ["ambient.drone2", "Drone 2 (Hz)", 30, 150, 0.5],
      ["ambient.drone3", "Drone 3 (Hz)", 40, 180, 0.5],
      ["ambient.drone4", "Drone 4 (Hz)", 50, 220, 0.5],
      ["ambient.droneDetune", "Detune 漂移 (cents)", 0, 30, 0.5],
      ["ambient.droneLfoRate", "Drift LFO 速度 (Hz)", 0.005, 0.3, 0.005],
      ["ambient.subFreq", "Sub-oct 頻率 (Hz)", 15, 60, 0.5],
      ["ambient.subGain", "Sub-oct 音量", 0, 0.5, 0.005],
    ],
    "Ambient — Layer 2 頌缽 FM 諧振": [
      ["ambient.bowlGain", "Bowl 音量", 0, 0.6, 0.01],
      ["ambient.bowlA", "Bowl 1 (Hz)", 80, 400, 1],
      ["ambient.bowlB", "Bowl 2 (Hz)", 200, 700, 1],
      ["ambient.bowlC", "Bowl 3 (Hz)", 400, 1500, 2],
      ["ambient.bowlD", "Bowl 4 (Hz)", 600, 2500, 5],
      ["ambient.bowlPartialGain", "每個 partial 音量", 0, 0.5, 0.005],
      ["ambient.bowlFmRate", "FM 速度 (Hz)", 0.1, 5, 0.05],
      ["ambient.bowlFmDepth", "FM 深度 (Hz)", 0, 20, 0.1],
      ["ambient.bowlAttack", "Bowl Attack (s)", 1, 12, 0.2],
    ],
    "Ambient — Layer 3 空氣 pink noise": [
      ["ambient.airGain", "Air 音量", 0, 0.3, 0.005],
      ["ambient.airCutoff", "Air LP cutoff (Hz)", 1000, 12000, 50],
      ["ambient.airCutoffSweep", "LP sweep 深度 (Hz)", 0, 4000, 25],
      ["ambient.airSweepRate", "Sweep 速度 (Hz)", 0.005, 0.2, 0.005],
    ],
    "Tunnel — 整體 & 包絡": [
      ["tunnel.outGain", "整體音量", 0, 1, 0.01],
      ["tunnel.attack", "Attack (s)", 0.1, 5, 0.1],
      ["tunnel.release", "Release (s)", 0.1, 5, 0.1],
    ],
    "Tunnel — Layer 1 粒子流 (filtered noise)": [
      ["tunnel.particleHP", "HP 起點 (Hz)", 200, 3000, 20],
      ["tunnel.particleHPMax", "HP 全速 (Hz)", 800, 6000, 50],
      ["tunnel.particleBP", "BP 起點 (Hz)", 500, 4000, 50],
      ["tunnel.particleBPMax", "BP 全速 (Hz)", 2000, 10000, 100],
      ["tunnel.particleQ", "BP Q", 0.5, 6, 0.05],
      ["tunnel.particleGainBase", "粒子音量 idle", 0, 0.4, 0.005],
      ["tunnel.particleGainMax", "粒子音量 全速", 0, 0.6, 0.005],
    ],
    "Tunnel — Layer 2 隧道體 (mass + Doppler)": [
      ["tunnel.bodyFreqBase", "BP 中心 idle (Hz)", 80, 600, 5],
      ["tunnel.bodyFreqMax", "BP 中心 全速 (Hz)", 100, 1000, 5],
      ["tunnel.bodyQ", "BP Q", 0.5, 5, 0.05],
      ["tunnel.bodyGainBase", "音量 idle", 0, 0.3, 0.005],
      ["tunnel.bodyGainMax", "音量 全速", 0, 0.5, 0.005],
      ["tunnel.bodyOsc1", "低 osc 1 (Hz)", 40, 250, 1],
      ["tunnel.bodyOsc2", "低 osc 2 (Hz)", 60, 350, 1],
      ["tunnel.bodyOscGain", "低 osc 音量", 0, 0.3, 0.005],
      ["tunnel.dopplerCents", "Doppler 上行 (cents)", 0, 600, 5],
    ],
    "Tunnel — Layer 3 FM 能量壓縮": [
      ["tunnel.fmCarrier", "Carrier (Hz)", 100, 1500, 5],
      ["tunnel.fmRatio", "Modulator 比例 (×)", 0.5, 5, 0.005],
      ["tunnel.fmDepthBase", "FM 深度 idle (Hz)", 0, 200, 5],
      ["tunnel.fmDepthMax", "FM 深度 全速 (Hz)", 0, 800, 5],
      ["tunnel.fmGainBase", "音量 idle", 0, 0.2, 0.005],
      ["tunnel.fmGainMax", "音量 全速", 0, 0.3, 0.005],
    ],
    "Tunnel — Layer 4 空間 (reverb + stereo)": [
      ["tunnel.reverbSeconds", "Reverb 尾長 (s)", 1, 8, 0.2],
      ["tunnel.reverbDecay", "Reverb 衰減曲線", 0.5, 5, 0.1],
      ["tunnel.wetMixBase", "Reverb idle", 0, 0.8, 0.01],
      ["tunnel.wetMixMax", "Reverb 全速", 0, 1, 0.01],
      ["tunnel.panRate", "Pan LFO (Hz)", 0.02, 1, 0.01],
      ["tunnel.panDepthBase", "Pan 寬度 idle", 0, 1, 0.01],
      ["tunnel.panDepthMax", "Pan 寬度 全速", 0, 1, 0.01],
    ],
    "Forge — 整體 & Reverb": [
      ["forge.outGain", "整體音量", 0, 1, 0.01],
      ["forge.reverbSeconds", "Reverb 尾長 (s)", 0.5, 6, 0.1],
      ["forge.reverbDecay", "Reverb 衰減曲線", 0.5, 5, 0.1],
      ["forge.wetMix", "Reverb 濕度", 0, 1, 0.01],
    ],
    "Forge — Stage 1 Charge 蓄能": [
      ["forge.chargeTime", "蓄能時間 (s)", 0.2, 2, 0.05],
      ["forge.chargeAttack", "Attack (s)", 0.02, 0.5, 0.01],
      ["forge.chargeStartFreq", "起始頻率 (Hz)", 60, 400, 2],
      ["forge.chargeEndFreq", "終止頻率 (Hz)", 200, 1200, 5],
      ["forge.chargeLPStart", "LP 起點 (Hz)", 100, 1500, 10],
      ["forge.chargeLPEnd", "LP 終點 (Hz)", 1000, 8000, 50],
      ["forge.chargeLPQ", "LP Q", 0.5, 10, 0.1],
      ["forge.chargeGain", "音量", 0, 0.8, 0.01],
      ["forge.chargeVibRate", "Vibrato 速度 (Hz)", 1, 15, 0.2],
      ["forge.chargeVibDepth", "Vibrato 深度 (Hz)", 0, 25, 0.5],
    ],
    "Forge — Stage 2 Release 釋放": [
      ["forge.releaseOverlap", "與 charge 重疊 (s)", 0, 0.5, 0.01],
      ["forge.releaseTime", "釋放長度 (s)", 0.15, 1.2, 0.02],
      ["forge.releaseGain", "音量", 0, 0.6, 0.01],
      ["forge.releaseBPStart", "BP 起點 (Hz)", 500, 4000, 50],
      ["forge.releaseBPEnd", "BP 終點 (Hz)", 1500, 8000, 50],
      ["forge.releaseBPQ", "BP Q", 0.3, 5, 0.05],
      ["forge.releaseHP", "HP cutoff (Hz)", 200, 2500, 25],
      ["forge.releaseShimmerBase", "Shimmer 基頻 (Hz)", 800, 4000, 25],
      ["forge.releaseShimmerGain", "Shimmer 音量", 0, 0.4, 0.005],
    ],
    "Forge — Stage 3 Metal 金屬定型": [
      ["forge.metalDelay", "延遲開始 (s)", 0, 0.8, 0.02],
      ["forge.metalAttack", "Attack (s)", 0.001, 0.1, 0.001],
      ["forge.metalDecay", "Decay (s)", 0.3, 4, 0.05],
      ["forge.metalGain", "音量", 0, 1, 0.01],
      ["forge.metalBase", "基頻 (Hz)", 300, 2000, 5],
      ["forge.metalModRatio", "FM 比例 (×)", 0.5, 4, 0.005],
      ["forge.metalModDepth", "FM 深度 (Hz)", 0, 300, 1],
      ["forge.metalP1Ratio", "Partial 1 比例", 0.5, 4, 0.01],
      ["forge.metalP1Gain", "Partial 1 音量", 0, 1.5, 0.01],
      ["forge.metalP2Ratio", "Partial 2 比例", 0.5, 5, 0.01],
      ["forge.metalP2Gain", "Partial 2 音量", 0, 1, 0.01],
      ["forge.metalP3Ratio", "Partial 3 比例", 0.5, 6, 0.01],
      ["forge.metalP3Gain", "Partial 3 音量", 0, 1, 0.01],
    ],
    "Medal Pluck — 觸發 & 音域": [
      ["medal.threshold", "觸發門檻", 0, 0.02, 0.0005],
      ["medal.sensitivity", "靈敏度 (歸一)", 0.005, 0.2, 0.001],
      ["medal.minInterval", "最小間隔 (s)", 0.02, 0.4, 0.005],
      ["medal.basePitch", "最低音 (Hz)", 200, 2000, 5],
      ["medal.maxPitch", "最高音 (Hz)", 400, 4000, 10],
      ["medal.pitchBend", "Pitch bend 終點 (×)", 0.85, 1.0, 0.005],
    ],
    "Medal Pluck — 包絡 & 音量": [
      ["medal.outGain", "整體音量", 0, 1, 0.01],
      ["medal.gainMin", "低速音量比", 0, 1, 0.01],
      ["medal.gainMax", "全速音量比", 0, 1, 0.01],
      ["medal.attack", "Attack (s)", 0.001, 0.05, 0.001],
      ["medal.decay", "基準 decay (s)", 0.1, 1.5, 0.02],
    ],
    "Medal Pluck — 倍音 (additive sines)": [
      ["medal.p1Ratio", "倍音 1 比例", 0.5, 4, 0.01],
      ["medal.p1Gain", "倍音 1 音量", 0, 1.5, 0.01],
      ["medal.p1Decay", "倍音 1 衰減 (s)", 0.05, 2, 0.02],
      ["medal.p2Ratio", "倍音 2 比例", 0.5, 5, 0.01],
      ["medal.p2Gain", "倍音 2 音量", 0, 1, 0.01],
      ["medal.p2Decay", "倍音 2 衰減 (s)", 0.05, 1.5, 0.02],
      ["medal.p3Ratio", "倍音 3 比例", 0.5, 6, 0.01],
      ["medal.p3Gain", "倍音 3 音量", 0, 1, 0.01],
      ["medal.p3Decay", "倍音 3 衰減 (s)", 0.05, 1, 0.02],
      ["medal.p4Ratio", "倍音 4 比例", 0.5, 9, 0.01],
      ["medal.p4Gain", "倍音 4 音量", 0, 1, 0.01],
      ["medal.p4Decay", "倍音 4 衰減 (s)", 0.05, 1, 0.02],
    ],
    "Medal Pluck — Reverb tail": [
      ["medal.reverbSeconds", "Reverb 尾長 (s)", 0.3, 5, 0.1],
      ["medal.reverbDecay", "Reverb 衰減曲線", 1, 6, 0.1],
      ["medal.wetMix", "Reverb 濕度", 0, 1, 0.01],
    ],
  };

  function getByPath(obj, path) {
    return path.split(".").reduce((o, k) => o && o[k], obj);
  }
  function setByPath(obj, path, value) {
    const parts = path.split(".");
    const last = parts.pop();
    const target = parts.reduce((o, k) => o[k], obj);
    target[last] = value;
  }

  // Continuous sound retrigger helpers — needed when params that only get
  // read at start() time change (like ambient.freq1). For those, stop and
  // restart to hear the new value.
  function restartAmbient(eng) {
    if (eng._ambient) {
      eng.stopAmbient();
      setTimeout(() => eng.startAmbient(), 200);
    }
  }
  function restartTunnel(eng) {
    if (eng._tunnel) {
      const i = 0.7; // arbitrary test intensity
      eng.stopTunnel();
      setTimeout(() => {
        eng.startTunnel();
        eng.setTunnelIntensity(i);
      }, 200);
    }
  }
  // Medal pluck is event-triggered, no continuous state to restart.
  // Params take effect on the NEXT pluck — except reverb (rebuilt at first
  // pluck after stopMotion/clearReverb).
  function clearMedalReverb(eng) {
    if (eng._medalReverb) eng._medalReverb = null;
  }

  const APPLY = {
    master: (eng) => eng.applyMaster(),
    ambient: (eng) => restartAmbient(eng),
    tunnel: (eng) => restartTunnel(eng),
    forge: () => {}, // one-shot
    medal: (eng) => clearMedalReverb(eng), // reverb rebuilds at next pluck
  };

  let pluckTestVel = 0;

  function buildPanel() {
    const panel = document.createElement("div");
    panel.id = "audio-tune-panel";
    panel.style.cssText = `
      position: fixed; top: 0; right: 0; width: 360px; height: 100vh;
      overflow-y: auto; z-index: 99999;
      background: rgba(8,8,12,0.95); backdrop-filter: blur(20px);
      color: #fff; font: 11px/1.4 system-ui, sans-serif;
      padding: 12px; box-sizing: border-box; display: none;
      border-left: 1px solid rgba(255,255,255,0.15);
    `;

    const head = document.createElement("div");
    head.style.cssText =
      "display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px;flex-wrap:wrap;";
    head.innerHTML = `<strong style="font-size:13px">🎚 音效調音 (T 開關)</strong>`;
    const copyBtn = document.createElement("button");
    copyBtn.textContent = "複製 JSON";
    copyBtn.style.cssText =
      "background:#1d6;color:#000;border:0;padding:6px 10px;border-radius:4px;font-size:11px;cursor:pointer;font-weight:600;";
    copyBtn.addEventListener("click", () => {
      const eng = getEngine();
      if (!eng) return;
      const text = JSON.stringify(eng.params, null, 2);
      navigator.clipboard.writeText(text).then(
        () => {
          copyBtn.textContent = "✓ 已複製";
          setTimeout(() => (copyBtn.textContent = "複製 JSON"), 1500);
        },
        () => alert(text),
      );
    });
    const resetBtn = document.createElement("button");
    resetBtn.textContent = "重設預設";
    resetBtn.style.cssText =
      "background:#a44;color:#fff;border:0;padding:6px 10px;border-radius:4px;font-size:11px;cursor:pointer;";
    resetBtn.addEventListener("click", () => {
      const eng = getEngine();
      if (!eng) return;
      eng.params = JSON.parse(JSON.stringify(window.AudioEngine.DEFAULT_PARAMS));
      panel.querySelectorAll("[data-path]").forEach((el) => {
        const v = getByPath(eng.params, el.dataset.path);
        el.value = v;
        const valSpan = el.nextElementSibling;
        if (valSpan && valSpan.classList.contains("val"))
          valSpan.textContent = formatVal(v);
      });
      eng.applyMaster();
      restartAmbient(eng);
      restartTunnel(eng);
      clearMedalReverb(eng);
    });
    head.appendChild(copyBtn);
    head.appendChild(resetBtn);
    panel.appendChild(head);

    // Per-sound playback controls
    const transportSpec = [
      { key: "ambient", label: "Ambient", toggle: true },
      { key: "tunnel", label: "Tunnel (intensity 0.7)", toggle: true },
      { key: "medal", label: "Medal Pluck", oneShot: true, hasSlider: true },
      { key: "forge", label: "Forge bell", oneShot: true },
    ];

    transportSpec.forEach((t) => {
      const row = document.createElement("div");
      row.style.cssText =
        "display:flex;gap:6px;align-items:center;margin-bottom:6px;padding:6px;background:rgba(255,255,255,0.04);border-radius:4px;";
      const lbl = document.createElement("span");
      lbl.textContent = t.label;
      lbl.style.cssText = "flex:1;font-size:11px;";
      row.appendChild(lbl);

      if (t.oneShot) {
        const btn = document.createElement("button");
        btn.textContent = "▶ 觸發";
        btn.style.cssText =
          "background:#357;color:#fff;border:0;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:11px;";
        btn.addEventListener("click", () => {
          const eng = getEngine();
          if (!eng) return;
          if (t.key === "forge") eng.playForgeComplete();
          if (t.key === "medal") eng.playPluck(pluckTestVel || 0.5);
        });
        row.appendChild(btn);
      } else {
        const playBtn = document.createElement("button");
        playBtn.textContent = "▶";
        playBtn.style.cssText =
          "background:#3a7;color:#000;border:0;padding:4px 10px;border-radius:3px;cursor:pointer;font-weight:bold;";
        playBtn.addEventListener("click", () => {
          const eng = getEngine();
          if (!eng) return;
          if (t.key === "ambient") eng.startAmbient();
          if (t.key === "tunnel") {
            eng.startTunnel();
            eng.setTunnelIntensity(0.7);
          }
        });
        const stopBtn = document.createElement("button");
        stopBtn.textContent = "■";
        stopBtn.style.cssText =
          "background:#a44;color:#fff;border:0;padding:4px 10px;border-radius:3px;cursor:pointer;font-weight:bold;";
        stopBtn.addEventListener("click", () => {
          const eng = getEngine();
          if (!eng) return;
          if (t.key === "ambient") eng.stopAmbient();
          if (t.key === "tunnel") eng.stopTunnel();
        });
        row.appendChild(playBtn);
        row.appendChild(stopBtn);
      }
      panel.appendChild(row);

      if (t.hasSlider) {
        // Pluck intensity test slider — 0..1, drives playPluck() directly
        const sliderRow = document.createElement("div");
        sliderRow.style.cssText =
          "display:flex;gap:6px;align-items:center;margin:2px 0 8px 12px;font-size:10px;";
        const sLbl = document.createElement("span");
        sLbl.textContent = "強度";
        sLbl.style.cssText = "width:30px;color:#aaa;";
        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = "0";
        slider.max = "1";
        slider.step = "0.01";
        slider.value = "0.5";
        slider.style.cssText = "flex:1;";
        const val = document.createElement("span");
        val.textContent = "0.50";
        val.style.cssText = "width:48px;text-align:right;font-family:monospace;";
        pluckTestVel = 0.5;
        slider.addEventListener("input", () => {
          pluckTestVel = parseFloat(slider.value);
          val.textContent = pluckTestVel.toFixed(2);
        });
        sliderRow.appendChild(sLbl);
        sliderRow.appendChild(slider);
        sliderRow.appendChild(val);
        panel.appendChild(sliderRow);
      }
    });

    // Build slider sections
    function formatVal(v) {
      if (typeof v !== "number") return String(v);
      if (Math.abs(v) >= 100) return v.toFixed(0);
      if (Math.abs(v) >= 1) return v.toFixed(2);
      return v.toFixed(3);
    }

    Object.entries(SPEC).forEach(([section, params]) => {
      const h = document.createElement("h4");
      h.textContent = section;
      h.style.cssText =
        "margin:14px 0 4px;font-size:11px;color:#9cd;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:3px;";
      panel.appendChild(h);
      params.forEach(([path, label, min, max, step]) => {
        const row = document.createElement("div");
        row.style.cssText =
          "display:grid;grid-template-columns:115px 1fr 50px;gap:6px;align-items:center;margin:2px 0;";
        const lbl = document.createElement("span");
        lbl.textContent = label;
        lbl.style.cssText = "font-size:10px;color:#ccc;";
        const input = document.createElement("input");
        input.type = "range";
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.dataset.path = path;
        const eng = getEngine();
        const current = eng ? getByPath(eng.params, path) : min;
        input.value = String(current);
        const val = document.createElement("span");
        val.className = "val";
        val.textContent = formatVal(current);
        val.style.cssText =
          "font-family:monospace;font-size:10px;color:#fff;text-align:right;";

        input.addEventListener("input", () => {
          const eng = getEngine();
          if (!eng) return;
          const v = parseFloat(input.value);
          setByPath(eng.params, path, v);
          val.textContent = formatVal(v);
          // Apply: master is instant, others restart their continuous sound
          const root = path.split(".")[0];
          if (APPLY[root]) APPLY[root](eng);
        });

        row.appendChild(lbl);
        row.appendChild(input);
        row.appendChild(val);
        panel.appendChild(row);
      });
    });

    document.body.appendChild(panel);
    return panel;
  }

  // Build when DOM ready, toggle with T key
  function setup() {
    const panel = buildPanel();
    window.addEventListener("keydown", (e) => {
      // Ignore if typing in an input
      const tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "t" || e.key === "T") {
        panel.style.display = panel.style.display === "none" ? "block" : "none";
        // Ensure audio is initialized when panel opens
        if (panel.style.display === "block") {
          const eng = getEngine();
          if (eng) {
            eng.init();
            eng.resume();
          }
        }
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
