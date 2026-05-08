// Three screens — Idle / Testing / Result.
// Each takes a `breakpoint` prop ('desktop' | 'tablet' | 'mobile').
// Internally we pick sizes / positions / layouts per breakpoint.

const SIZES = {
  desktop: {
    chromeInset: { top: 22, side: 22 },
    puck: 380,
    forged: 420,
    testPuck: 280,
    titleSize: 56,
    titleSerifSize: 64,
    valueSize: 168,
    valueUnitSize: 18,
    sub: 12,
    capsuleX: 22, capsulePad: "20px 44px",
    chipMin: 156, chipValueSize: 32,
    metricRing: 720,           // diameter of orbit on which result chips sit
    titleTop: 96, titleLeft: 56,
    paddingX: 56, paddingTop: 96, paddingBottom: 96,
  },
  tablet: {
    chromeInset: { top: 18, side: 18 },
    puck: 320,
    forged: 360,
    testPuck: 240,
    titleSize: 48,
    titleSerifSize: 56,
    valueSize: 140,
    valueUnitSize: 16,
    sub: 11,
    capsuleX: 22, capsulePad: "18px 38px",
    chipMin: 142, chipValueSize: 28,
    metricRing: 600,
    titleTop: 80, titleLeft: 40,
    paddingX: 40, paddingTop: 80, paddingBottom: 80,
  },
  mobile: {
    chromeInset: { top: 16, side: 16 },
    puck: 260,
    forged: 200,
    testPuck: 200,
    titleSize: 40,
    titleSerifSize: 44,
    valueSize: 96,
    valueUnitSize: 13,
    sub: 10,
    capsuleX: 18, capsulePad: "16px 32px",
    chipMin: 0, chipValueSize: 22,  // mobile uses tiles in sheet, not free chips
    metricRing: 0,
    titleTop: 64, titleLeft: 24,
    paddingX: 24, paddingTop: 64, paddingBottom: 32,
  },
};

/* ============================================================
   IDLE — medal as hero, "START" capsule below, minimal text
   ============================================================ */
const IdleScreen = ({ breakpoint = "desktop" }) => {
  const S = SIZES[breakpoint];
  const isMobile = breakpoint === "mobile";

  return (
    <div className="frame">
      <StarBg />
      <AppChrome inset={S.chromeInset} />

      {/* Idle puck — anchor at center, slightly above middle on desktop */}
      <IdlePuck size={S.puck} top={isMobile ? "38%" : "44%"} />

      {/* Title + sub — below puck */}
      <div style={{
        position: "absolute",
        left: 0, right: 0,
        top: isMobile ? "58%" : "64%",
        textAlign: "center",
        zIndex: 3,
        padding: `0 ${S.paddingX}px`,
      }}>
        <div style={{
          fontFamily: "var(--font-serif)",
          fontSize: S.titleSerifSize,
          fontWeight: 400,
          letterSpacing: "-.02em",
          lineHeight: 1.0,
          fontStyle: "italic",
          marginBottom: 18,
        }}>
          How fast does <em style={{ fontStyle: "normal", fontFamily: "var(--font-display)", fontWeight: 300 }}>your signal</em> travel.
        </div>
        <div className="mono" style={{
          fontFamily: "var(--font-mono)",
          fontSize: S.sub,
          color: "rgba(255,255,255,.5)",
          letterSpacing: ".34em",
          textTransform: "uppercase",
        }}>
          Press to begin · Takes ~25s
        </div>
      </div>

      {/* Start capsule — anchored bottom, generous spacing */}
      <div style={{
        position: "absolute",
        left: 0, right: 0,
        bottom: breakpoint === "desktop" ? "10%" : breakpoint === "tablet" ? "12%" : "14%",
        display: "flex", justifyContent: "center",
        zIndex: 5,
      }}>
        <button className="capsule-primary" style={{
          padding: breakpoint === "desktop" ? "26px 72px" : breakpoint === "tablet" ? "24px 64px" : "18px 44px",
          fontSize: breakpoint === "desktop" ? 17 : breakpoint === "tablet" ? 16 : 13,
        }}>
          <span>START</span>
          <IconArrow />
        </button>
      </div>

      {/* Tiny status row — bottom-left corner, very subtle */}
      {!isMobile && (
        <div style={{
          position: "absolute",
          bottom: 28, left: S.paddingX,
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "rgba(255,255,255,.35)",
          letterSpacing: ".3em",
          textTransform: "uppercase",
          display: "flex", alignItems: "center", gap: 8,
          zIndex: 5,
        }}>
          <span className="live-dot pulse" />
          <span>CLOUDFLARE · ANYCAST</span>
        </div>
      )}
    </div>
  );
};

/* ============================================================
   TESTING — medal stays, wrapped by lightspeed; reading + phase pill
   ============================================================ */
const TestingScreen = ({ breakpoint = "desktop" }) => {
  const S = SIZES[breakpoint];
  const isMobile = breakpoint === "mobile";

  return (
    <div className="frame">
      <LightBg />
      <AppChrome inset={S.chromeInset} />

      {/* Dim test puck behind the streaks */}
      <TestPuck size={S.testPuck} top="50%" />

      {/* Phase pill — top center, below chrome */}
      <div style={{
        position: "absolute",
        left: 0, right: 0,
        top: breakpoint === "mobile" ? "10%" : "11%",
        display: "flex", justifyContent: "center",
        zIndex: 5,
      }}>
        <div className="phase-pill">
          <span className="phase-seg done">
            <span style={{ width: 12, height: 12, borderRadius: "50%", border: "1px solid currentColor", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 7 }}>✓</span>
            Ping
          </span>
          <span className="phase-seg active">
            <span className="live-dot pulse" />
            Download
          </span>
          <span className="phase-seg">
            <span style={{ width: 6, height: 6, borderRadius: "50%", border: "1px solid currentColor" }} />
            Upload
          </span>
        </div>
      </div>

      {/* Center: large reading. Tabular numbers, tiny unit, label above */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 8, zIndex: 4, pointerEvents: "none",
      }}>
        <div className="mono" style={{
          fontSize: S.sub,
          letterSpacing: ".4em",
          color: "rgba(255,255,255,.55)",
          textTransform: "uppercase",
          marginBottom: 6,
          textShadow: "0 0 24px rgba(0,0,0,.9)",
        }}>
          Downstream · 6 streams
        </div>
        <div style={{
          display: "flex", alignItems: "baseline",
          gap: isMobile ? 8 : 14,
          textShadow: "0 0 80px rgba(0,0,0,.95)",
        }}>
          <span style={{
            fontVariantNumeric: "tabular-nums",
            fontSize: S.valueSize,
            fontWeight: 200,
            letterSpacing: "-.045em",
            lineHeight: 1,
          }}>882.71</span>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: S.valueUnitSize,
            color: "rgba(255,255,255,.6)",
            letterSpacing: ".22em",
          }}>MBPS</span>
        </div>
      </div>

      {/* Bottom: secondary live readings as 3 small chips on a row.
          On mobile we collapse to 2 chips. Cancel button below. */}
      <div style={{
        position: "absolute",
        left: 0, right: 0,
        bottom: breakpoint === "mobile" ? "12%" : breakpoint === "tablet" ? "10%" : "8%",
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: isMobile ? 14 : 16,
        zIndex: 5,
      }}>
        <div style={{
          display: "flex", gap: 10,
          padding: `0 ${S.paddingX}px`,
        }}>
          {[
            ["Peak", "904.2", "Mbps"],
            ["Ping", "62", "ms"],
            ...(!isMobile ? [["Elapsed", "14.6", "s"]] : []),
          ].map(([k, v, u]) => (
            <div key={k} className="metric-chip" style={{
              minWidth: isMobile ? 120 : 140,
              padding: isMobile ? "10px 14px" : "12px 16px",
            }}>
              <div className="label">{k}</div>
              <div className="value-row">
                <span className="value" style={{ fontSize: isMobile ? 22 : 26 }}>{v}</span>
                <span className="unit">{u}</span>
              </div>
            </div>
          ))}
        </div>

        <button className="capsule-secondary" style={{
          padding: isMobile ? "12px 22px" : "14px 28px",
        }}>
          <span>Cancel</span>
        </button>
      </div>
    </div>
  );
};

/* ============================================================
   RESULT — medal center, 4 metric chips floating around it,
            grade letter, primary action capsule
   ============================================================ */
const ResultScreen = ({ breakpoint = "desktop" }) => {
  const S = SIZES[breakpoint];
  const isMobile = breakpoint === "mobile";

  // Position chips around the medal: TL, TR, BL, BR for desktop+tablet
  // Mobile: chips become a 2x2 sheet at the bottom.
  const chipData = [
    ["Download", "858.59", "Mbps"],
    ["Upload",   "11.44",  "Mbps"],
    ["Ping",     "62.0",   "ms"],
    ["Jitter",   "9.1",    "ms"],
  ];

  // Mobile: vertical flex stack so spacing between sections is deterministic
  if (isMobile) {
    return (
      <div className="frame">
        <StarBg />
        <AppChrome inset={S.chromeInset} />

        <div style={{
          position: "absolute", inset: 0,
          paddingLeft: 16, paddingRight: 16,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 22,
          zIndex: 4,
        }}>
          {/* Grade pill */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 12,
            padding: "8px 18px 8px 10px",
            borderRadius: 999,
            background: "rgba(255,255,255,.06)",
            border: "1px solid rgba(255,255,255,.14)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: 8,
              background: "linear-gradient(180deg, #f5d28a, #b07a3c)",
              color: "#0a0a0c",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 600, fontSize: 14, letterSpacing: "-.02em",
              boxShadow: "0 0 16px rgba(245,210,138,.4)",
            }}>S</div>
            <div style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9, letterSpacing: ".26em",
              textTransform: "uppercase", color: "rgba(255,255,255,.85)",
            }}>Lightspeed · Top tier</div>
          </div>

          {/* Medal — fixed-size block, just below pill */}
          <div style={{
            position: "relative",
            width: S.forged, height: S.forged,
          }}>
            <div className="forged-medal" style={{
              width: S.forged, height: S.forged,
              left: "50%", top: "50%",
              transform: "translate(-50%, -50%)",
            }} />
          </div>

          {/* Metric sheet — directly below medal */}
          <div style={{
            width: "100%",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}>
            {chipData.map(([k, v, u]) => (
              <div key={k} className="metric-chip" style={{ padding: "10px 12px", minWidth: 0 }}>
                <div className="label">{k}</div>
                <div className="value-row">
                  <span className="value" style={{ fontSize: 20 }}>{v}</span>
                  <span className="unit">{u}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Actions — Run Again centered; Share floats right */}
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 14, width: "100%" }}>
            <button className="capsule-primary" style={{ padding: "13px 26px", fontSize: 11 }}>
              <IconRefresh /><span>Run Again</span>
            </button>
            <button className="icon-btn" aria-label="Share" style={{
              position: "absolute",
              left: "calc(50% + 86px)",
              width: 44, height: 44, borderRadius: 14,
            }}>
              <IconShare />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="frame">
      <StarBg />
      <AppChrome inset={S.chromeInset} />

      {/* Forged medal — center */}
      <ForgedMedal size={S.forged} top="46%" />

      {/* Grade — small badge above medal */}
      <div style={{
        position: "absolute",
        left: 0, right: 0,
        top: breakpoint === "mobile" ? "auto" : "16%",
        display: "flex", justifyContent: "center",
        zIndex: 5,
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 14,
          padding: "10px 20px 10px 14px",
          borderRadius: 999,
          background: "rgba(255,255,255,.06)",
          border: "1px solid rgba(255,255,255,.14)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(180deg, #f5d28a, #b07a3c)",
            color: "#0a0a0c",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 600, fontSize: 16, letterSpacing: "-.02em",
            boxShadow: "0 0 16px rgba(245,210,138,.4)",
          }}>S</div>
          <div className="mono" style={{
            fontSize: 10, letterSpacing: ".26em",
            textTransform: "uppercase", color: "rgba(255,255,255,.85)",
          }}>
            Lightspeed · Top tier
          </div>
        </div>
      </div>

      {/* Title — only on desktop / tablet, small, top-left */}
      {!isMobile && (
        <div style={{
          position: "absolute",
          top: S.titleTop, left: S.titleLeft,
          zIndex: 5, maxWidth: 320,
        }}>
          <div className="mono" style={{
            fontSize: 10, letterSpacing: ".3em",
            color: "rgba(255,255,255,.5)",
            textTransform: "uppercase", marginBottom: 12,
          }}>
            Benchmark complete · Apr 30
          </div>
          <div style={{
            fontFamily: "var(--font-serif)",
            fontSize: breakpoint === "tablet" ? 36 : 44,
            fontWeight: 400, fontStyle: "italic",
            letterSpacing: "-.02em", lineHeight: 1,
          }}>
            Your connection,<br />
            <em style={{ fontFamily: "var(--font-display)", fontStyle: "normal", fontWeight: 500 }}>forged.</em>
          </div>
        </div>
      )}

      {/* Metric chips — desktop/tablet float around the medal */}
      {!isMobile && chipData.map(([k, v, u], i) => {
        // angles: top-left, top-right, bottom-right, bottom-left
        const angles = [-150, -30, 30, 150];     // degrees
        const ring = S.metricRing / 2;
        const a = (angles[i] * Math.PI) / 180;
        const x = Math.cos(a) * ring;
        const y = Math.sin(a) * ring;
        return (
          <div key={k} className="metric-chip" style={{
            position: "absolute",
            left: `calc(50% + ${x}px)`,
            top:  `calc(46% + ${y}px)`,
            transform: "translate(-50%, -50%)",
            minWidth: S.chipMin,
            zIndex: 5,
          }}>
            <div className="label">{k}</div>
            <div className="value-row">
              <span className="value" style={{ fontSize: S.chipValueSize }}>{v}</span>
              <span className="unit">{u}</span>
            </div>
          </div>
        );
      })}



      {/* Action bar — Run Again centered; Share floats to the right */}
      <div style={{
        position: "absolute",
        left: 0, right: 0,
        bottom: breakpoint === "mobile" ? "auto" : breakpoint === "tablet" ? "22%" : "8%",
        top: isMobile ? "auto" : "auto",
        display: "flex", justifyContent: "center", alignItems: "center",
        zIndex: 5,
      }}>
        <button className="capsule-primary" style={{
          padding: breakpoint === "mobile" ? "13px 26px" : "26px 72px",
          fontSize: breakpoint === "mobile" ? 11 : 17,
        }}>
          <IconRefresh /><span>Run Again</span>
        </button>
        <button className="icon-btn" aria-label="Share" style={{
          position: "absolute",
          left: "calc(50% + " + (breakpoint === "mobile" ? 86 : 200) + "px)",
          width: breakpoint === "mobile" ? 44 : 68,
          height: breakpoint === "mobile" ? 44 : 68,
          borderRadius: breakpoint === "mobile" ? 14 : 18,
        }}>
          <IconShare />
        </button>
      </div>
    </div>
  );
};

Object.assign(window, { IdleScreen, TestingScreen, ResultScreen });
