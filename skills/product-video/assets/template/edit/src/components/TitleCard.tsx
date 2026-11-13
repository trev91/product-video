import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import { ACCENT, DARK, LIGHT } from "../brand";
import { BODY, HEADING } from "../fonts";
import { Logo, logoHeight as logoHeightFor } from "./Logo";

interface TitleCardProps {
  heading: string;
  subline: string;
}

/** Title card: logo, heading, accent rule, subline, on for the first six seconds. */
export const TitleCard: React.FC<TitleCardProps> = ({ heading, subline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const logoProgress = interpolate(t, [0, 0.6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const headingOpacity = interpolate(t, [0.4, 0.9], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const accentWidth = interpolate(t, [0.8, 1.3], [0, 160], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const sublineOpacity = interpolate(t, [1.1, 1.6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Logo 880 px wide, centre at 40% height.
  const logoWidth = 880;
  const logoHeight = logoHeightFor(logoWidth);
  const logoTop = Math.round(1080 * 0.4 - logoHeight / 2);

  return (
    <AbsoluteFill style={{ backgroundColor: LIGHT }}>
      <Logo
        width={logoWidth}
        style={{
          position: "absolute",
          left: (1920 - logoWidth) / 2,
          top: logoTop + (1 - logoProgress) * 20,
          opacity: logoProgress,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: logoTop + logoHeight + 48,
          left: 0,
          width: 1920,
          textAlign: "center",
          fontFamily: HEADING,
          fontWeight: 700,
          fontSize: 84,
          lineHeight: "100px",
          color: DARK,
          opacity: headingOpacity,
        }}
      >
        {heading}
      </div>
      <div
        style={{
          position: "absolute",
          top: logoTop + logoHeight + 48 + 100 + 24,
          left: (1920 - accentWidth) / 2,
          width: accentWidth,
          height: 8,
          backgroundColor: ACCENT,
          borderRadius: 4,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: logoTop + logoHeight + 48 + 100 + 24 + 8 + 24,
          left: 0,
          width: 1920,
          textAlign: "center",
          fontFamily: BODY,
          fontWeight: 400,
          fontSize: 36,
          lineHeight: "46px",
          color: DARK,
          opacity: sublineOpacity,
        }}
      >
        {subline}
      </div>
      <div
        style={{ position: "absolute", left: 0, bottom: 0, width: 1920, height: 12, backgroundColor: ACCENT }}
      />
    </AbsoluteFill>
  );
};
