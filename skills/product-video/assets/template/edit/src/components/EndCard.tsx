import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import { ACCENT, DARK, LIGHT } from "../brand";
import { BODY, HEADING } from "../fonts";
import { Logo, logoHeight as logoHeightFor } from "./Logo";

interface EndCardProps {
  durationInFrames: number;
  heading: string;
  subline: string;
  contactLine: string;
}

/** End card: fade in together, hold, fade to black over the last second. */
export const EndCard: React.FC<EndCardProps> = ({ durationInFrames, heading, subline, contactLine }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const total = durationInFrames / fps;

  const fadeIn = interpolate(t, [0, 0.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeToBlack = interpolate(t, [total - 1, total], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const logoWidth = 720;
  const logoHeight = logoHeightFor(logoWidth);
  const logoTop = 300;

  return (
    <AbsoluteFill style={{ backgroundColor: LIGHT }}>
      <div style={{ position: "absolute", inset: 0, opacity: fadeIn }}>
        <Logo width={logoWidth} style={{ position: "absolute", left: (1920 - logoWidth) / 2, top: logoTop }} />
        <div
          style={{
            position: "absolute",
            top: logoTop + logoHeight + 56,
            left: 0,
            width: 1920,
            textAlign: "center",
            fontFamily: HEADING,
            fontWeight: 700,
            fontSize: 64,
            lineHeight: "78px",
            color: DARK,
          }}
        >
          {heading}
        </div>
        <div
          style={{
            position: "absolute",
            top: logoTop + logoHeight + 56 + 78 + 28,
            left: 0,
            width: 1920,
            textAlign: "center",
            fontFamily: BODY,
            fontWeight: 400,
            fontSize: 32,
            lineHeight: "44px",
            color: DARK,
          }}
        >
          {subline}
        </div>
        <div
          style={{
            position: "absolute",
            top: logoTop + logoHeight + 56 + 78 + 28 + 44 + 12,
            left: 0,
            width: 1920,
            textAlign: "center",
            fontFamily: BODY,
            fontWeight: 400,
            fontSize: 32,
            lineHeight: "44px",
            color: DARK,
          }}
        >
          {contactLine}
        </div>
        <div
          style={{ position: "absolute", left: 0, bottom: 0, width: 1920, height: 12, backgroundColor: ACCENT }}
        />
      </div>
      <div style={{ position: "absolute", inset: 0, backgroundColor: "#000", opacity: fadeToBlack }} />
    </AbsoluteFill>
  );
};
