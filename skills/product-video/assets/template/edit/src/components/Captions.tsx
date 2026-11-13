import { useCurrentFrame, useVideoConfig } from "remotion";

import { LIGHT } from "../brand";
import { BODY } from "../fonts";

export interface AbsoluteCaption {
  start: number;
  end: number;
  text: string;
}

/** Burned-in captions: body font SemiBold 44 px on a 70% dark box, 64 px up. */
export const Captions: React.FC<{ captions: AbsoluteCaption[] }> = ({ captions }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const current = captions.find((c) => t >= c.start && t < c.end);
  if (!current) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 64,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(61,59,58,0.7)",
          color: LIGHT,
          fontFamily: BODY,
          fontWeight: 600,
          fontSize: 44,
          lineHeight: "56px",
          padding: "14px 24px",
          borderRadius: 10,
          textAlign: "center",
          whiteSpace: "pre-line",
          maxWidth: 1500,
        }}
      >
        {current.text}
      </div>
    </div>
  );
};
