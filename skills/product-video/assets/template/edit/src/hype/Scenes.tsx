import type { FC, ReactNode } from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { ACCENT, ACCENT_RGB, DARK, LIGHT, PRODUCT_NAME, TAGLINE } from "../brand";
import { Logo } from "../components/Logo";
import { BODY } from "../fonts";
import { Browser, Camera, Layer, Phone } from "./Devices";
import { BAR, BEAT } from "./grid";
import { ramp, track } from "./motion";
import { Block, Caption, Eyebrow, Headline, words } from "./Type";

/**
 * Example scenes: one of each pattern, rendering without any captured media.
 * Replace each <Placeholder> with <Still src="raw/web/still-home.png" /> or
 * <Clip src="raw/cuts/home.mp4" /> (from ./Devices), rewrite the words, and
 * re-time the frames. Frame numbers are local to the scene: BAR is one bar,
 * BEAT one beat, and words land on beats.
 */

/** Stand-in for a capture, so the template renders before anything is recorded. */
const Placeholder: FC<{ label: string; dark?: boolean; children?: ReactNode }> = ({ label, dark = false, children }) => (
  <AbsoluteFill
    style={{
      alignItems: "center",
      justifyContent: "center",
      background: dark
        ? `linear-gradient(160deg, rgba(${ACCENT_RGB},0.55), #0b0c0d 70%)`
        : `linear-gradient(160deg, #ffffff, rgba(${ACCENT_RGB},0.16))`,
      fontFamily: BODY,
      fontWeight: 600,
      fontSize: 34,
      color: dark ? "rgba(255,255,255,0.85)" : DARK,
    }}
  >
    {label}
    {children}
  </AbsoluteFill>
);

/** Type only: the promise, one line replacing the other on the bar line. */
export const ColdOpen: FC = () => (
  <>
    <Block side="center">
      <Headline lines={[words("One line.", 8)]} size={150} align="center" exitAt={BAR - 4} />
    </Block>
    <Block side="center">
      <Headline lines={[words("Then the turn.", BAR, BEAT, 1)]} size={150} align="center" exitAt={2 * BAR - 4} />
    </Block>
  </>
);

/** A phone rises in, drifts to one side, and its screen changes while the words land beside it. */
export const PhoneAct: FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame, fps, config: { damping: 200, stiffness: 80 } });
  return (
    <>
      <Phone
        height={820}
        x={track(frame, [[0, 0], [BAR, -420], [3 * BAR, 420]])}
        y={(1 - rise) * 1050 + 8 * Math.sin(frame / 38)}
        rotateY={track(frame, [[0, 0], [BAR, 14], [3 * BAR, -14]])}
        rotateX={3}
        scale={track(frame, [[0, 1.05], [BAR, 1]])}
      >
        <Layer from={0} to={3 * BAR + 10} fade={1}>
          <Placeholder label="First screen" dark />
        </Layer>
        <Layer from={3 * BAR}>
          <Placeholder label="Second screen" dark />
        </Layer>
      </Phone>
      <Block side="right">
        <Eyebrow text="The app" at={BAR} exitAt={3 * BAR - 4} />
        <Headline lines={[words("Say what", BAR + BEAT), words("it does.", BAR + 3 * BEAT, BEAT, 0)]} size={104} exitAt={3 * BAR - 4} />
      </Block>
      <Block side="left">
        <Eyebrow text="And then" at={3 * BAR} />
        <Headline lines={[words("Show the", 3 * BAR + BEAT), words("next thing.", 3 * BAR + 3 * BEAT, BEAT, 0)]} size={104} />
      </Block>
    </>
  );
};

/** A browser window settles, then the camera pushes in on one part of the page. */
export const BrowserAct: FC = () => {
  const frame = useCurrentFrame();
  const settle = ramp(frame, 0, 24);
  return (
    <>
      <Browser width={1200} y={-36 + (1 - settle) * 80} rotateX={(1 - settle) * 10} scale={0.92 + 0.08 * settle} opacity={settle}>
        <Camera zoom={track(frame, [[0, 1], [2 * BAR, 1.7]], 30)} fx={0.3} fy={0.35}>
          <Placeholder label="A page of the web app" />
        </Camera>
      </Browser>
      <Caption>
        <Headline lines={[words("One caption under the window.", BAR, 6)]} size={46} weight={600} align="center" />
      </Caption>
    </>
  );
};

/** Flip to the light card: logo, tagline, accent rule. */
export const Outro: FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame: frame - 8, fps, config: { damping: 200, stiffness: 120 } });
  return (
    <AbsoluteFill style={{ backgroundColor: LIGHT, clipPath: `circle(${ramp(frame, 0, 14, 0, 1200)}px at 50% 50%)` }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <Logo width={760} style={{ opacity: ramp(frame, 8, 16), transform: `scale(${0.9 + 0.1 * logo})` }} />
        <div style={{ height: 56 }} />
        <Headline lines={[words(TAGLINE || PRODUCT_NAME, BAR, 6)]} size={56} weight={600} color={DARK} align="center" />
        <div style={{ marginTop: 30, height: 6, borderRadius: 3, width: 150 * ramp(frame, BAR + 32, BAR + 52), backgroundColor: ACCENT }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
