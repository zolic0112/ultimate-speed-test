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
    "Ambient 空間音": [
      ["ambient.gain", "整體音量", 0, 0.6, 0.01],
      ["ambient.freq1", "低頻 1 (Hz)", 30, 200, 0.5],
      ["ambient.freq2", "低頻 2 (Hz)", 30, 300, 0.5],
      ["ambient.freq3", "低頻 3 (Hz)", 30, 400, 0.5],
      ["ambient.partialGain", "每個 osc 音量", 0, 1, 0.01],
      ["ambient.filterBase", "濾波中心 (Hz)", 80, 2000, 10],
      ["ambient.filterQ", "濾波 Q", 0.1, 5, 0.05],
      ["ambient.lfoRate", "LFO 速度 (Hz)", 0.01, 1, 0.01],
      ["ambient.lfoDepth", "LFO 深度 (Hz)", 0, 800, 5],
    ],
    "Tunnel 隧道穿梭": [
      ["tunnel.maxGain", "最大音量", 0, 0.6, 0.01],
      ["tunnel.gainMult", "音量乘數", 0, 1, 0.01],
      ["tunnel.minFreq", "最低 cutoff (Hz)", 50, 2000, 10],
      ["tunnel.maxFreq", "最高 cutoff (Hz)", 500, 8000, 50],
      ["tunnel.bpQ", "Bandpass Q", 0.1, 8, 0.05],
      ["tunnel.hpFreq", "Highpass (Hz)", 20, 1500, 10],
    ],
    "Forge 鑄造完成": [
      ["forge.baseFreq", "基礎頻率 (Hz)", 100, 2000, 5],
      ["forge.outGain", "整體音量", 0, 1, 0.01],
      ["forge.attack", "Attack (s)", 0.001, 0.1, 0.001],
      ["forge.bendStart", "Pitch bend 起點 (×)", 0.5, 1, 0.01],
      ["forge.bendTime", "Bend 時間 (s)", 0, 0.5, 0.005],
      ["forge.partial1Ratio", "倍音 1 比例", 0.5, 5, 0.01],
      ["forge.partial1Gain", "倍音 1 音量", 0, 1, 0.01],
      ["forge.partial1Decay", "倍音 1 衰減 (s)", 0.1, 4, 0.05],
      ["forge.partial2Ratio", "倍音 2 比例", 0.5, 6, 0.01],
      ["forge.partial2Gain", "倍音 2 音量", 0, 1, 0.01],
      ["forge.partial2Decay", "倍音 2 衰減 (s)", 0.1, 3, 0.05],
      ["forge.partial3Ratio", "倍音 3 比例", 0.5, 8, 0.01],
      ["forge.partial3Gain", "倍音 3 音量", 0, 1, 0.01],
      ["forge.partial3Decay", "倍音 3 衰減 (s)", 0.1, 2, 0.05],
    ],
    "Motion 旋轉嗡鳴": [
      ["motion.baseFreq", "靜止頻率 (Hz)", 30, 400, 1],
      ["motion.maxFreq", "全速頻率 (Hz)", 100, 2000, 5],
      ["motion.detune", "兩波形失諧 (×)", 1, 1.05, 0.001],
      ["motion.minGain", "起音音量", 0, 0.3, 0.005],
      ["motion.maxGain", "全速音量", 0, 0.5, 0.005],
      ["motion.filterBase", "濾波起點 (Hz)", 100, 3000, 20],
      ["motion.filterMax", "濾波頂點 (Hz)", 500, 8000, 50],
      ["motion.filterQ", "濾波 Q", 0.1, 8, 0.05],
      ["motion.sensitivity", "靈敏度", 0.01, 0.5, 0.005],
      ["motion.floor", "靜音門檻", 0, 0.01, 0.0005],
      ["motion.attack", "Pitch 跟隨 (s)", 0.005, 0.5, 0.005],
      ["motion.gainAttack", "Gain 跟隨 (s)", 0.005, 0.5, 0.005],
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
  function restartMotion(eng) {
    if (eng._motion) {
      eng.stopMotion();
      setTimeout(() => eng.startMotion(), 200);
    }
  }

  // What to do after a param changes, depending on which sound it belongs to.
  const APPLY = {
    master: (eng) => eng.applyMaster(),
    ambient: (eng) => restartAmbient(eng),
    tunnel: (eng) => restartTunnel(eng),
    forge: () => {}, // forge is one-shot; play again to hear
    motion: (eng) => restartMotion(eng),
  };

  let motionTestVel = 0;
  let motionTestTimer = null;

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
      restartMotion(eng);
    });
    head.appendChild(copyBtn);
    head.appendChild(resetBtn);
    panel.appendChild(head);

    // Per-sound playback controls
    const transportSpec = [
      { key: "ambient", label: "Ambient", toggle: true },
      { key: "tunnel", label: "Tunnel (intensity 0.7)", toggle: true },
      { key: "motion", label: "Motion (test velocity)", toggle: true, hasSlider: true },
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
          if (eng) eng.playForgeComplete();
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
          if (t.key === "motion") {
            eng.startMotion();
            if (motionTestTimer) clearInterval(motionTestTimer);
            motionTestTimer = setInterval(() => {
              eng.setMotionVelocity(motionTestVel);
            }, 50);
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
          if (t.key === "motion") {
            eng.stopMotion();
            if (motionTestTimer) {
              clearInterval(motionTestTimer);
              motionTestTimer = null;
            }
          }
        });
        row.appendChild(playBtn);
        row.appendChild(stopBtn);
      }
      panel.appendChild(row);

      if (t.hasSlider) {
        // Motion velocity test slider — simulates angular speed
        const sliderRow = document.createElement("div");
        sliderRow.style.cssText =
          "display:flex;gap:6px;align-items:center;margin:2px 0 8px 12px;font-size:10px;";
        const sLbl = document.createElement("span");
        sLbl.textContent = "速度";
        sLbl.style.cssText = "width:30px;color:#aaa;";
        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = "0";
        slider.max = "0.2";
        slider.step = "0.001";
        slider.value = "0";
        slider.style.cssText = "flex:1;";
        const val = document.createElement("span");
        val.textContent = "0.000";
        val.style.cssText = "width:48px;text-align:right;font-family:monospace;";
        slider.addEventListener("input", () => {
          motionTestVel = parseFloat(slider.value);
          val.textContent = motionTestVel.toFixed(3);
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
