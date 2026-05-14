/* ============================================================
   Ultimate Speed Test — app wiring
   - Shader background (ShaderRenderer)
   - SpeedTest flow
   - HUD updates, sparkline, stepper, grade, benchmarks
   - History (localStorage), share, tweaks
   ============================================================ */

window.onload = init;

function init() {
  // ── PWA Diagnostics ────────────────────────────────────────────────────
  // Log installation status to help debug PWA mode issues.
  const isStandalone = navigator.standalone === true;
  const hasDisplay = window.matchMedia("(display-mode: standalone)").matches;
  console.log(`[PWA] standalone: ${isStandalone}, display-mode: ${hasDisplay ? "standalone" : "browser"}`);
  console.log(`[PWA] viewport: ${window.innerWidth}×${window.innerHeight}, dpr: ${devicePixelRatio}`);
  console.log(`[PWA] screen: ${screen.width}×${screen.height}`);
  if (typeof navigator.serviceWorker !== "undefined") {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      console.log(`[PWA] service workers: ${regs.length} registered`);
      regs.forEach((r) => console.log(`  - scope: ${r.scope}`));
    });
  }

  const body = document.body;

  // ── i18n initialization ─────────────────────────────────────────────────
  const applyTranslations = () => {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const html = I18N.get(key);
      // For elements that might have inner elements (like <em>), we should be careful.
      // If the element has children, only update the text nodes, otherwise replace all.
      if (el.children.length === 0) {
        el.textContent = html;
      } else {
        // Has children, try to preserve them but update text content where possible.
        // For now, just set innerHTML if the translation has markup.
        if (html.includes("<")) {
          el.innerHTML = html;
        } else {
          el.textContent = html;
        }
      }
    });
  };

  const setupLanguageSwitcher = () => {
    const updateDocumentLang = (lang) => {
      document.documentElement.lang = lang;
      document.documentElement.setAttribute("data-lang", lang);
    };

    const langs = I18N.getAll();
    const langBtn = document.createElement("button");
    langBtn.className = "v3-icon-btn";
    langBtn.id = "nav-lang";
    langBtn.setAttribute("aria-label", "Language");
    const labelFor = (lang) =>
      // "zh-TW" → "ZH" so the chip stays one line on narrow phones.
      lang.split("-")[0].toUpperCase();
    langBtn.innerHTML = `<span style="font-size: 14px; font-weight: 500;">${labelFor(I18N.getLang())}</span>`;

    updateDocumentLang(I18N.getLang());

    langBtn.addEventListener("click", () => {
      const currentLang = I18N.getLang();
      const langIndex = langs.indexOf(currentLang);
      const nextIndex = (langIndex + 1) % langs.length;
      const nextLang = langs[nextIndex];
      I18N.setLang(nextLang);
      langBtn.innerHTML = `<span style="font-size: 14px; font-weight: 500;">${nextLang.toUpperCase()}</span>`;
      updateDocumentLang(nextLang);
      applyTranslations();
    });

    const navContainer = document.querySelector(".v3-chrome.tr");
    if (navContainer) {
      navContainer.insertBefore(langBtn, navContainer.firstChild);
    }
  };

  applyTranslations();
  setupLanguageSwitcher();

  // ── Breakpoint detection ────────────────────────────────────────────────
  // Drives the v3 responsive layout via CSS [data-bp="mobile|tablet|desktop"].
  // Also feeds media-query-safe size variants without duplicating markup.
  const setBreakpoint = () => {
    const w = window.innerWidth;
    body.dataset.bp = w < 768 ? "mobile" : w < 1024 ? "tablet" : "desktop";
    placeMedalCanvas();
  };

  // ── Medal canvas re-parenting ─────────────────────────────────────
  // On mobile, the design has the medal as a fixed-size inline element in
  // the screen's column stack rather than a fullscreen overlay. We move the
  // same canvas DOM node in/out of a `.v3-medal-slot` div inside whichever
  // screen is currently active. Three.js keeps rendering across the move;
  // only _resize() has to fire so the new bounding rect is picked up.
  //
  // Sizes (set in CSS via the slot's data-bp + screen scope):
  //   #screen-idle    .v3-medal-slot → 260×260
  //   #screen-result  .v3-medal-slot → 300×300
  //
  // Testing intentionally keeps the fullscreen overlay even on mobile —
  // the lightspeed streaks emanate from the centre of the canvas, so the
  // medal MUST be centred-fullscreen to read as 'sitting inside the tunnel'.
  // The dim filter (set elsewhere) keeps it from competing with the number.
  const INLINEABLE_PHASES = new Set(["idle", "result"]);
  const placeMedalCanvas = () => {
    const c = document.getElementById("medal-canvas");
    if (!c) return;
    const phase = body.dataset.phase || "idle";
    const activeScreen = document.getElementById(`screen-${phase}`);
    const slot =
      body.dataset.bp === "mobile" &&
      INLINEABLE_PHASES.has(phase) &&
      activeScreen
        ? activeScreen.querySelector(".v3-medal-slot")
        : null;
    const isInline = c.classList.contains("inline");

    if (slot && c.parentNode !== slot) {
      slot.appendChild(c);
      c.classList.add("inline");
    } else if (!slot && isInline) {
      body.appendChild(c);
      c.classList.remove("inline");
    } else {
      return; // no change needed
    }
    // Force the renderer to read the new size on the next frame.
    // (typeof guard avoids a TDZ ReferenceError when this is called before
    // `let medal` has been initialised — e.g. from the first setBreakpoint().)
    requestAnimationFrame(() => {
      try {
        if (typeof medal !== "undefined" && medal && medal._resize)
          medal._resize();
      } catch {}
    });
  };

  setBreakpoint();
  window.addEventListener("resize", setBreakpoint);
  // ---------- Shader background ----------
  // Mobile fillrate is the bottleneck — drop the shader resolution further
  // (0.4x vs 0.5x desktop) so the GPU isn't shading 3M+ fragments at 60 fps.
  const isMobileDevice =
    innerWidth < 768 ||
    (matchMedia && matchMedia("(pointer: coarse)").matches);
  const dpr = Math.max(
    1,
    (isMobileDevice ? 0.4 : 0.5) * devicePixelRatio,
  );
  const canvas = document.getElementById("bg");
  // Force-extend the fullscreen canvases past every safe-area on iOS PWA
  // standalone. Even screen.height on some iOS builds doesn't include the
  // home indicator strip — over-shoot by 120px in both directions so the
  // canvas physically covers any conceivable safe-area combination.
  // (The extra pixels are off-screen for normal layouts, GPU shades a tiny
  // bit extra but it's negligible compared to seeing a black bar.)
  const BLEED = 400; // 400px bleed: enough to cover home indicator on any iOS
  const forceFullBleed = () => {
    // Use the LARGEST of all available dimension sources, since each one
    // can under-report in different iOS PWA situations:
    //   screen.{w,h}          → physical pixels (usually largest)
    //   innerWidth/Height     → CSS pixels of viewport (excludes safe-area on iOS)
    //   documentElement       → may match either
    const w = Math.max(
      screen.width || 0,
      innerWidth || 0,
      document.documentElement.clientWidth || 0,
    );
    const h = Math.max(
      screen.height || 0,
      innerHeight || 0,
      document.documentElement.clientHeight || 0,
    );
    const totalW = w + BLEED;
    const totalH = h + BLEED;

    // Background shader canvas.
    // iOS Safari clips `position: fixed` elements to the VISUAL viewport
    // (innerHeight = 797 on iPhone 14, missing the 47px home-indicator strip
    // even though screen.height = 844). Switching to `position: absolute`
    // anchored to <html> (which spans the LAYOUT viewport including
    // safe-area) is the only reliable escape from the clip.
    const c = canvas;
    c.style.setProperty("width", totalW + "px", "important");
    c.style.setProperty("height", totalH + "px", "important");
    c.style.setProperty("position", "absolute", "important");
    c.style.setProperty("top", -BLEED / 2 + "px", "important");
    c.style.setProperty("left", -BLEED / 2 + "px", "important");
    c.style.setProperty("right", "auto", "important");
    c.style.setProperty("bottom", "auto", "important");
    // Force compositing layer so the canvas can render past viewport bounds.
    c.style.setProperty("transform", "translateZ(0)", "important");
    c.style.zIndex = "0";

    // Medal canvas: DON'T set any inline styles. Let CSS fully control
    // its size — fullscreen (100vw/vh) when overlay, 100% of slot when
    // .inline. Setting inline-style !important earlier was sticking even
    // after the medal moved into a slot, preventing CSS from re-sizing it
    // and causing the 3D model to balloon on the result screen.
    const medalC = document.getElementById("medal-canvas");
    if (medalC) {
      // Clear any leftover inline styles from previous versions
      [
        "width",
        "height",
        "position",
        "top",
        "left",
        "right",
        "bottom",
      ].forEach((p) => medalC.style.removeProperty(p));
    }

    // Visible debug overlay (top-left corner, tiny text).
    // Tap to dismiss. Helps diagnose what dimensions are actually used.
    let dbg = document.getElementById("layout-dbg");
    if (!dbg) {
      dbg = document.createElement("div");
      dbg.id = "layout-dbg";
      dbg.style.cssText =
        "position:fixed;top:env(safe-area-inset-top,0);left:0;z-index:9999;background:rgba(0,0,0,.7);color:#0f0;font:9px/1.2 monospace;padding:3px 5px;pointer-events:auto;max-width:60vw;border-bottom-right-radius:4px";
      dbg.addEventListener("click", () => dbg.remove());
      document.body.appendChild(dbg);
    }
    const standalone =
      navigator.standalone ||
      window.matchMedia("(display-mode: standalone)").matches;
    dbg.textContent =
      `v71 PWA:${standalone ? "Y" : "N"} ` +
      `scr:${screen.width}×${screen.height} ` +
      `inr:${innerWidth}×${innerHeight} ` +
      `cnv:${totalW}×${totalH} off:-${BLEED / 2}`;

    console.log(
      `[layout] screen: ${w}×${h}, canvas: ${totalW}×${totalH}, offset: -${BLEED / 2}px`,
    );
  };
  forceFullBleed();
  window.addEventListener("resize", forceFullBleed);
  window.addEventListener("orientationchange", () =>
    setTimeout(forceFullBleed, 100),
  );

  const resize = () => {
    forceFullBleed();
    // GL buffer size matches the inline-styled CSS pixels (with dpr).
    const w =
      Math.max(
        screen.width || 0,
        innerWidth || 0,
        document.documentElement.clientWidth || 0,
      ) + BLEED;
    const h =
      Math.max(
        screen.height || 0,
        innerHeight || 0,
        document.documentElement.clientHeight || 0,
      ) + BLEED;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    if (renderer) {
      renderer.updateScale(dpr);
      // Tell shader the viewport-relative scale so the tunnel stays the same
      // size as before we bled the canvas past the home indicator.
      // (R uniform stays = canvas dims so the center remains at viewport center.)
      renderer.setRenderScale(Math.min(innerWidth, innerHeight) * dpr);
    }
  };
  // .trim() is critical: the auto-formatter may indent the shader block,
  // and GLSL requires #version to be the very first token (no leading whitespace).
  let source = document.getElementById("frag").textContent.trim();
  // Lightspeed inner loop runs 20 iterations per fragment. That's ~40M
  // sin/cos calls per frame at 1080p — too much for mid-range phones.
  // Reduce to 7 on mobile: still gives the lightspeed feel, but trades a bit
  // of particle density for smooth 60fps during testing.
  if (isMobileDevice) {
    source = source.replace("i++<20.", "i++<7.");
  }
  const renderer = new ShaderRenderer(canvas, dpr);
  renderer.setup();
  renderer.init();
  resize();
  const shaderError = renderer.test(source);
  if (shaderError === null) {
    renderer.updateShader(source);
  } else {
    console.error(
      "[shader] Compile failed — falling back to default UV gradient.",
    );
    console.error("[shader] Error:", shaderError.slice(0, 300));
    console.error(
      "[shader] Source starts with:",
      JSON.stringify(source.slice(0, 60)),
    );
  }
  window.onresize = resize;

  // ---------- Pointer tracking (throttled) ----------
  const pointerState = { x: 0, y: 0, count: 1 };
  let lastPointerUpdate = 0;
  const POINTER_THROTTLE_MS = 16; // Update at most once per frame (60 fps)
  window.addEventListener("pointermove", (e) => {
    const now = performance.now();
    if (now - lastPointerUpdate < POINTER_THROTTLE_MS) return;
    lastPointerUpdate = now;

    const x = (e.clientX / innerWidth) * 2 - 1;
    const y = 1 - (e.clientY / innerHeight) * 2;
    pointerState.x = x;
    pointerState.y = y;
    renderer.updateMouse([x, y]);
    renderer.updatePointerCoords([x, y]);
    const ptr = document.getElementById("hud-ptr");
    if (ptr)
      ptr.textContent = `${x >= 0 ? "+" : ""}${x.toFixed(2)}, ${y >= 0 ? "+" : ""}${y.toFixed(2)}`;
  });
  renderer.updatePointerCount(1);

  // ---------- Shader uniforms state ----------
  // phase is continuous (0 idle, 1 testing, 2 result); burst is a one-shot fade (1→0 over ~1s)
  const shaderState = { speed: 0.0, phase: 0.0, phaseTarget: 0.0, burst: 0.0 };
  const tweaks = loadTweaks();
  applyDensity(tweaks.density);

  renderer.setExtraUniformProvider(() => ({
    speed: Math.min(shaderState.speed * tweaks.intensity, 1.0),
    phase: shaderState.phase,
    burst: shaderState.burst,
  }));

  // ---------- Render loop ----------
  let lastT = 0;
  const loop = (now) => {
    const dt = Math.min(0.05, (now - lastT) / 1000 || 0);
    lastT = now;

    // Smoothly interpolate phase toward target
    shaderState.phase +=
      (shaderState.phaseTarget - shaderState.phase) * Math.min(1, dt * 2.0);

    // Decay burst (~1.1s lifetime)
    if (shaderState.burst > 0.001)
      shaderState.burst = Math.max(0, shaderState.burst - dt * 0.9);
    else shaderState.burst = 0;

    if (shaderState.phaseTarget < 0.5) {
      // idle — starfield, tiny breathing
      shaderState.speed = 0.04 + 0.02 * Math.sin(now * 0.0007);
    } else if (shaderState.phaseTarget > 1.5) {
      // result — near zero, embers only
      shaderState.speed *= 0.95;
    }

    const hs = document.getElementById("hud-shader");
    if (hs)
      hs.textContent = (shaderState.speed * tweaks.intensity).toFixed(2) + "×";
    renderer.render(now);
    requestAnimationFrame(loop);
  };
  loop(0);

  // ---------- Clock ----------
  const clock = document.getElementById("foot-clock");
  const tick = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    clock.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} UTC${d.getTimezoneOffset() <= 0 ? "+" : "-"}${pad(Math.abs(d.getTimezoneOffset() / 60) | 0)}`;
  };
  tick();
  setInterval(tick, 1000);

  // ---------- Medal (three.js) ----------
  const medalCanvas = document.getElementById("medal-canvas");
  let medal = null;
  try {
    if (window.Medal) medal = new Medal(medalCanvas);
  } catch (e) {
    console.warn("[medal]", e);
  }

  // ── Preload common grade medals with staggering ────────────────────────
  // Loading all 6 models in parallel (24-42 MB) caused performance lag on mobile.
  // Instead: load only A/B/C (covers ~90% of real-world speeds) with delays
  // to spread CPU/network work and prevent main-thread blocking.
  if (medal && typeof medal.preloadModel === "function") {
    // Stagger loads: first grade starts at 500ms, then each +800ms apart
    // This spreads decoding work across multiple animation frames
    const grades = ["A", "B", "C"];
    let delay = 500;
    grades.forEach((g) => {
      setTimeout(() => medal.preloadModel(g), delay);
      delay += 800;
    });
  }

  // ---------- Screens ----------
  const screens = {
    idle: document.getElementById("screen-idle"),
    testing: document.getElementById("screen-testing"),
    result: document.getElementById("screen-result"),
  };
  const showScreen = (name) => {
    Object.entries(screens).forEach(([k, el]) =>
      el.classList.toggle("active", k === name),
    );
    body.dataset.phase = name;
    placeMedalCanvas(); // re-parent canvas if entering/leaving mobile result
    const hp = document.getElementById("hud-phase");
    if (hp) hp.textContent = name.toUpperCase();
    // Medal is interactive on idle + result; testing keeps it passive
    // so the user can't accidentally interrupt the live readout's framing.
    if (medal) medal.setActive(name === "result" || name === "idle");
  };
  showScreen("idle");

  // ---------- Utils ----------
  const $ = (id) => document.getElementById(id);
  const fmt = (v, d = 2) => Number(v).toFixed(d);
  const setLive = (value, unit, d = 2) => {
    $("live-value").textContent = fmt(value, d);
    $("live-unit").textContent = unit;
  };
  const setStep = (name, state /* 'active'|'done' */, p = 0) => {
    document.querySelectorAll(".step").forEach((s) => {
      if (s.dataset.step === name) {
        s.classList.remove("done", "active");
        s.classList.add(state);
        s.style.setProperty("--p", p);
      }
    });
  };
  const markDone = (name) => {
    const el = document.querySelector(`.step[data-step="${name}"]`);
    if (el) {
      el.classList.remove("active");
      el.classList.add("done");
      el.style.setProperty("--p", 1);
    }
  };

  // ---------- Sparkline ----------
  const sparkLine = $("spark-line");
  const sparkFill = $("spark-fill");
  const sparkData = [];
  const pushSpark = (mbps) => {
    sparkData.push(mbps);
    if (sparkData.length > 80) sparkData.shift();
    const max = Math.max(1, ...sparkData);
    const W = 200,
      H = 48;
    const pts = sparkData.map((v, i) => {
      const x = (i / Math.max(1, sparkData.length - 1)) * W;
      const y = H - (v / max) * (H - 4) - 2;
      return [x, y];
    });
    const line = pts
      .map(
        (p, i) =>
          (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1),
      )
      .join(" ");
    const fill = line + ` L${W},${H} L0,${H} Z`;
    sparkLine.setAttribute("d", line);
    sparkFill.setAttribute("d", fill);
  };
  const resetSpark = () => {
    sparkData.length = 0;
    sparkLine.setAttribute("d", "");
    sparkFill.setAttribute("d", "");
  };

  // ---------- Test flow ----------
  let peakMbps = 0,
    totalBytes = 0,
    sampleCount = 0,
    t0 = 0;
  let elapsedTimer = null;

  const resetTelemetry = () => {
    peakMbps = 0;
    totalBytes = 0;
    sampleCount = 0;
    t0 = performance.now();
    $("hud-peak").textContent = "0.00 Mbps";
    $("hud-avg").textContent = "0.00 Mbps";
    $("hud-samples").textContent = "0";
    $("hud-bytes").textContent = "0 MB";
    $("hud-elapsed").textContent = "00.0s";
    $("hud-sid").textContent = Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase();
    resetSpark();
    document.querySelectorAll(".step").forEach((s) => {
      s.classList.remove("active", "done");
      s.style.setProperty("--p", 0);
    });
    $("progress-fill").style.width = "0%";
  };

  const startTest = async () => {
    showScreen("testing");
    shaderState.phaseTarget = 1.0;
    shaderState.speed = 0.0;
    shaderState.burst = 0.0;
    // Reset medal to procedural puck so the GLB from a prior run is cleared.
    if (medal) {
      medal.reset();
      // Begin testing phase — medal will fade from transparent to solid.
      medal.startTesting();
    }
    resetTelemetry();
    if (elapsedTimer) clearInterval(elapsedTimer);
    elapsedTimer = setInterval(() => {
      const e = (performance.now() - t0) / 1000;
      $("hud-elapsed").textContent = e.toFixed(1) + "s";
    }, 100);

    const test = new SpeedTest();

    // Track best-known values per phase so we can still produce a result
    // even if a later phase fails (e.g. sandboxed CORS blocks upload).
    const partial = { ping: 0, jitter: 0, download: 0, upload: 0 };

    // Tracks whether upload was unmeasurable due to CORS/network.
    // Set by the 'warning' event; consumed in finaliseResults.
    let uploadBlocked = false;
    test.on("warning", ({ type }) => {
      if (type === "upload-unmeasurable") {
        uploadBlocked = true;
        $("live-caption").textContent =
          "UPLOAD SIGNAL BLOCKED · CORS RESTRICTION";
      }
    });

    test.on("phase", ({ phase }) => {
      if (phase === "ping") {
        setStep("ping", "active", 0.05);
        $("live-caption").textContent = "MEASURING LATENCY";
        setLive(0, "ms", 1);
      } else if (phase === "download") {
        markDone("ping");
        setStep("download", "active", 0.05);
        $("live-caption").textContent = "DOWNSTREAM · 6 PARALLEL STREAMS";
        setLive(0, "Mbps");
        peakMbps = 0;
        resetSpark();
      } else if (phase === "upload") {
        markDone("download");
        setStep("upload", "active", 0.05);
        $("live-caption").textContent = "UPSTREAM · 4 PARALLEL STREAMS";
        setLive(0, "Mbps");
        peakMbps = 0;
        resetSpark();
        // Pre-warm the medal model for the predicted grade so it's ready
        // by the time the upload phase ends (~10s of free background bandwidth).
        if (medal && partial.download > 0) {
          const predicted = gradeFor(partial.download).letter;
          medal.preloadModel(predicted);
        }
      }
    });

    test.on("progress", ({ phase, mbps, progress, ping }) => {
      sampleCount++;
      $("hud-samples").textContent = sampleCount;
      const pctTotal =
        phase === "ping"
          ? progress * 0.2
          : phase === "download"
            ? 0.2 + progress * 0.45
            : 0.65 + progress * 0.35;
      $("progress-fill").style.width = (pctTotal * 100).toFixed(1) + "%";

      const step = document.querySelector(`.step[data-step="${phase}"]`);
      if (step) step.style.setProperty("--p", progress);

      if (phase === "ping") {
        if (ping != null) {
          setLive(ping, "ms", 1);
          partial.ping = ping;
        }
        shaderState.speed = 0.15 + Math.min(ping || 0, 200) / 400;
      } else {
        setLive(mbps, "Mbps");
        if (mbps > peakMbps) peakMbps = mbps;
        if (phase === "download")
          partial.download = Math.max(partial.download, mbps);
        if (phase === "upload") partial.upload = Math.max(partial.upload, mbps);
        // v3 chips show the unit separately, so write numbers only.
        $("hud-peak").textContent = peakMbps.toFixed(1);
        const elapsed = Math.max(0.1, (performance.now() - t0) / 1000);
        $("hud-avg").textContent = mbps.toFixed(1);
        $("hud-bytes").textContent = ((mbps * elapsed) / 8).toFixed(1) + " MB";
        pushSpark(mbps);
        shaderState.speed = Math.min(mbps / 800, 1.0);
      }
    });

    // Shared finalisation — runs for both a clean 'done' and a partial error.
    let finalised = false;
    const finaliseResults = (results, { incomplete = false } = {}) => {
      if (finalised) return;
      finalised = true;
      markDone("upload");
      if (elapsedTimer) clearInterval(elapsedTimer);

      // Populate result
      $("r-down").textContent = fmt(results.download, 2);
      // Show 'N/A' if upload was blocked by CORS (rather than misleading '0.00')
      $("r-up").textContent =
        uploadBlocked && results.upload === 0 ? "N/A" : fmt(results.upload, 2);
      $("r-ping").textContent = fmt(results.ping, 1);
      $("r-jitter").textContent = fmt(results.jitter, 1);

      const d = new Date();
      $("result-date").textContent = d
        .toLocaleString("en-US", {
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
        .toUpperCase();

      const { letter, title, desc } = gradeFor(results.download);
      $("grade-letter").textContent = letter;
      // Translate grade title based on letter
      const gradeKey = `grade.${letter.toLowerCase()}`;
      $("grade-title").textContent = I18N.get(gradeKey);
      $("grade-desc").textContent = incomplete
        ? "Partial result · upload blocked"
        : desc;
      // v3: update data-grade on the pill so CSS applies the right badge colour
      const pill = $("grade-pill");
      if (pill) pill.dataset.grade = letter;

      if (medal)
        medal.setGrade(
          letter,
          title,
          d.getTime().toString(36).slice(-4).toUpperCase(),
        );

      document.querySelectorAll(".bench-row").forEach((row) => {
        const min = Number(row.dataset.min);
        const ok = results.download >= min;
        row.classList.toggle("on", ok);
        row.classList.toggle("off", !ok);
        row.querySelector(".bench-check").classList.toggle("on", ok);
      });

      saveHistory({ at: d.toISOString(), ...results, grade: letter });

      // Cinematic handoff: flash + shockwave ring + medal spring-in.
      // End the testing phase and trigger the spring-in animation.
      shaderState.burst = 1.0;
      if (medal) {
        medal.endTesting();
        medal.burstIn();
      }
      setTimeout(() => {
        shaderState.phaseTarget = 2.0;
        shaderState.speed = Math.min(results.download / 1000, 0.5);
        showScreen("result");
      }, 280);
    };

    test.on("done", (results) => finaliseResults(results));

    test.on("error", (err) => {
      console.error("[test]", err);
      $("live-caption").textContent = "UPLINK BLOCKED — SHOWING PARTIAL";
      finaliseResults({ ...partial }, { incomplete: true });
    });

    try {
      await test.run();
    } catch (e) {
      // Swallowed — error handler above has already finalised.
    }
  };

  // ---------- Grading ----------
  function gradeFor(down) {
    if (down >= 500)
      return {
        letter: "S",
        title: "LIGHTSPEED",
        desc: "Top tier · fibre class",
      };
    if (down >= 200)
      return { letter: "A", title: "EXCELLENT", desc: "Gigabit territory" };
    if (down >= 80)
      return { letter: "B", title: "STRONG", desc: "Premium broadband" };
    if (down >= 25)
      return { letter: "C", title: "STEADY", desc: "Solid everyday link" };
    if (down >= 5)
      return { letter: "D", title: "LIMITED", desc: "Basic connectivity" };
    return { letter: "F", title: "CRITICAL", desc: "Below threshold" };
  }

  // ---------- History ----------
  const HKEY = "ust:history";
  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(HKEY) || "[]");
    } catch {
      return [];
    }
  }
  function saveHistory(entry) {
    const list = loadHistory();
    list.unshift(entry);
    localStorage.setItem(HKEY, JSON.stringify(list.slice(0, 30)));
    renderHistory();
  }
  function renderHistory() {
    const list = loadHistory();
    const el = $("history-list");
    if (!list.length) {
      el.innerHTML = '<div class="v3-history-empty">NO RUNS YET</div>';
      return;
    }
    el.innerHTML = list
      .map((h) => {
        const d = new Date(h.at);
        const t = d
          .toLocaleString("en-US", {
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
          .toUpperCase();
        const up = h.upload > 0 ? fmt(h.upload, 1) : "N/A";
        return `<div class="v3-history-item">
          <div class="v3-history-meta">${t} · GRADE ${h.grade || "—"}</div>
          <div class="v3-history-metrics">
            <div class="v3-history-pair"><span class="val">${fmt(h.download, 1)}</span><span class="lbl">DOWN</span></div>
            <div class="v3-history-pair"><span class="val">${up}</span><span class="lbl">UP</span></div>
            <div class="v3-history-pair"><span class="val">${fmt(h.ping, 0)}</span><span class="lbl">PING</span></div>
            <div class="v3-history-pair"><span class="val">${fmt(h.jitter, 0)}</span><span class="lbl">JIT</span></div>
          </div>
        </div>`;
      })
      .join("");
  }
  renderHistory();

  const drawer = $("history-drawer");
  const openDrawer = () => {
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
  };
  const closeDrawer = () => {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
  };
  $("nav-history").addEventListener("click", openDrawer);
  $("btn-history").addEventListener("click", openDrawer);
  $("drawer-close").addEventListener("click", closeDrawer);

  // ---------- About drawer ----------
  const aboutDrawer = $("about-drawer");
  const openAbout = () => {
    aboutDrawer.classList.add("open");
    aboutDrawer.setAttribute("aria-hidden", "false");
  };
  const closeAbout = () => {
    aboutDrawer.classList.remove("open");
    aboutDrawer.setAttribute("aria-hidden", "true");
  };
  $("nav-about").addEventListener("click", openAbout);
  $("about-close").addEventListener("click", closeAbout);

  // ---------- Share ----------
  const toast = $("toast");
  const showToast = (msg) => {
    toast.textContent = msg;
    toast.classList.add("on");
    setTimeout(() => toast.classList.remove("on"), 1600);
  };
  // ── Share modal wiring ─────────────────────────────────────────────
  // The share button no longer hands directly to the OS share sheet.
  // Instead it generates a card, displays it in our own in-app modal,
  // and lets the user pick between Download / Copy / Native share.
  // This gives us a consistent look across platforms (Windows, macOS,
  // iOS, Android all show the same UI) and lets us use the proper
  // ClipboardItem API for image-on-clipboard pastes that actually work
  // in Word, chat clients, image editors etc.
  const shareModal = $("share-modal");
  const sharePreview = $("share-modal-preview");
  const shareHint = $("share-modal-hint");
  let shareCardCanvas = null; // the most recently built card

  const openShareModal = () => {
    shareModal.classList.add("open");
    shareModal.setAttribute("aria-hidden", "false");
  };
  const closeShareModal = () => {
    shareModal.classList.remove("open");
    shareModal.setAttribute("aria-hidden", "true");
    // Drop the canvas reference so the GC can reclaim it
    shareCardCanvas = null;
    // Clear preview after the close animation finishes
    setTimeout(() => {
      if (!shareModal.classList.contains("open")) sharePreview.innerHTML = "";
    }, 300);
  };

  $("share-modal-close").addEventListener("click", closeShareModal);
  $("share-modal-backdrop").addEventListener("click", closeShareModal);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && shareModal.classList.contains("open")) {
      closeShareModal();
    }
  });

  // Hide capability-gated buttons up front. Don't probe in the click
  // handler — we want the layout to settle once.
  if (window.ShareCard) {
    if (!window.ShareCard.canCopyImage())
      $("share-action-copy").hidden = true;
    if (!window.ShareCard.canNativeShare())
      $("share-action-native").hidden = true;
  }

  $("btn-share").addEventListener("click", () => {
    // Pull the live result values straight off the DOM so the share
    // image matches exactly what the user sees on the result screen.
    const results = {
      download: $("r-down").textContent,
      upload: $("r-up").textContent,
      ping: $("r-ping").textContent,
    };
    const grade = {
      letter: $("grade-letter").textContent,
      title: $("grade-title").textContent,
    };
    const uploadBlocked = results.upload === "N/A";

    // Build the card synchronously (no async needed for the image step)
    if (!window.ShareCard || !medal || typeof medal.captureFrame !== "function") {
      // Final-ditch fallback to text copy if anything's missing
      const text = `ULTIMATE SPEED TEST — ${results.download} Mbps ↓ · ${results.upload}${uploadBlocked ? "" : " Mbps"} ↑ · ${results.ping} ms · Grade ${grade.letter}`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => showToast(I18N.get("toast.copied")));
      } else {
        showToast(text);
      }
      return;
    }

    try {
      const medalFrame = medal.captureFrame(1024);
      shareCardCanvas = window.ShareCard.build({
        medalCanvas: medalFrame,
        results,
        grade,
        uploadBlocked,
      });
      // Mount the canvas itself into the preview (no encoding overhead)
      sharePreview.innerHTML = "";
      sharePreview.appendChild(shareCardCanvas);
      shareHint.textContent = I18N.get("share.modal.hint");
      openShareModal();
    } catch (err) {
      console.warn("[share] card build failed:", err);
      showToast(I18N.get("toast.shareFailed"));
    }
  });

  // ── Modal action buttons ───────────────────────────────────────────
  $("share-action-download").addEventListener("click", async () => {
    if (!shareCardCanvas) return;
    try {
      await window.ShareCard.download(shareCardCanvas);
      shareHint.textContent = "Saved to your downloads folder.";
    } catch (err) {
      console.warn("[share] download failed:", err);
      shareHint.textContent = "Download failed — try again?";
    }
  });

  $("share-action-copy").addEventListener("click", async () => {
    if (!shareCardCanvas) return;
    try {
      await window.ShareCard.copyToClipboard(shareCardCanvas);
      shareHint.textContent = "Copied! Paste anywhere — Word, chat, mail.";
    } catch (err) {
      console.warn("[share] copy failed:", err);
      shareHint.textContent = "Copy not allowed — try Download instead.";
    }
  });

  $("share-action-native").addEventListener("click", async () => {
    if (!shareCardCanvas) return;
    const text = `ULTIMATE SPEED TEST — ${$("r-down").textContent} Mbps ↓ · ${$("r-up").textContent} Mbps ↑ · ${$("r-ping").textContent} ms · Grade ${$("grade-letter").textContent}`;
    try {
      const status = await window.ShareCard.nativeShare(shareCardCanvas, text);
      if (status === "shared") {
        shareHint.textContent = "Shared.";
        // Auto-close after a successful share so they're not stuck staring at the dialog
        setTimeout(closeShareModal, 600);
      } else if (status === "cancelled") {
        shareHint.textContent = "Share cancelled.";
      }
    } catch (err) {
      console.warn("[share] native share failed:", err);
      shareHint.textContent = "Share unavailable — use Download or Copy.";
    }
  });

  // ---------- About ----------
  // nav-about now opens the about drawer (wired above)

  // ---------- Buttons ----------
  $("btn-start").addEventListener("click", startTest);
  $("btn-restart").addEventListener("click", startTest);
  // Cancel: reload the page to abort the running test cleanly.
  // A proper abort-controller approach can be wired later.
  const btnCancel = $("btn-cancel");
  if (btnCancel) btnCancel.addEventListener("click", () => location.reload());
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && body.dataset.phase === "idle") {
      e.preventDefault();
      startTest();
    }
    if (e.code === "Escape") {
      if (drawer.classList.contains("open")) closeDrawer();
      if (aboutDrawer.classList.contains("open")) closeAbout();
    }
  });

  // ---------- Tweaks ----------
  function loadTweaks() {
    return Object.assign({}, TWEAK_DEFAULTS);
  }
  function applyDensity(d) {
    body.dataset.density = d;
    document.querySelectorAll("#tweaks-panel .seg button").forEach((b) => {
      b.classList.toggle("on", b.dataset.density === d);
    });
  }

  const tPanel = document.getElementById("tweaks-panel");
  const tIntensity = document.getElementById("tw-intensity");
  const tIntensityVal = document.getElementById("tw-i-val");
  tIntensity.value = tweaks.intensity;
  tIntensityVal.textContent = tweaks.intensity.toFixed(1) + "×";
  tIntensity.addEventListener("input", () => {
    tweaks.intensity = parseFloat(tIntensity.value);
    tIntensityVal.textContent = tweaks.intensity.toFixed(1) + "×";
    window.parent.postMessage(
      { type: "__edit_mode_set_keys", edits: { intensity: tweaks.intensity } },
      "*",
    );
  });
  document.querySelectorAll("#tweaks-panel .seg button").forEach((b) => {
    b.addEventListener("click", () => {
      tweaks.density = b.dataset.density;
      applyDensity(tweaks.density);
      window.parent.postMessage(
        { type: "__edit_mode_set_keys", edits: { density: tweaks.density } },
        "*",
      );
    });
  });

  // Tweaks host protocol — register listener FIRST, then announce
  window.addEventListener("message", (e) => {
    const t = e.data && e.data.type;
    if (t === "__activate_edit_mode") tPanel.classList.add("on");
    else if (t === "__deactivate_edit_mode") tPanel.classList.remove("on");
  });
  try {
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
  } catch {}
}
