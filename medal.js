/* ============================================================
   Medal — 3D obsidian/alloy puck · Ultimate Speed Test
   Supports loading external glTF/GLB models per grade.
   Falls back gracefully to a procedural puck if unavailable.
   Pure three.js — no OrbitControls required.
   ============================================================ */
(function () {
  if (!window.THREE) {
    console.warn("[medal] THREE not loaded");
    return;
  }
  const THREE = window.THREE;

  class Medal {
    constructor(canvas) {
      this.canvas = canvas;
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
      });
      // On mobile: cap at 1.3 to reduce fillrate. Medal is only 260×260 inline,
      // so 1.3 DPR (338×338) is still crisp while saving ~3x on shading work
      // compared to DPR=3 (780×780). On desktop/tablet: keep up to 2.
      const isMobile =
        innerWidth < 768 || (matchMedia && matchMedia("(pointer: coarse)").matches);
      const maxDpr = isMobile ? 1.3 : 2;
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, maxDpr));
      this.renderer.setSize(innerWidth, innerHeight, false);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;

      // ── WebGL context loss recovery ─────────────────────────────────
      // iOS Safari occasionally drops the GL context (backgrounding, memory
      // pressure). Without this handler the medal just disappears for the
      // rest of the session.
      this.contextLost = false;
      canvas.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        this.contextLost = true;
        console.warn("[medal] WebGL context lost");
      }, false);
      canvas.addEventListener("webglcontextrestored", () => {
        console.log("[medal] WebGL context restored");
        this.contextLost = false;
        // Force-rebuild the current grade's model after restoration.
        // The cached glTF data (already in JS memory from preload) is
        // re-uploaded to the new GL context via _swapModel.
        const currentGrade = this.grade;
        if (currentGrade && this._swapModel) {
          this._swapModel(currentGrade).catch(() => {});
        }
      }, false);

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(
        32,
        innerWidth / innerHeight,
        0.1,
        100,
      );
      this.camera.position.set(0, 0, 6);

      // State that _buildMedal() relies on — MUST be initialised first
      this.rotVel = { x: 0, y: 0 };
      this.rotTarget = { x: 0.2, y: 0.6 };
      this.zoom = 6;
      this.zoomTarget = 6;
      this.grade = "C";
      this.active = false;

      // ── Testing phase state ─────────────────────────────────────────
      // testPhaseT   — elapsed time since test started (seconds), used for opacity fade
      // testingActive — whether currently in testing phase
      this.testingActive = false;
      this.testPhaseT = 0;

      // glTF model loading state (read by _buildMedal + _swapModel)
      this.modelCache = {};
      this._centerOffset = new THREE.Vector3(); // keeps float anim correct after centering
      this._baseScale = 1; // natural scale (procedural = 1, gltf = auto-fit)
      this._swapping = false;
      this.gradeModels = {
        S: "medals/medal-s.glb",
        A: "medals/medal-a.glb",
        B: "medals/medal-b.glb",
        C: "medals/medal-c.glb",
        D: "medals/medal-d.glb",
        F: "medals/medal-f.glb",
      };

      this._buildEnv();
      this._buildMedal(); // procedural fallback puck
      this._buildLights();
      this._buildDust();
      this._bindInput();

      this._resize = this._resize.bind(this);
      window.addEventListener("resize", this._resize);
      this._resize();

      this._loop = this._loop.bind(this);
      requestAnimationFrame(this._loop);
    }

    // ------------------------------------------------------------------ env
    _buildEnv() {
      // Procedural env map — gives metal its "reflection" character
      // without requiring any external HDR asset.
      const c = document.createElement("canvas");
      c.width = 512;
      c.height = 256;
      const g = c.getContext("2d");

      // Starfield-ish vertical gradient
      const grad = g.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0.0, "#0a0a0f");
      grad.addColorStop(0.35, "#1a1a24");
      grad.addColorStop(0.5, "#22222e");
      grad.addColorStop(0.65, "#0e0e14");
      grad.addColorStop(1.0, "#000");
      g.fillStyle = grad;
      g.fillRect(0, 0, 512, 256);

      // Scattered colour highlights = reflections of the lightspeed field
      for (let i = 0; i < 90; i++) {
        const x = Math.random() * 512,
          y = Math.random() * 256;
        const r = Math.random() * 1.8 + 0.2;
        const h = Math.random();
        const col =
          h < 0.25
            ? "rgba(255,160,90,"
            : h < 0.5
              ? "rgba(130,200,255,"
              : h < 0.75
                ? "rgba(255,100,200,"
                : "rgba(255,230,200,";
        const rg = g.createRadialGradient(x, y, 0, x, y, r * 8);
        rg.addColorStop(0, col + "0.9)");
        rg.addColorStop(1, col + "0)");
        g.fillStyle = rg;
        g.beginPath();
        g.arc(x, y, r * 8, 0, Math.PI * 2);
        g.fill();
      }

      // Warm horizon streak
      const streak = g.createLinearGradient(0, 120, 512, 140);
      streak.addColorStop(0, "rgba(255,120,60,0)");
      streak.addColorStop(0.5, "rgba(255,180,120,0.6)");
      streak.addColorStop(1, "rgba(120,180,255,0)");
      g.fillStyle = streak;
      g.fillRect(0, 120, 512, 8);

      const tex = new THREE.CanvasTexture(c);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      this.envMap = tex;
      this.scene.environment = tex;
    }

    // -------------------------------------------------------- procedural puck
    _buildMedal() {
      // A slightly irregular puck — CylinderGeometry with
      // vertex noise for an "asteroid / forged metal" profile.
      const body = new THREE.CylinderGeometry(1.2, 1.15, 0.38, 96, 8, false);
      const pos = body.attributes.position;
      const nv = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i),
          y = pos.getY(i),
          z = pos.getZ(i);
        const angle = Math.atan2(z, x);
        const n =
          Math.sin(angle * 7 + y * 3) * 0.018 +
          Math.sin(angle * 13 - y * 5) * 0.01 +
          Math.cos(angle * 3) * 0.02;
        const ring = Math.abs(y) > 0.18 ? 0 : n;
        nv.set(x, 0, z).normalize();
        pos.setX(i, x + nv.x * ring);
        pos.setZ(i, z + nv.z * ring);
        if (Math.abs(y) > 0.185) {
          const d = Math.sqrt(x * x + z * z) / 1.2;
          const dome = (1 - d * d) * 0.06 * (y > 0 ? 1 : -1);
          pos.setY(i, y + dome);
        }
      }
      body.computeVertexNormals();
      body.rotateX(Math.PI / 2); // flat face toward camera

      const bodyMat = new THREE.MeshPhysicalMaterial({
        color: 0x141419,
        metalness: 1.0,
        roughness: 0.18,
        envMap: this.envMap,
        envMapIntensity: 1.4,
        clearcoat: 0.8,
        clearcoatRoughness: 0.25,
        reflectivity: 1.0,
        // Forge animation drives these every frame during testing.
        // Defaults (off) keep idle/result looking exactly like before.
        emissive: 0x000000,
        emissiveIntensity: 0.0,
        transparent: true,
        opacity: 1.0,
      });
      this.body = new THREE.Mesh(body, bodyMat);
      this.scene.add(this.body);

      // Etched rim ring
      const ringMat = new THREE.MeshPhysicalMaterial({
        color: 0xf8f8f8,
        metalness: 1.0,
        roughness: 0.25,
        envMap: this.envMap,
        envMapIntensity: 1.2,
      });
      this.ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.18, 0.018, 16, 160),
        ringMat,
      );
      this.body.add(this.ring);

      // Inner engraved ring
      const innerRingMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.35,
      });
      this.innerRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.88, 0.006, 12, 120),
        innerRingMat,
      );
      this.innerRing.position.set(0, 0, 0.191);
      this.body.add(this.innerRing);

      // Front: dynamic grade-letter canvas
      this.labelCanvas = document.createElement("canvas");
      this.labelCanvas.width = 512;
      this.labelCanvas.height = 512;
      this.labelTex = new THREE.CanvasTexture(this.labelCanvas);
      this.labelTex.colorSpace = THREE.SRGBColorSpace;
      this.labelTex.anisotropy = 4;
      this._drawLabel("C", "UNRANKED", "00");

      const labelMat = new THREE.MeshBasicMaterial({
        map: this.labelTex,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      });
      this.label = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), labelMat);
      this.label.position.set(0, 0, 0.195);
      this.body.add(this.label);

      // Back: "ULTIMATE SPEED TEST" etch — procedural puck placement
      // async: fire-and-forget here (font may not be loaded yet at startup)
      this._makeBackLabel(1.7, -0.195).then((mesh) => {
        this.back = mesh;
        this.body.add(this.back);
      });

      // Procedural puck is always centered and scaled 1:1
      this._centerOffset.set(0, 0, 0);
      this._baseScale = 1;
    }

    // ----------------------------------------- back-face etch (shared helper)
    // Real engravings aren't "painted on" — they're just slightly darker than
    // the surrounding metal, with a soft inner shadow hinting at depth. We use
    // canvas multiply blending so the engraving DARKENS the underlying metal
    // colour rather than replacing it: this is what gives the recessed feel
    // (no gold highlight, no high-contrast edges).
    async _makeBackLabel(planeSize, backZ) {
      // Wait for both serif faces. Falls back silently if either fails to load.
      try {
        await Promise.all([
          document.fonts.load('600 72px "Bodoni Moda"'),
          document.fonts.load('500 24px "Cinzel"'),
        ]);
      } catch {}

      const bc = document.createElement("canvas");
      bc.width = bc.height = 1024;
      const bctx = bc.getContext("2d");
      bctx.clearRect(0, 0, 1024, 1024);
      bctx.save();
      bctx.translate(512, 512);
      bctx.textAlign = "center";
      bctx.textBaseline = "middle";

      // ── engraving helper ────────────────────────────────────────────────
      // Single dark fill + a soft drop-shadow that ALSO points down-right
      // simulating one-directional ambient occlusion inside the cut.
      // No bright "chamfer" — that always reads as "glued on top".
      const engrave = (text, x, y, font, ls = "3px", strength = 0.78) => {
        bctx.font = font;
        bctx.letterSpacing = ls;
        // Inner shadow approximation: a soft blurred dark version offset slightly
        bctx.shadowColor = "rgba(0,0,0,0.55)";
        bctx.shadowBlur = 4;
        bctx.shadowOffsetX = 1.2;
        bctx.shadowOffsetY = 1.2;
        bctx.fillStyle = `rgba(0,0,0,${strength})`;
        bctx.fillText(text, x, y);
        // Reset for next call
        bctx.shadowColor = "transparent";
        bctx.shadowBlur = 0;
        bctx.shadowOffsetX = 0;
        bctx.shadowOffsetY = 0;
      };

      // ── main wordmark ──────────────────────────────────────────────────────
      // Bodoni Moda — Didot-family display serif, very high stroke contrast.
      engrave(
        "ULTIMATE",
        0,
        -68,
        '500 50px "Bodoni Moda", "Didot", "Bodoni 72", Georgia, serif',
        "14px",
        0.72,
      );
      engrave(
        "SPEED TEST",
        0,
        4,
        '700 84px "Bodoni Moda", "Didot", "Bodoni 72", Georgia, serif',
        "6px",
        0.82,
      );
      // Cinzel — carved-stone serif, perfect for the subtitle.
      engrave(
        "— FORGED FROM YOUR SIGNAL —",
        0,
        76,
        '500 22px "Cinzel", Georgia, serif',
        "4px",
        0.6,
      );

      // ── rings (engraved, single dark stroke + soft shadow) ────────────────
      const engraveRing = (r, lineW = 1.2, strength = 0.5) => {
        bctx.shadowColor = "rgba(0,0,0,0.4)";
        bctx.shadowBlur = 3;
        bctx.shadowOffsetX = 1;
        bctx.shadowOffsetY = 1;
        bctx.strokeStyle = `rgba(0,0,0,${strength})`;
        bctx.lineWidth = lineW;
        bctx.beginPath();
        bctx.arc(0, 0, r, 0, Math.PI * 2);
        bctx.stroke();
        bctx.shadowColor = "transparent";
        bctx.shadowBlur = 0;
        bctx.shadowOffsetX = 0;
        bctx.shadowOffsetY = 0;
      };
      engraveRing(322, 1.4, 0.55);
      engraveRing(362, 1.0, 0.4);

      // ── 60 tick dots (engraved) ──────────────────────────────────────────
      bctx.shadowColor = "rgba(0,0,0,0.45)";
      bctx.shadowBlur = 2;
      bctx.shadowOffsetX = 0.8;
      bctx.shadowOffsetY = 0.8;
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2;
        const cx = Math.cos(a) * 342;
        const cy = Math.sin(a) * 342;
        bctx.fillStyle = "rgba(0,0,0,0.55)";
        bctx.beginPath();
        bctx.arc(cx, cy, 1.6, 0, Math.PI * 2);
        bctx.fill();
      }
      bctx.restore();

      const tex = new THREE.CanvasTexture(bc);
      tex.colorSpace = THREE.SRGBColorSpace;
      // Default (NormalBlending): transparent canvas pixels = no effect on
      // underlying medal; semi-opaque dark pixels mix toward black, which on
      // a gold/bronze surface reads as "slightly darker gold" — i.e. the way
      // light fails to reach the bottom of a real engraved cut.
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(planeSize, planeSize),
        new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
        }),
      );
      mesh.rotation.y = Math.PI;
      mesh.position.set(0, 0, backZ);
      return mesh;
    }

    // ----------------------------------------------------------- label draw
    _drawLabel(letter, title, serial) {
      const g = this.labelCanvas.getContext("2d");
      g.clearRect(0, 0, 512, 512);
      g.translate(256, 256);

      // Outer ring
      g.strokeStyle = "rgba(245,245,245,0.35)";
      g.lineWidth = 1;
      g.beginPath();
      g.arc(0, 0, 200, 0, Math.PI * 2);
      g.stroke();

      // Tick marks every 6°
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2;
        const major = i % 5 === 0;
        g.strokeStyle = major
          ? "rgba(245,245,245,0.65)"
          : "rgba(245,245,245,0.3)";
        g.lineWidth = major ? 1.4 : 0.8;
        g.beginPath();
        g.moveTo(Math.cos(a) * 200, Math.sin(a) * 200);
        g.lineTo(
          Math.cos(a) * (major ? 186 : 192),
          Math.sin(a) * (major ? 186 : 192),
        );
        g.stroke();
      }

      // Large grade letter
      g.fillStyle = "rgba(255,255,255,0.96)";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = '300 240px "Space Grotesk", system-ui';
      g.fillText(letter, 0, 10);

      // Title — letter-spaced
      g.font = '400 22px "IBM Plex Mono", monospace';
      g.fillStyle = "rgba(230,230,230,0.75)";
      g.fillText(title.toUpperCase().split("").join(" "), 0, 140);

      // Serial number
      g.font = '400 14px "IBM Plex Mono", monospace';
      g.fillStyle = "rgba(220,220,220,0.6)";
      g.fillText("№ " + serial, 0, -150);

      g.setTransform(1, 0, 0, 1, 0, 0);
      this.labelTex.needsUpdate = true;
    }

    // ---------------------------------------------------------------- lights
    _buildLights() {
      const key = new THREE.DirectionalLight(0xffffff, 1.6);
      key.position.set(3, 4, 3);
      this.scene.add(key);

      const fill = new THREE.DirectionalLight(0x8899ff, 0.6);
      fill.position.set(-3, -1, 2);
      this.scene.add(fill);

      const rim = new THREE.DirectionalLight(0xffaa66, 0.8);
      rim.position.set(-2, 2, -3);
      this.scene.add(rim);

      this.scene.add(new THREE.AmbientLight(0x20202a, 0.6));
    }

    // ----------------------------------------------------------------- dust
    _buildDust() {
      // Orbital dust — slow particles around the medal for the "forged" feel.
      const N = 240;
      const positions = new Float32Array(N * 3);
      const meta = new Float32Array(N * 3); // [radius, angle, speed]
      for (let i = 0; i < N; i++) {
        const r = 1.6 + Math.random() * 1.8;
        const a = Math.random() * Math.PI * 2;
        const y = (Math.random() - 0.5) * 0.8;
        positions[i * 3] = Math.cos(a) * r;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = Math.sin(a) * r;
        meta[i * 3] = r;
        meta[i * 3 + 1] = a;
        meta[i * 3 + 2] = 0.08 + Math.random() * 0.25;
      }
      this.dustMeta = meta; // kept separately — not a buffer attribute
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        color: 0xddd8cc,
        size: 0.02,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      this.dust = new THREE.Points(geo, mat);
      this.scene.add(this.dust);
    }


    // --------------------------------------------------------------- input
    _bindInput() {
      const el = this.canvas;
      // Prevent the browser swallowing our gesture stream on mobile
      el.style.touchAction = "none";
      // Some mobile browsers refuse to fire setPointerCapture on a canvas
      // that isn't focusable. Make it focusable but not in the tab order.
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");

      const pointers = new Map();
      let pinchDist = 0;
      const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

      let _moveCount = 0;

      const onPointerDown = (e) => {
        if (!this.active) return;
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* Safari iOS may refuse — ignore; we listen on document below as
             a backup so drag still works without capture. */
        }
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          pinchDist = dist(a, b);
        }
      };

      const onPointerMove = (e) => {
        if (!pointers.has(e.pointerId)) return;
        _moveCount++;

        const prev = pointers.get(e.pointerId);
        const cur = { x: e.clientX, y: e.clientY };
        pointers.set(e.pointerId, cur);

        if (pointers.size === 1) {
          const dx = cur.x - prev.x,
            dy = cur.y - prev.y;
          this.rotVel.y = dx * 0.006;
          this.rotVel.x = dy * 0.006;
          this.rotTarget.y += this.rotVel.y;
          this.rotTarget.x += this.rotVel.x;
          this.rotTarget.x = Math.max(-0.9, Math.min(0.9, this.rotTarget.x));
        } else if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          const d = dist(a, b);
          if (pinchDist > 0) {
            const delta = pinchDist - d;
            this.zoomTarget = Math.max(
              3.5,
              Math.min(9, this.zoomTarget + delta * 0.01),
            );
          }
          pinchDist = d;
        }
      };

      const release = (e) => {
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinchDist = 0;
        _moveCount = 0;
      };

      // Listen on canvas for the initial press (so we only catch presses that
      // start on the medal). After that, listen on the WINDOW for move/up so
      // drags continue even if the pointer leaves the canvas bounds.
      el.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", release);
      window.addEventListener("pointercancel", release);

      el.addEventListener(
        "wheel",
        (e) => {
          if (!this.active) return;
          e.preventDefault();
          this.zoomTarget = Math.max(
            3.5,
            Math.min(9, this.zoomTarget + e.deltaY * 0.003),
          );
        },
        { passive: false },
      );

      // Double-tap / double-click to reset rotation + zoom
      let lastTap = 0;
      el.addEventListener("pointerup", (e) => {
        if (!this.active || e.pointerType === "mouse") return;
        const now = performance.now();
        if (now - lastTap < 300) {
          this.rotTarget.x = 0.2;
          this.rotTarget.y = 0.6;
          this.zoomTarget = 6;
        }
        lastTap = now;
      });
    }

    // ---------------------------------------------------------------- resize
    // Read the canvas's actual rendered size, not the window. This lets the
    // canvas be CSS-sized (e.g. 200×200 inline on mobile result) and still
    // render correctly without distortion or wasted pixels.
    _resize() {
      const r = this.canvas.getBoundingClientRect();
      const w = Math.max(1, r.width || innerWidth);
      const h = Math.max(1, r.height || innerHeight);
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    // ============================== glTF model loading =====================

    /**
     * Load the .glb for a given grade letter.
     * Returns the THREE.Group (gltf.scene) or null on failure.
     * Results are cached in this.modelCache.
     */
    async _loadModelForGrade(grade) {
      if (this.modelCache[grade]) return this.modelCache[grade];

      const Loader = window.THREE?.GLTFLoader;
      if (!Loader) {
        console.warn(
          "[medal] GLTFLoader not available — using procedural medal",
        );
        console.info(
          '[medal] Tip: the <script type="module"> in index.html should set window.THREE.GLTFLoader',
        );
        return null;
      }

      const url = this.gradeModels[grade];
      if (!url) {
        console.warn(`[medal] No model URL for grade "${grade}"`);
        return null;
      }

      try {
        const loader = new Loader();

        // Draco-compressed meshes (Blender export with Draco enabled)
        if (window.__draco) loader.setDRACOLoader(window.__draco);

        // KTX2/BasisU-compressed textures (gltfpack -tc)
        if (window.__ktx2) {
          window.__ktx2.detectSupport(this.renderer);
          loader.setKTX2Loader(window.__ktx2);
        }

        // Meshopt-compressed meshes (gltfpack -cc)
        if (window.__meshoptDecoder) {
          loader.setMeshoptDecoder(window.__meshoptDecoder);
        }

        console.log(`[medal] loading grade-${grade} from "${url}" …`);

        const gltf = await new Promise((resolve, reject) =>
          loader.load(
            url,
            resolve,
            (xhr) => {
              if (xhr.total > 0) {
                const pct = Math.round((xhr.loaded / xhr.total) * 100);
                console.log(`[medal] grade-${grade}: ${pct}%`);
              }
            },
            reject,
          ),
        );

        this.modelCache[grade] = gltf.scene;
        console.log(`[medal] ✓ grade-${grade} ready`);
        return gltf.scene;
      } catch (err) {
        console.warn(`[medal] failed to load grade-${grade}:`, err);
        return null;
      }
    }

    /**
     * Replace this.body with the external glTF model for the given grade.
     * Auto-normalises scale and centres the model.
     * Falls back silently if the model cannot be loaded.
     */
    async _swapModel(grade) {
      if (this._swapping) return;
      this._swapping = true;

      try {
        const loaded = await this._loadModelForGrade(grade);
        if (!loaded) return; // keep procedural body

        // Preserve the current visual rotation so the swap feels seamless
        const rx = this.body ? this.body.rotation.x : 0.15;
        const ry = this.body ? this.body.rotation.y : 0.5;

        if (this.body) this.scene.remove(this.body);
        this.body = loaded.clone(true);
        this.scene.add(this.body);

        // Defer heavy layout calculations to idle time to avoid blocking
        // the main thread when swapping models during result-screen transition.
        // Use setTimeout 0 to defer until after the current event loop.
        if (typeof requestIdleCallback !== "undefined") {
          requestIdleCallback(() => this._finalizeModelSwap(grade, rx, ry));
        } else {
          // Fallback for browsers without requestIdleCallback
          setTimeout(() => this._finalizeModelSwap(grade, rx, ry), 0);
        }
      } catch (err) {
        console.warn("[medal] _swapModel error:", err);
        this._buildMedal();
      } finally {
        this._swapping = false;
      }
    }

    // Finalize model swap: compute bounding boxes, scale, apply materials.
    // Called on idle so layout calculations don't block the UI thread.
    async _finalizeModelSwap(grade, rx, ry) {
      if (!this.body) return;

      // Auto-normalise: fit within a ~2.4-unit bounding sphere.
      const box = new THREE.Box3().setFromObject(this.body);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      this._baseScale = maxDim > 0.001 ? 2.4 / maxDim : 1;
      this.body.scale.setScalar(this._baseScale);

      // Centre the model.
      const box2 = new THREE.Box3().setFromObject(this.body);
      const center = box2.getCenter(new THREE.Vector3());
      this._centerOffset.copy(center).negate();
      this.body.position.copy(this._centerOffset);
      this.body.rotation.set(rx, ry, 0);

      // Apply env map to all meshes for correct PBR reflections
      this.body.traverse((child) => {
        if (!child.isMesh) return;
        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];
        mats.forEach((m) => {
          m.envMap = this.envMap;
          m.envMapIntensity = 1.4;
          m.needsUpdate = true;
        });
      });

      // ── Engrave back face ────────────────────────────────────────────
      const localDiam = Math.min(size.x, size.y) * 0.95;
      const localBackZ = box.min.z - 0.05;
      this.back = await this._makeBackLabel(localDiam, localBackZ);
      this.body.add(this.back);

      console.log(`[medal] grade-${grade} finalized (scale=${this._baseScale.toFixed(4)})`);
    }

    // ============================= public API ==============================

    /**
     * Pre-warm the cache for a grade BEFORE the result screen appears.
     * Call this as soon as the download speed is known (mid-upload phase)
     * so the .glb finishes loading while the user is still watching the upload.
     * Safe to call multiple times — duplicate hits use the cache.
     */
    /**
     * Reset the medal to the procedural puck state.
     * Call this at the start of each new test run so the GLB model from
     * the previous result is removed before the test-phase animation begins.
     */
    reset() {
      if (this.body) {
        this.scene.remove(this.body);
        this.body = null;
      }
      this.active = false;
      this.rotVel = { x: 0, y: 0 };
      this.rotTarget = { x: 0.2, y: 0.6 };
      this.zoom = 6;
      this.zoomTarget = 6;
      this._entering = false;
      // Clear testing phase state
      this.testingActive = false;
      this.testPhaseT = 0;
      this._buildMedal();
    }

    preloadModel(letter) {
      if (!letter || this.modelCache[letter]) return;
      // Fire-and-forget. Errors are already logged inside _loadModelForGrade.
      this._loadModelForGrade(letter).catch(() => {});
    }

    /**
     * Called by app-v2 after the speed test finishes.
     * Updates the label and asynchronously swaps in the grade model.
     * If preloadModel() was already called for this grade, the swap is instant.
     */
    setGrade(letter, title, serial) {
      this.grade = letter;
      this._drawLabel(letter, title, serial);
      this._swapModel(letter); // async, fire-and-forget
    }

    setActive(on) {
      this.active = on;
      if (on) {
        this.rotTarget.x = 0.15;
        this.rotTarget.y = 0.5;
      }
    }

    /** Begin the testing phase — medal opacity will fade from transparent to solid. */
    startTesting() {
      this.testingActive = true;
      this.testPhaseT = 0;
      // Start semi-transparent
      if (this.body) {
        this.body.traverse((node) => {
          if (node.material) {
            node.material.transparent = true;
            node.material.opacity = 0;
          }
        });
      }
    }

    /** End the testing phase — restore full opacity. */
    endTesting() {
      this.testingActive = false;
      if (this.body) {
        this.body.traverse((node) => {
          if (node.material) {
            node.material.opacity = 1.0;
            node.material.transparent = false;
          }
        });
      }
    }

    /** Trigger the elastic spring-in entry animation. */
    burstIn() {
      this._entryT = 0;
      this._entering = true;
    }

    /**
     * Render the medal at a given size and return a fresh canvas containing
     * the pixels. Used by the share-card generator to embed the medal into
     * the social-share image.
     *
     * Why a fresh render (not just reading the live canvas)?
     *   The live WebGL context is created with preserveDrawingBuffer:false,
     *   so calling toDataURL() on it from outside the render-then-read
     *   tick can return blank pixels. Forcing a same-tick render guarantees
     *   we see something.
     *
     * @param {number} size  Target square size in pixels (e.g. 1024)
     * @returns {HTMLCanvasElement} a NEW canvas (not this.canvas)
     */
    captureFrame(size = 1024) {
      // Save current renderer state
      const prevSize = new THREE.Vector2();
      this.renderer.getSize(prevSize);
      const prevAspect = this.camera.aspect;

      // Render at the target size into the same WebGL context
      this.renderer.setSize(size, size, false);
      this.camera.aspect = 1;
      this.camera.updateProjectionMatrix();
      this.renderer.render(this.scene, this.camera);

      // Copy the freshly-rendered pixels into a 2D canvas before the
      // GL backbuffer gets cleared (next animation frame).
      const out = document.createElement("canvas");
      out.width = size;
      out.height = size;
      out.getContext("2d").drawImage(this.canvas, 0, 0, size, size);

      // Restore renderer state so the live medal keeps rendering correctly
      this.renderer.setSize(prevSize.x, prevSize.y, false);
      this.camera.aspect = prevAspect;
      this.camera.updateProjectionMatrix();

      return out;
    }

    // ================================================================ loop
    _loop(t) {
      // Skip rendering while context is lost — Three.js would throw on a
      // dead WebGL context. Keep the rAF chain alive so we resume cleanly
      // once webglcontextrestored fires.
      if (this.contextLost) {
        requestAnimationFrame(this._loop);
        return;
      }
      // ── Testing phase opacity fade ──────────────────────────────────
      // When testing, the medal gradually becomes more visible (fades from
      // transparent to fully solid) over ~2-3 seconds.
      if (this.testingActive) {
        this.testPhaseT += 1 / 60; // advance by ~16.67ms per frame
        // Ramp opacity from 0 → 1 over 3 seconds
        const opacity = Math.min(1, this.testPhaseT / 3.0);
        if (this.body) {
          this.body.traverse((node) => {
            if (node.material && node.material.opacity !== undefined) {
              node.material.opacity = opacity;
            }
          });
        }
      }

      if (this.body) {
        // ---- Entry animation: scale 0 → baseScale with elastic overshoot ----
        // All scale ops multiply by this._baseScale so a loaded glb's auto-fit
        // is preserved (procedural puck uses 1).
        if (this._entering) {
          this._entryT = (this._entryT || 0) + 1 / 60;
          const u = Math.min(1, this._entryT / 0.9);
          const eased =
            1 +
            Math.pow(2, -10 * u) *
              Math.sin(((u * 10 - 0.75) * (Math.PI * 2)) / 3);
          const s = Math.max(0, eased) * this._baseScale;
          this.body.scale.set(s, s, s);
          if (u >= 1) {
            this._entering = false;
            this.body.scale.setScalar(this._baseScale);
          }
        } else {
          this.body.scale.setScalar(this._baseScale);
        }

        // ---- Auto-rotate + spring toward interaction target ----
        this.rotTarget.y += 0.0028;
        this.body.rotation.y +=
          (this.rotTarget.y - this.body.rotation.y) * 0.08;
        this.body.rotation.x +=
          (this.rotTarget.x - this.body.rotation.x) * 0.08;

        // ---- Gentle float, honouring the auto-centre offset ----
        this.body.position.x = this._centerOffset.x;
        this.body.position.y =
          this._centerOffset.y + Math.sin(t * 0.0008) * 0.04;
        this.body.position.z = this._centerOffset.z;
      }

      // ---- Camera zoom ----
      this.zoom += (this.zoomTarget - this.zoom) * 0.08;
      this.camera.position.z = this.zoom;

      // ---- Dust orbit ────────────────────────────────────────────────
      // Simple ambient orbit around the medal.
      if (this.dust && this.dustMeta) {
        const pos = this.dust.geometry.attributes.position.array;
        const meta = this.dustMeta;
        const time = t * 0.001;
        for (let i = 0; i < meta.length / 3; i++) {
          const r = meta[i * 3]; // radius (fixed)
          const sp = meta[i * 3 + 2]; // speed
          const a = meta[i * 3 + 1] + time * sp * 0.2; // angle += speed*time
          pos[i * 3] = Math.cos(a) * r;
          pos[i * 3 + 2] = Math.sin(a) * r;
        }
        this.dust.geometry.attributes.position.needsUpdate = true;
        // Visible during idle/result interaction
        this.dust.visible = this.active;
      }

      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(this._loop);
    }
  }

  window.Medal = Medal;
})();
