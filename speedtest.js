/**
 * SpeedTest — Cloudflare endpoint measurement
 *
 * Design choices (the "why"):
 *   - Ping uses MEDIAN of samples (not min). Min is best-case and misleads.
 *   - Download discards the first 2s (TCP slow-start) then takes a trimmed mean
 *     of the remaining sustained window. Peak-sampling overshoots.
 *   - Upload uses XMLHttpRequest.upload.onprogress — the ONLY real upload-progress
 *     API in browsers. fetch() has none. Yes, onprogress reports OS/socket buffer
 *     fill rather than wire speed, so we discard the first 1s which is dominated
 *     by buffer ramp-up, then measure the sustained region.
 *   - No fake "simulated progress". If upload can't be measured (CORS / network),
 *     return 0 and surface a warning instead of lying with a made-up number.
 */
class SpeedTest {
  constructor() {
    this.listeners = {};
    this.DOWN_URL = "https://speed.cloudflare.com/__down";
    // Upload goes through our Cloudflare Worker which CORS-wraps + stream-forwards
    // to /__up. Passthrough (not a JS drain loop) keeps throughput at wire speed.
    // Allow override at runtime via window.UPLOAD_PROXY_URL.
    this.UP_URL =
      (typeof window !== "undefined" && window.UPLOAD_PROXY_URL) ||
      "https://ust-upload-proxy.liamz-dev.workers.dev";
    this.DOWN_STREAMS = 8;
    this.UP_STREAMS = 3;
    this.DOWN_BYTES = 200 * 1024 * 1024;
    // 100 MB chunks: at ~250 Mbps/stream a chunk takes ~3 s, giving TCP
    // enough time past slow-start to reach the link ceiling. Smaller chunks
    // (25 MB) end before slow-start finishes, capping measured throughput.
    this.UP_BYTES = 100 * 1024 * 1024;
    this.debug = true;
  }

  // ── Upload endpoint probe ──────────────────────────────────────
  // Tries each candidate URL in order with a tiny 8-byte POST.
  // First one that responds 200 wins; last resort is Cloudflare.
  //
  // Priority:
  //   1. /api/upload          – local Netlify edge function (same-origin, no CORS)
  //   2. window.UPLOAD_PROXY_URL – absolute Netlify URL (for Viverse / other hosts)
  //   3. Cloudflare __up      – default, may be CORS-blocked in some environments
  async _probeUploadEndpoint() {
    const candidates = [
      // 1. Same-origin Pages Function (Cloudflare) / edge function (Netlify).
      //    No CORS preflight, runs at the edge of whichever host serves the app.
      "/api/upload",
      // 2. External Cloudflare Worker — fallback when same-origin endpoint
      //    is unavailable (e.g. plain static host with no functions support).
      (typeof window !== "undefined" && window.UPLOAD_PROXY_URL) || null,
    ].filter(Boolean);

    for (const url of candidates) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 2000);
        const res = await fetch(url, {
          method: "POST",
          body: new Blob([new Uint8Array(8)]), // 8-byte probe
          cache: "no-store",
          signal: ctrl.signal,
        });
        clearTimeout(tid);
        if (res.ok) {
          this.UP_URL = url;
          this.log(`Upload endpoint → ${url}`);
          return;
        }
      } catch {
        /* timeout or network error — try next candidate */
      }
    }
    this.log("Upload endpoint → Cloudflare __up (default)");
  }

  on(event, fn) {
    (this.listeners[event] ||= []).push(fn);
    return this;
  }
  emit(event, data) {
    (this.listeners[event] || []).forEach((fn) => fn(data));
  }
  log(...args) {
    if (this.debug) console.log("[SpeedTest]", ...args);
  }

  async run() {
    const results = { ping: 0, jitter: 0, download: 0, upload: 0 };
    try {
      this.emit("phase", { phase: "ping" });
      const p = await this.measurePing(20, 5);
      results.ping = p.ping;
      results.jitter = p.jitter;
      this.log("Ping:", p);

      this.emit("phase", { phase: "download" });
      results.download = await this.measureDownload(10000);
      this.log("Download:", results.download.toFixed(1), "Mbps");

      this.emit("phase", { phase: "upload" });
      results.upload = await this.measureUpload(10000);
      this.log("Upload:", results.upload.toFixed(1), "Mbps");

      this.emit("done", results);
      return results;
    } catch (err) {
      this.emit("error", err);
      throw err;
    }
  }

  // ==================== PING ====================
  async measurePing(count, warmup) {
    const doOne = async () => {
      const url = `${this.DOWN_URL}?bytes=0&r=${Math.random().toString(36).slice(2)}`;
      try {
        const t0 = performance.now();
        await fetch(url, { cache: "no-store" });
        return performance.now() - t0;
      } catch {
        return null;
      }
    };

    for (let i = 0; i < warmup; i++) await doOne();

    const samples = [];
    for (let i = 0; i < count; i++) {
      const dt = await doOne();
      if (dt != null && dt < 5000) {
        samples.push(dt);
        const sorted = [...samples].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        this.emit("progress", {
          phase: "ping",
          mbps: 0,
          progress: (i + 1) / count,
          ping: median,
        });
      }
    }
    if (!samples.length) return { ping: 0, jitter: 0 };

    samples.sort((a, b) => a - b);
    const median = samples[Math.floor(samples.length / 2)];
    // Jitter = std-dev of the middle 80% (trim extremes)
    const trimStart = Math.floor(samples.length * 0.1);
    const trimEnd = Math.ceil(samples.length * 0.9);
    const core = samples.slice(trimStart, trimEnd);
    const mean = core.reduce((s, v) => s + v, 0) / core.length;
    const jitter = Math.sqrt(
      core.reduce((s, v) => s + (v - mean) ** 2, 0) / core.length,
    );

    this.log("Ping samples:", samples.map((s) => s.toFixed(1)).join(","));
    return { ping: median, jitter };
  }

  // ==================== DOWNLOAD ====================
  async measureDownload(timeoutMs) {
    const streams = this.DOWN_STREAMS;
    const controllers = Array.from(
      { length: streams },
      () => new AbortController(),
    );
    // timeline[i] = { t: ms since start, bytes: cumulative total across all streams }
    const timeline = [];
    let totalBytes = 0;
    const t0 = performance.now();
    let lastEmit = 0;

    const recordAndEmit = () => {
      const now = performance.now();
      const elapsedMs = now - t0;
      timeline.push({ t: elapsedMs, bytes: totalBytes });

      // Live display: rolling 2s average so the UI feels responsive.
      // (Final result uses a stricter trimmed-mean computation after all streams end.)
      let liveMbps = 0;
      if (timeline.length >= 2) {
        let anchor = timeline[0];
        for (let i = timeline.length - 1; i >= 0; i--) {
          if (elapsedMs - timeline[i].t >= 2000) {
            anchor = timeline[i];
            break;
          }
        }
        const dt = (elapsedMs - anchor.t) / 1000;
        if (dt > 0.3) liveMbps = ((totalBytes - anchor.bytes) * 8) / 1e6 / dt;
      }

      if (now - lastEmit > 100) {
        lastEmit = now;
        this.emit("progress", {
          phase: "download",
          mbps: liveMbps,
          progress: Math.min(elapsedMs / timeoutMs, 1),
        });
      }
    };

    const timeout = setTimeout(
      () => controllers.forEach((c) => c.abort()),
      timeoutMs,
    );

    const runStream = async (ctrl) => {
      try {
        const url = `${this.DOWN_URL}?bytes=${this.DOWN_BYTES}&r=${Math.random().toString(36).slice(2)}`;
        const res = await fetch(url, {
          cache: "no-store",
          signal: ctrl.signal,
        });
        const reader = res.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          totalBytes += value.byteLength;
          recordAndEmit();
        }
      } catch (e) {
        if (e.name !== "AbortError") console.warn("download stream error", e);
      }
    };

    await Promise.all(controllers.map(runStream));
    clearTimeout(timeout);

    // Final: discard first 2s (slow-start), then slice the sustained region
    // into ~500ms buckets and take a trimmed mean (drop top+bottom 10%).
    const SLOW_START_MS = 2000;
    const BUCKET_MS = 500;
    const totalElapsed = performance.now() - t0;

    let final = 0;
    if (totalElapsed > SLOW_START_MS + BUCKET_MS && timeline.length > 4) {
      // Find the timeline entry at the slow-start boundary
      let startIdx = 0;
      for (let i = 0; i < timeline.length; i++) {
        if (timeline[i].t >= SLOW_START_MS) {
          startIdx = i;
          break;
        }
      }
      const startPoint = timeline[startIdx];
      const endPoint = timeline[timeline.length - 1];

      // Bucket rates
      const rates = [];
      let bucketStart = startPoint;
      for (let i = startIdx + 1; i < timeline.length; i++) {
        const p = timeline[i];
        if (p.t - bucketStart.t >= BUCKET_MS) {
          const mbps =
            ((p.bytes - bucketStart.bytes) * 8) /
            1e6 /
            ((p.t - bucketStart.t) / 1000);
          rates.push(mbps);
          bucketStart = p;
        }
      }

      if (rates.length >= 3) {
        rates.sort((a, b) => a - b);
        const trim = Math.floor(rates.length * 0.1);
        const core = rates.slice(trim, rates.length - trim);
        final = core.reduce((s, v) => s + v, 0) / core.length;
      } else {
        // Not enough buckets — fall back to mean of sustained window
        final =
          ((endPoint.bytes - startPoint.bytes) * 8) /
          1e6 /
          ((endPoint.t - startPoint.t) / 1000);
      }
    } else if (totalBytes > 0) {
      // Too short to strip slow-start — give simple average
      final = (totalBytes * 8) / 1e6 / (totalElapsed / 1000);
    }

    this.log(
      `Download: ${(totalBytes / 1e6).toFixed(1)}MB over ${(totalElapsed / 1000).toFixed(2)}s → ${final.toFixed(1)} Mbps`,
    );
    this.emit("progress", { phase: "download", mbps: final, progress: 1 });
    return final;
  }

  // ==================== UPLOAD ====================
  // Endpoint: a Cloudflare Worker that adds CORS and stream-forwards the body
  // to speed.cloudflare.com/__up. The Worker doesn't drain in JavaScript — it
  // hands request.body to fetch(), so the runtime streams bytes between the
  // two TCP connections at near-line-speed.
  //
  // Why we can't just hit /__up directly: registering xhr.upload.onprogress
  // automatically promotes the request to a CORS non-simple request, which
  // triggers an OPTIONS preflight that /__up refuses for non-CF origins.
  //
  // Why we still loop chunks: at >100 Mbps a single 25 MB chunk finishes in
  // <2 s, leaving most of the 10 s window empty. Each stream sends chunk
  // after chunk and accumulates `loaded` across chunk boundaries so the rate
  // algorithm sees one continuous timeline.
  async measureUpload(timeoutMs) {
    const streams = this.UP_STREAMS;
    // Reuse the same buffer across chunks to avoid re-allocating on every iteration.
    const payload = this.makeRandomBuffer(this.UP_BYTES);

    const t0 = performance.now();
    const streamSamples = Array.from({ length: streams }, () => []); // [{t, loaded}]
    let corsFailed = false;
    let lastEmit = 0;

    const emitLive = () => {
      const now = performance.now();
      if (now - lastEmit < 100) return;
      lastEmit = now;
      const elapsedMs = now - t0;
      let mbps = 0;
      if (elapsedMs > 500) {
        const windowStart = Math.max(0, elapsedMs - 2000);
        let bytesInWindow = 0;
        for (const samples of streamSamples) {
          if (samples.length < 2) continue;
          const latest = samples[samples.length - 1];
          let priorLoaded = 0;
          for (let i = samples.length - 1; i >= 0; i--) {
            if (samples[i].t <= windowStart) {
              priorLoaded = samples[i].loaded;
              break;
            }
          }
          bytesInWindow += Math.max(0, latest.loaded - priorLoaded);
        }
        const windowSec = Math.min(2, elapsedMs / 1000);
        if (windowSec > 0.3) mbps = (bytesInWindow * 8) / 1e6 / windowSec;
      }
      this.emit("progress", {
        phase: "upload",
        mbps,
        progress: Math.min((performance.now() - t0) / timeoutMs, 0.98),
      });
    };

    // Each stream runs a loop: send chunk → wait for finish → send next chunk …
    // until the timeout window is almost exhausted.
    // `loaded` is cumulative across all chunks so the rate algo sees a smooth curve.
    const runStream = (idx) =>
      new Promise((resolve) => {
        const samples = streamSamples[idx];
        let chunksSent = 0; // chunks successfully started (used as byte offset)
        let stopped = false;

        const sendChunk = () => {
          if (stopped) return;
          const remaining = timeoutMs - (performance.now() - t0);
          if (remaining < 200) {
            resolve();
            return;
          } // too little time left

          const xhr = new XMLHttpRequest();
          const offset = chunksSent * this.UP_BYTES; // byte offset for this chunk

          xhr.upload.onprogress = (e) => {
            if (!e.lengthComputable) return;
            samples.push({
              t: performance.now() - t0,
              loaded: offset + e.loaded,
            });
            emitLive();
          };
          xhr.upload.onload = () => {
            samples.push({
              t: performance.now() - t0,
              loaded: offset + this.UP_BYTES,
            });
          };

          const finishChunk = (reason) => {
            this.log(`  stream #${idx} chunk #${chunksSent}: ${reason}`);
            if (stopped) return;
            // Abort the outer stream if this was a hard CORS block (zero samples ever).
            if (reason === "error" && samples.length === 0) {
              corsFailed = true;
              stopped = true;
              resolve();
              return;
            }
            chunksSent++;
            // Kick off the next chunk immediately (no setTimeout overhead).
            sendChunk();
          };

          xhr.onload = () => finishChunk(`done status=${xhr.status}`);
          xhr.onerror = () => finishChunk("error");
          xhr.onabort = () => {
            stopped = true;
            resolve();
          };
          xhr.ontimeout = () => finishChunk("timeout");

          xhr.open(
            "POST",
            `${this.UP_URL}?r=${Math.random().toString(36).slice(2)}`,
            true,
          );
          // Blob with no explicit type — the Worker doesn't care about Content-Type
          // and `application/octet-stream` would just add a redundant header.
          try {
            xhr.send(new Blob([payload]));
          } catch (e) {
            corsFailed = true;
            stopped = true;
            resolve();
            return;
          }

          // Hard deadline: abort this XHR if the overall window is almost up.
          setTimeout(
            () => {
              if (!stopped) {
                try {
                  xhr.abort();
                } catch {}
              }
            },
            Math.max(100, timeoutMs - (performance.now() - t0)),
          );
        };

        sendChunk(); // kick off the first chunk
      });

    await Promise.all(Array.from({ length: streams }, (_, i) => runStream(i)));
    const totalElapsed = performance.now() - t0;

    // Final: discard first 1 s (ramp-up), measure sustained rate.
    const RAMP_MS = 1000;
    let sustainedMbps = 0;
    let usableStreams = 0;

    for (const samples of streamSamples) {
      if (samples.length < 2) continue;
      let startIdx = -1;
      for (let i = 0; i < samples.length; i++) {
        if (samples[i].t >= RAMP_MS) {
          startIdx = i;
          break;
        }
      }
      if (startIdx < 0 || startIdx >= samples.length - 1) continue;
      const start = samples[startIdx];
      const end = samples[samples.length - 1];
      const dtSec = (end.t - start.t) / 1000;
      if (dtSec < 0.5) continue;
      const mbps = ((end.loaded - start.loaded) * 8) / 1e6 / dtSec;
      if (mbps > 0) {
        sustainedMbps += mbps;
        usableStreams++;
      }
    }

    let final = sustainedMbps;
    if (final === 0) {
      let totalBytes = 0;
      for (const s of streamSamples) {
        if (s.length) totalBytes += s[s.length - 1].loaded;
      }
      if (totalBytes > 0 && totalElapsed > 0)
        final = (totalBytes * 8) / 1e6 / (totalElapsed / 1000);
    }

    if (corsFailed && final === 0) {
      this.emit("warning", {
        type: "upload-unmeasurable",
        message: "Upload blocked by CORS/network. Result not measured.",
      });
      this.log("Upload unmeasurable (CORS or network). Returning 0.");
    }

    this.log(
      `Upload: ${usableStreams}/${streams} streams usable, ` +
        `${totalElapsed.toFixed(0)}ms total → ${final.toFixed(1)} Mbps`,
    );
    this.emit("progress", { phase: "upload", mbps: final, progress: 1 });
    return final;
  }

  // Filled with cryptographic-quality random bytes so the upload can't be
  // compressed by any HTTP/2 layer in transit. crypto.getRandomValues is an
  // order of magnitude faster than a Math.random() loop, but is capped at
  // 64 KB per call — so we walk the buffer in 64 KB windows.
  makeRandomBuffer(size) {
    const buf = new Uint8Array(size);
    const STEP = 65536;
    for (let off = 0; off < size; off += STEP) {
      const end = Math.min(off + STEP, size);
      crypto.getRandomValues(buf.subarray(off, end));
    }
    return buf;
  }
}

window.SpeedTest = SpeedTest;
