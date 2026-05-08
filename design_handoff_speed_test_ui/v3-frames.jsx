// Shared bits for the V3 native-app frames

const StarBg  = () => <div className="bg bg-stars" />;
const LightBg = () => <div className="bg bg-light" />;

// Procedural dark puck — used in idle. Sized via prop. Caller passes top via style.
const IdlePuck = ({ size = 360, top = "50%", left = "50%" }) => (
  <div className="idle-puck" style={{
    width: size, height: size,
    left, top,
    transform: `translate(-50%, -50%)`,
  }} />
);

const ForgedMedal = ({ size = 380, top = "50%", left = "50%" }) => (
  <div className="forged-medal" style={{
    width: size, height: size,
    left, top,
    transform: `translate(-50%, -50%)`,
  }} />
);

const TestPuck = ({ size = 240, top = "50%", left = "50%" }) => (
  <div className="test-puck" style={{
    width: size, height: size,
    left, top,
    transform: `translate(-50%, -50%)`,
  }} />
);

// Brand glyph (small targeting cross in a glass tile)
const BrandGlyph = () => (
  <div className="brand-glyph">
    <div className="inner" />
  </div>
);

// SVG icons for chrome icon-buttons
const IconClock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" strokeLinecap="round" />
  </svg>
);
const IconInfo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.5v.5" strokeLinecap="round" />
  </svg>
);
const IconShare = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 4v11M12 4l-4 4M12 4l4 4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 13v5a2 2 0 002 2h10a2 2 0 002-2v-5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconRefresh = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 12a9 9 0 0115.5-6.3M21 4v5h-5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M21 12a9 9 0 01-15.5 6.3M3 20v-5h5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconArrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconClose = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round"/>
  </svg>
);

// App chrome — minimal: brand glyph top-left, two icon buttons top-right.
// inset is { top, side } to adapt across breakpoints.
const AppChrome = ({ inset = { top: 22, side: 22 } }) => (
  <>
    <div className="app-chrome" style={{ top: inset.top, left: inset.side }}>
      <BrandGlyph />
    </div>
    <div className="app-chrome" style={{
      top: inset.top, right: inset.side,
      display: "flex", gap: 8,
    }}>
      <button className="icon-btn" aria-label="History"><IconClock /></button>
      <button className="icon-btn" aria-label="About"><IconInfo /></button>
    </div>
  </>
);

// SectionHead for design canvas titles
const SectionHead = ({ num, name, desc }) => (
  <div className="section-head">
    <span className="num">{num}</span>
    <span className="name">{name}</span>
    <span className="desc">{desc}</span>
  </div>
);

Object.assign(window, {
  StarBg, LightBg, IdlePuck, ForgedMedal, TestPuck,
  BrandGlyph, AppChrome, SectionHead,
  IconClock, IconInfo, IconShare, IconRefresh, IconArrow, IconClose,
});
