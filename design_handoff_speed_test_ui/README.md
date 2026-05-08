# Handoff: Ultimate Speed Test — Native-feel UI Redesign

## Overview
This handoff covers a redesigned UI layer for the Ultimate Speed Test PWA. The redesign keeps the existing experiential core untouched — the WebGL particle/shader background, the 3D rotating medal (with mouse-drag, pinch-zoom, double-click reset, auto-rotation), and the speed-test logic — and rebuilds **only the surrounding chrome and screens** so the app reads as a polished native application (Apple / Focus Flight tier of craft) rather than a web page.

Three primary screens are covered, each at three breakpoints:

- **Idle** — pre-test state with the medal as hero
- **Testing** — live readings during a measurement
- **Result** — completed test with grade + 4 metrics around the medal

Breakpoints: **Desktop ≥ 1024 / Tablet 768–1023 / Mobile < 768**.

## About the Design Files
The HTML / JSX / CSS files in this bundle are **design references**, not production code. They are inline-React prototypes loaded through Babel-standalone for fast iteration. The implementation task is to **recreate these designs inside the existing `app/` codebase** (vanilla JS + a single `index.html` + `style.css` + `medal.js` + `app-v2.js`) — preserving its existing screen-state machine, medal canvas, shader renderer, and Cloudflare worker integration. Do not ship the prototype JSX as-is.

## Fidelity
**High-fidelity.** Spacing, typography, colors, button sizing, and breakpoint behavior are intentional and should be reproduced precisely. Where the prototype draws a CSS facsimile (e.g. `.idle-puck`, `.forged-medal`, `.test-puck`), the real app should use its existing 3D medal canvas in the same position with the same dimensions.

## Visual Language

- **Pure black** (`#000`) base, starfield background (real app uses the existing shader)
- **Glass surfaces**: `rgba(255,255,255,.06)` fill, `1px solid rgba(255,255,255,.14)` border, `backdrop-filter: blur(20px)`
- **Capsule buttons** as the primary action language — pill-shaped, white gradient fill, mono small caps label
- **Icon buttons** as 14–18px-radius rounded squares (not circles, not pills) — matches Apple iPadOS toolbar feel
- **Type**: Space Grotesk display + Instrument Serif italic for emotional moments + IBM Plex Mono for labels/units
- **Generous letter-spacing** on every mono label (`.26em`–`.4em`, uppercase) — reinforces the instrument-panel feel
- **No emoji, no gradients-as-decoration, no SVG illustrations** — the medal carries all the imagery

## Screens

### 1. Idle
**Purpose:** rest state. User sees the medal at rest, taps START.

**Layout (desktop):**
- Top-left: brand glyph (36×36 rounded square with crosshair) + wordmark
- Top-right: 2 icon buttons (history, about), 36×36, 14px radius
- Center: idle puck (real app: 3D medal in idle pose) — 380px diameter, anchored at `top: 44%`
- Below puck (`top: 64%`): two-line title (Instrument Serif italic 64px "How fast does *your signal* travel.") + mono subtitle (`Press to begin · Takes ~25s`, 12px, .34em tracking, 50% white)
- Bottom (`bottom: 10%`): START capsule — `padding: 26px 72px`, `font-size: 17px`, mono uppercase, white gradient fill, with chevron-right icon
- Bottom-left status (`bottom: 28px`): tiny live dot + `CLOUDFLARE · ANYCAST` mono 9px, 35% white

**Tablet:** title `top: 64%`, START button `bottom: 12%`, padding `24×64`, font-size 16. Puck 320.

**Mobile:** puck 260, anchored higher (`top: 38%`). Title `top: 58%`. START `bottom: 14%`, padding `18×44`, font-size 13. Status row hidden. Title font-size 44.

### 2. Testing
**Purpose:** live measurement. Phase pill shows progress, big number is current reading, small chips are secondary stats, cancel sits below.

**Layout (desktop):**
- Top-center (`top: 11%`): phase pill — three segments (`Ping ✓`, `Download`, `Upload`), glass background with active segment highlighted by a pulsing dot
- Center: dim test puck (real app: medal continues rotating, slightly dimmed). Lightspeed streaks pass through
- Center text:
  - Mono label `Downstream · 6 streams` (12px, .4em, 55% white), with strong text-shadow for legibility against streaks
  - Big tabular-numeric reading `882.71` (font-size 168, weight 200, letter-spacing -.045em, line-height 1) + small `MBPS` unit (mono 18, .22em, 60% white)
- Bottom (`bottom: 8%`): three metric chips (Peak / Ping / Elapsed) in a row, gap 10. Each chip is glass with mono label + tabular value + unit. Below them, gap 16, a Cancel capsule-secondary (transparent, white-bordered, 14×28 padding)

**Tablet:** value 140, chips 3 still, bottom `10%`, gap 16. Phase pill same `top: 11%`.

**Mobile:** phase pill `top: 10%`, value 96, chips collapse to 2 (Peak / Ping), bottom `12%`, gap 14. Cancel padding `12×22`.

### 3. Result
**Purpose:** show grade and 4 metrics surrounding the forged medal.

**Layout (desktop):**
- Top-center (`top: 16%`): grade pill — small glass capsule containing a 28×28 gold-gradient `S` badge + mono caption `Lightspeed · Top tier`
- Top-left (`top: 96px, left: 56px`): mono date `BENCHMARK COMPLETE · APR 30` + serif italic title `Your connection, *forged.*` (44px)
- Center: forged medal (real app: 3D medal in forged-grade pose), 420 diameter, anchored `top: 46%`
- Around medal: 4 metric chips on a 720-diameter orbit at angles -150°/-30°/30°/150° (Download / Upload / Ping / Jitter). Each chip min-width 156, glass, mono label + 32px tabular value + mono unit
- Bottom (`bottom: 8%`): Run Again capsule-primary (`padding: 26×72, font-size: 17`, with refresh icon at 1.2em), centered. Share icon button (68×68, radius 18) absolute-positioned at `left: calc(50% + 200px)` so the primary action remains visually centered

**Tablet:** medal 360, chip orbit 600. Grade pill `top: 16%`, title `top: 80px`. Run Again uses **the same desktop sizing** (26×72 / 17px) but `bottom: 22%` to pull it visually closer to the medal in the taller tablet frame. Share offset 160px.

**Mobile:** layout switches to a vertical flex stack centered in the frame (`justify-content: center, gap: 22px`):
1. Grade pill (smaller: 26×26 badge, 9px caption)
2. Forged medal (200 diameter, no orbit)
3. 2×2 metric grid (chips with smaller padding `10×12`, value font-size 20)
4. Action row: Run Again (`padding: 13×26, font-size: 11`) centered + Share icon (44×44, radius 14) absolute at `left: calc(50% + 86px)`

## Design Tokens

### Colors
- Background: `#000`
- Glass fill: `rgba(255,255,255,.06)`
- Glass border: `rgba(255,255,255,.14)`
- Glass strong fill: `rgba(255,255,255,.10)`
- Text primary: `#fff`
- Text secondary: `rgba(255,255,255,.6)`
- Text tertiary: `rgba(255,255,255,.5)`
- Text disabled / micro: `rgba(255,255,255,.35)`
- Capsule primary fill: `linear-gradient(180deg, rgba(255,255,255,.96), rgba(235,235,238,.92))` on text `#000`
- Grade S badge: `linear-gradient(180deg, #f5d28a, #b07a3c)` on text `#0a0a0c`, glow `0 0 16px rgba(245,210,138,.4)`

### Typography
- `--font-display`: "Space Grotesk", system-ui, sans-serif
- `--font-serif`: "Instrument Serif", Georgia, serif (italic for emotional moments)
- `--font-mono`: "IBM Plex Mono", ui-monospace, monospace
- Mono labels are always **uppercase** with `.26em`–`.4em` letter-spacing

### Spacing / Radii
- Chrome inset: desktop 22, tablet 18, mobile 16
- Frame side padding: desktop 56, tablet 40, mobile 24
- Icon button radius: 14 (mobile/small), 18 (large)
- Glass card radius: 14–20
- Capsule radius: 999

### Easing
- `--ease-spring`: `cubic-bezier(.2,.9,.3,1.4)` (used on capsule press)
- Default UI: `cubic-bezier(.2,.7,.2,1)`

## Interactions to preserve from the real app
- Medal: drag-rotate, pinch / wheel zoom, double-click reset, auto-rotation (~0.0028 rad/frame)
- Shader background: continues animating across all three states (do not pause)
- Phase pill on Testing: active segment uses a pulsing live-dot; transitioning to "done" replaces dot with a check-circle
- Run Again hover: `translateY(-1px) scale(1.02)`. Press: `scale(.97)`. Both use `--ease-spring`
- Glass capsule has `box-shadow` mixing inner highlight + ambient white halo:
  ```
  0 1px 0 rgba(255,255,255,.6) inset,
  0 -8px 20px rgba(0,0,0,.05) inset,
  0 18px 40px rgba(255,255,255,.18),
  0 0 0 1px rgba(255,255,255,.4)
  ```

## Files in this bundle
- `v3.html` — host file with design canvas of all 9 artboards
- `v3.css` — all design-system styles (tokens, capsules, chips, glass, phase pill, fake medal/puck CSS)
- `v3-frames.jsx` — shared primitives (BrandGlyph, AppChrome, IconButton, IdlePuck, ForgedMedal, TestPuck, IconRefresh, IconShare, IconArrow, IconClose, StarBg, LightBg)
- `v3-screens.jsx` — `IdleScreen`, `TestingScreen`, `ResultScreen` components, each taking a `breakpoint` prop and rendering the layout for that size
- `v3-app.jsx` — host that composes the design canvas with all 9 artboards
- `design-canvas.jsx` — pan/zoom canvas component used to display the artboards side-by-side (only used in the design tool, not in the real app)

## Implementation guidance for the real app
1. Keep `app/index.html`'s screen-state machine (`screen.idle`, `screen.testing`, `screen.result` on `.screen.active`) — replace **only the inner markup** of each screen.
2. Reuse `medal.js` as-is. The `<canvas id="medal">` element should sit at the same anchor used by `IdlePuck` / `TestPuck` / `ForgedMedal` in the prototype.
3. Reuse `ShaderRenderer` as-is — it stays mounted across all three states.
4. Replace `style.css` chrome-related classes with the v3 tokens. The capsule button class names (`.capsule-primary`, `.capsule-secondary`, `.icon-btn`, `.metric-chip`, `.phase-pill`, `.brand-glyph`) can be lifted directly.
5. Implement breakpoints with a single `data-bp` attribute on `body` set by a `matchMedia` listener, then drive size variants from CSS (or inline style). Avoid duplicating screen markup per breakpoint.
6. Result-screen orbit positioning of metric chips should be pure CSS (`left: calc(50% + Xpx); top: calc(46% + Ypx)`) so it costs zero JS.
7. Mobile Result is structurally different (vertical stack instead of orbit) — gate that with `[data-bp="mobile"]`.
