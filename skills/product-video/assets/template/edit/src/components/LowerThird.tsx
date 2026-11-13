import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import { ACCENT, DARK, LIGHT, SAFE_X } from "../brand";
import { BODY, HEADING } from "../fonts";

interface LowerThirdProps {
  title: string;
  subtitle: string;
}

/** Scene label: on screen 3 s, slide in 40 px with a fade. */
export const LowerThird: React.FC<LowerThirdProps> = ({ title, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const HOLD_UNTIL = 3.0;

  const enter = interpolate(t, [0, 0.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const exit = interpolate(t, [HOLD_UNTIL - 0.3, HOLD_UNTIL], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (t > HOLD_UNTIL) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: SAFE_X + (1 - enter) * -40,
        bottom: 250,
        opacity: Math.min(enter, exit),
        display: "flex",
        flexDirection: "row",
        backgroundColor: "rgba(61,59,58,0.9)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div style={{ width: 8, backgroundColor: ACCENT }} />
      <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontFamily: HEADING, fontWeight: 600, fontSize: 40, lineHeight: "48px", color: LIGHT }}>
          {title}
        </div>
        <div style={{ fontFamily: BODY, fontWeight: 500, fontSize: 26, lineHeight: "32px", color: ACCENT }}>
          {subtitle}
        </div>
      </div>
      <div style={{ display: "none", color: DARK }} />
    </div>
  );
};
