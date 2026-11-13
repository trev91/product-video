import type { FC } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { ACCENT_RGB, STAGE } from "../brand";

export const INK = STAGE;

/** Near-black stage with a slow glow in the accent colour, shared by every dark scene. */
export const Stage: FC = () => {
  const frame = useCurrentFrame();
  const x = 50 + 24 * Math.sin(frame / 140);
  const y = 58 + 12 * Math.cos(frame / 110);
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(58% 62% at ${x}% ${y}%, rgba(${ACCENT_RGB},0.20), rgba(${ACCENT_RGB},0.05) 45%, rgba(0,0,0,0) 72%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(40% 45% at ${100 - x}% ${18 + y / 6}%, rgba(${ACCENT_RGB},0.08), rgba(0,0,0,0) 70%)`,
        }}
      />
      <AbsoluteFill
        style={{ background: "radial-gradient(120% 120% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)" }}
      />
    </AbsoluteFill>
  );
};
