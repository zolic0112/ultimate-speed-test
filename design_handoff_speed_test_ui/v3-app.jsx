// V3 canvas — Native-app direction
// Idle / Testing / Result × Desktop / Tablet / Mobile

const { DesignCanvas, DCSection, DCArtboard } = window;

// Real device-ish viewport sizes
const DESKTOP = { w: 1440, h: 900 };
const TABLET  = { w: 834,  h: 1112 };  // iPad
const MOBILE  = { w: 390,  h: 844 };   // iPhone 14

const App = () => (
  <DesignCanvas
    title="Speed Test — Native App Direction"
    subtitle="Glass capsules, large radii, soft shadows. Medal stays in frame across all phases. Three breakpoints — same design language."
    initialZoom={0.4}
  >
    <DCSection
      id="desktop"
      title="Desktop / 1440 × 900"
      subtitle="Generous negative space. Medal is the hero on idle and result; on test it sits behind the streaks. Action lives at the bottom."
    >
      <DCArtboard id="d-idle"   label="Idle"    width={DESKTOP.w} height={DESKTOP.h}><IdleScreen    breakpoint="desktop" /></DCArtboard>
      <DCArtboard id="d-test"   label="Testing" width={DESKTOP.w} height={DESKTOP.h}><TestingScreen breakpoint="desktop" /></DCArtboard>
      <DCArtboard id="d-result" label="Result"  width={DESKTOP.w} height={DESKTOP.h}><ResultScreen  breakpoint="desktop" /></DCArtboard>
    </DCSection>

    <DCSection
      id="tablet"
      title="Tablet / 834 × 1112"
      subtitle="Portrait iPad. Same components, tighter spacing. Result chips orbit closer to the medal."
    >
      <DCArtboard id="t-idle"   label="Idle"    width={TABLET.w} height={TABLET.h}><IdleScreen    breakpoint="tablet" /></DCArtboard>
      <DCArtboard id="t-test"   label="Testing" width={TABLET.w} height={TABLET.h}><TestingScreen breakpoint="tablet" /></DCArtboard>
      <DCArtboard id="t-result" label="Result"  width={TABLET.w} height={TABLET.h}><ResultScreen  breakpoint="tablet" /></DCArtboard>
    </DCSection>

    <DCSection
      id="mobile"
      title="Mobile / 390 × 844"
      subtitle="iPhone-class. Title text removed on idle (just the medal + capsule). Result chips collapse to a 2×2 sheet so the medal stays untouched."
    >
      <DCArtboard id="m-idle"   label="Idle"    width={MOBILE.w} height={MOBILE.h}><IdleScreen    breakpoint="mobile" /></DCArtboard>
      <DCArtboard id="m-test"   label="Testing" width={MOBILE.w} height={MOBILE.h}><TestingScreen breakpoint="mobile" /></DCArtboard>
      <DCArtboard id="m-result" label="Result"  width={MOBILE.w} height={MOBILE.h}><ResultScreen  breakpoint="mobile" /></DCArtboard>
    </DCSection>
  </DesignCanvas>
);

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
