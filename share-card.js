/* ============================================================
   Ultimate Speed Test — Share Card
   Generates a 1080×1350 PNG that can be downloaded or shared
   via the Web Share API. Visual style mirrors the live result
   screen: pure black background, mono captions, large grade
   letter, three metric columns.
   ============================================================ */
(function () {
  // ── Card dimensions ───────────────────────────────────────────────
  // 4:5 portrait — Instagram/Twitter friendly, fits a phone preview
  // without cropping. 1080 wide gives crisp text on retina screens.
  const W = 1080;
  const H = 1350;
  const FRAME = 32;    // outer black frame thickness
  const PADDING = 56;  // inset for content from the frame edge

  /**
   * Build a square crop of the medal (renderer at 1024×1024) plus a soft
   * radial backdrop so it doesn't sit on a flat pure-black void. The backdrop
   * uses the lightspeed palette tinted by grade so each share card feels
   * tied to the result it's showing.
   */
  function drawMedalBlock(ctx, medalCanvas, x, y, size, gradeLetter) {
    // Soft radial halo behind the medal — subtle, just to give the puck
    // a sense of "place" rather than floating on void.
    const cx = x + size / 2;
    const cy = y + size / 2;
    const haloColor = gradeHalo(gradeLetter);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.55);
    grad.addColorStop(0, haloColor + "40");   // ~25% alpha at centre
    grad.addColorStop(0.55, haloColor + "10"); // ~6% alpha mid
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x - 40, y - 40, size + 80, size + 80);

    // Medal pixels
    ctx.drawImage(medalCanvas, x, y, size, size);
  }

  /** Per-grade halo colour (hex string, no leading #). */
  function gradeHalo(letter) {
    switch (letter) {
      case "S": return "#7ec3ff"; // cool blue-white
      case "A": return "#7af5cf"; // mint
      case "B": return "#9bf08a"; // green
      case "C": return "#f5d36a"; // amber
      case "D": return "#f59060"; // orange
      case "F": return "#c93f33"; // dark red
      default:  return "#ffffff";
    }
  }

  /**
   * Render a centred mono-spaced label with letter spacing —
   * matches the result-screen "EXCELLENT" / "STEADY" titles.
   */
  function fillSpacedText(ctx, txt, x, y, spacing) {
    const chars = txt.split("");
    const widths = chars.map((c) => ctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
    let cur = x - total / 2;
    chars.forEach((c, i) => {
      ctx.fillText(c, cur + widths[i] / 2, y);
      cur += widths[i] + spacing;
    });
  }

  /**
   * Build the share card and return it as an HTMLCanvasElement.
   *
   * @param {Object} args
   * @param {HTMLCanvasElement} args.medalCanvas  pre-captured medal frame
   * @param {Object} args.results  { download, upload, ping }
   * @param {Object} args.grade    { letter, title }
   * @param {boolean} [args.uploadBlocked=false]
   * @returns {HTMLCanvasElement}
   */
  function buildShareCard({ medalCanvas, results, grade, uploadBlocked = false }) {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");

    // ── 1. Pure black background ────────────────────────────────────
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, W, H);

    // ── 2. Inner content area ───────────────────────────────────────
    // The "frame" is just the thick black margin. Content lives inside
    // a hairline rectangle so the eye perceives the border as a frame.
    const innerX = FRAME;
    const innerY = FRAME;
    const innerW = W - FRAME * 2;
    const innerH = H - FRAME * 2;

    // Hairline rule around inner area (very subtle — almost subliminal)
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.strokeRect(innerX + 0.5, innerY + 0.5, innerW - 1, innerH - 1);

    // ── 3. Top brand strip ──────────────────────────────────────────
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = '500 18px "IBM Plex Mono", ui-monospace, monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    fillSpacedText(ctx, I18N.get("share.card.title"), W / 2, innerY + PADDING, 1.5);

    // Tiny tick lines either side of the brand text — feels like a sci-fi HUD
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.moveTo(innerX + PADDING, innerY + PADDING - 5);
    ctx.lineTo(innerX + PADDING + 60, innerY + PADDING - 5);
    ctx.moveTo(W - innerX - PADDING - 60, innerY + PADDING - 5);
    ctx.lineTo(W - innerX - PADDING, innerY + PADDING - 5);
    ctx.stroke();

    // ── 4. Medal block (top half) ───────────────────────────────────
    const medalSize = 620;
    const medalX = (W - medalSize) / 2;
    const medalY = innerY + PADDING + 50;
    drawMedalBlock(ctx, medalCanvas, medalX, medalY, medalSize, grade.letter);

    // ── 5. Divider rule ─────────────────────────────────────────────
    const divY = medalY + medalSize + 30;
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(innerX + PADDING + 40, divY);
    ctx.lineTo(W - innerX - PADDING - 40, divY);
    ctx.stroke();

    // Tiny diamond marker at midpoint of divider
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.save();
    ctx.translate(W / 2, divY);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();

    // ── 6. Grade letter (huge) ──────────────────────────────────────
    const gradeY = divY + 110;
    ctx.fillStyle = "#ffffff";
    ctx.font = '300 130px "Space Grotesk", system-ui, sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(grade.letter, W / 2, gradeY);

    // ── 7. Grade title (spaced mono) ────────────────────────────────
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = '400 15px "IBM Plex Mono", ui-monospace, monospace';
    fillSpacedText(ctx, (grade.title || "").toUpperCase(), W / 2, gradeY + 30, 2.5);

    // ── 8. Three metric columns ─────────────────────────────────────
    const metricsY = gradeY + 110;
    const metrics = [
      {
        value: results.download,
        unit: "Mbps",
        label: I18N.get("share.download").toUpperCase(),
      },
      {
        value: uploadBlocked && Number(results.upload) === 0 ? "N/A" : results.upload,
        unit: uploadBlocked && Number(results.upload) === 0 ? "" : "Mbps",
        label: I18N.get("share.upload").toUpperCase(),
      },
      {
        value: results.ping,
        unit: "ms",
        label: I18N.get("share.ping").toUpperCase(),
      },
    ];

    const colX = [W * 0.25, W * 0.5, W * 0.75];
    metrics.forEach((m, i) => {
      const x = colX[i];

      // Value (number)
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = '300 64px "Space Grotesk", system-ui, sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(String(m.value), x, metricsY);

      // Unit (small caption right after the number)
      if (m.unit) {
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = '500 13px "IBM Plex Mono", ui-monospace, monospace';
        ctx.fillText(m.unit, x, metricsY + 26);
      }

      // Label (small mono caption with extra spacing)
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = '500 11px "IBM Plex Mono", ui-monospace, monospace';
      fillSpacedText(ctx, m.label, x, metricsY + 56, 2);
    });

    // Vertical separator lines between columns
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    [W / 3, (W * 2) / 3].forEach((sx) => {
      ctx.beginPath();
      ctx.moveTo(sx, metricsY - 50);
      ctx.lineTo(sx, metricsY + 60);
      ctx.stroke();
    });

    // ── 9. Footer: timestamp + tagline ──────────────────────────────
    const d = new Date();
    const dateStr = d
      .toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
      .toUpperCase();

    const footY = innerY + innerH - PADDING + 10;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = '500 12px "IBM Plex Mono", ui-monospace, monospace';
    ctx.textAlign = "center";
    fillSpacedText(ctx, dateStr, W / 2, footY, 1.2);

    return c;
  }

  /** Convert canvas → PNG Blob (memoised to avoid re-encoding). */
  function canvasToBlob(canvas) {
    return new Promise((res, rej) =>
      canvas.toBlob(
        (b) => (b ? res(b) : rej(new Error("toBlob returned null"))),
        "image/png",
        0.95,
      ),
    );
  }

  /** Trigger a PNG download from the card canvas. */
  async function downloadCanvas(canvas, filename) {
    const blob = await canvasToBlob(canvas);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `speed-test-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  /**
   * Copy the canvas to the system clipboard as a real PNG image
   * (not a file reference — pastes properly into Word, chat apps,
   * Photoshop, etc.).
   *
   * Requires a secure context (https/localhost) and a browser that
   * supports ClipboardItem. Throws on failure so caller can show
   * a fallback toast.
   */
  async function copyCanvasToClipboard(canvas) {
    if (!window.ClipboardItem || !navigator.clipboard?.write) {
      throw new Error("Clipboard image API not supported");
    }
    const blob = await canvasToBlob(canvas);
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob }),
    ]);
  }

  /**
   * Hand off to the OS native share sheet via Web Share API.
   * Returns 'shared' on success, 'cancelled' if user dismissed,
   * or throws if the API isn't available.
   */
  async function nativeShareCanvas(canvas, shareText = "Ultimate Speed Test") {
    if (
      typeof navigator.canShare !== "function" ||
      typeof navigator.share !== "function"
    ) {
      throw new Error("Web Share API not supported");
    }
    const blob = await canvasToBlob(canvas);
    const file = new File([blob], `speed-test-${Date.now()}.png`, {
      type: "image/png",
    });
    if (!navigator.canShare({ files: [file] })) {
      throw new Error("Sharing files not supported on this device");
    }
    try {
      await navigator.share({
        files: [file],
        title: "Ultimate Speed Test",
        text: shareText,
      });
      return "shared";
    } catch (err) {
      if (err && err.name === "AbortError") return "cancelled";
      throw err;
    }
  }

  /** Probe whether the native share sheet is usable for image files. */
  function nativeShareAvailable() {
    if (
      typeof navigator.canShare !== "function" ||
      typeof navigator.share !== "function"
    ) {
      return false;
    }
    // Probe with a 1-byte placeholder file — canShare doesn't read content
    try {
      const probe = new File([new Uint8Array([0])], "probe.png", {
        type: "image/png",
      });
      return navigator.canShare({ files: [probe] });
    } catch {
      return false;
    }
  }

  /** Probe whether image clipboard write is usable. */
  function clipboardImageAvailable() {
    return !!(window.ClipboardItem && navigator.clipboard?.write);
  }

  // Public API
  window.ShareCard = {
    build: buildShareCard,
    download: downloadCanvas,
    copyToClipboard: copyCanvasToClipboard,
    nativeShare: nativeShareCanvas,
    canNativeShare: nativeShareAvailable,
    canCopyImage: clipboardImageAvailable,
  };
})();
