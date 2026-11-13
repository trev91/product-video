import type { FC, ReactNode } from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { ACCENT, LIGHT } from "../brand";
import { BODY, HEADING } from "../fonts";
import { BEAT } from "./grid";
import { EASE_IN, ramp } from "./motion";

export type Word = { text: string; at: number; color?: string };

/** Splits a phrase into words that land one per `step` frames; words from `accentFrom` on take the accent colour. */
export function words(text: string, start: number, step: number = BEAT, accentFrom?: number): Word[] {
  return text.split(" ").map((part, index) => ({
    text: part,
    at: start + index * step,
    color: accentFrom !== undefined && index >= accentFrom ? ACCENT : undefined,
  }));
}

const WordView: FC<{ word: Word; size: number; exitAt?: number; last: boolean }> = ({ word, size, exitAt, last }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - word.at;
  const enter = spring({ frame: local, fps, config: { damping: 200, stiffness: 240, mass: 0.7 } });
  const exit = exitAt === undefined ? 0 : ramp(frame, exitAt - 6, exitAt, 0, 1, EASE_IN);
  const opacity = ramp(local, 0, 4, 0, 1) * (1 - exit);
  const y = (1 - enter) * size * 0.42 - exit * size * 0.18;
  const blur = (1 - enter) * 16 + exit * 10;
  return (
    <span
      style={{
        display: "inline-block",
        marginRight: last ? 0 : "0.25em",
        color: word.color,
        opacity,
        transform: `translateY(${y}px)`,
        filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
      }}
    >
      {word.text}
    </span>
  );
};

type HeadlineProps = {
  lines: Word[][];
  size: number;
  align?: "left" | "center";
  exitAt?: number;
  color?: string;
  weight?: 600 | 700;
};

/** Kinetic headline: each word rises into place on its own frame, the whole line leaves at `exitAt`. */
export const Headline: FC<HeadlineProps> = ({ lines, size, align = "left", exitAt, color = LIGHT, weight = 700 }) => (
  <div
    style={{
      fontFamily: HEADING,
      fontWeight: weight,
      fontSize: size,
      lineHeight: 1.06,
      letterSpacing: "-0.035em",
      color,
      textAlign: align,
    }}
  >
    {lines.map((line, lineIndex) => (
      <div key={lineIndex} style={{ whiteSpace: "nowrap" }}>
        {line.map((word, wordIndex) => (
          <WordView key={wordIndex} word={word} size={size} exitAt={exitAt} last={wordIndex === line.length - 1} />
        ))}
      </div>
    ))}
  </div>
);

/** Small accent-coloured label above a headline. A negative `at` shows it already in place. */
export const Eyebrow: FC<{ text: string; at?: number; exitAt?: number }> = ({ text, at = 0, exitAt }) => {
  const frame = useCurrentFrame();
  const exit = exitAt === undefined ? 0 : ramp(frame, exitAt - 6, exitAt, 0, 1, EASE_IN);
  return (
    <div
      style={{
        fontFamily: BODY,
        fontWeight: 600,
        fontSize: 26,
        letterSpacing: "0.26em",
        textTransform: "uppercase",
        color: ACCENT,
        marginBottom: 26,
        opacity: ramp(frame, at, at + 8) * (1 - exit),
      }}
    >
      {text}
    </div>
  );
};

const SIDES = {
  left: { left: 120, width: 880 },
  right: { left: 900, width: 920 },
  center: { left: 0, width: 1920 },
} as const;

/** A vertically centered text column on one side of the frame. */
export const Block: FC<{ side: keyof typeof SIDES; children: ReactNode }> = ({ side, children }) => (
  <AbsoluteFill
    style={{
      ...SIDES[side],
      flexDirection: "column",
      justifyContent: "center",
      alignItems: side === "center" ? "center" : "flex-start",
    }}
  >
    {children}
  </AbsoluteFill>
);

/** One caption line pinned under a browser window, centered on the given column. */
export const Caption: FC<{ children: ReactNode; top?: number; left?: number; width?: number }> = ({
  children,
  top = 924,
  left = 0,
  width = 1920,
}) => (
  <AbsoluteFill style={{ top, left, width, height: 90, alignItems: "center", justifyContent: "flex-start" }}>
    {children}
  </AbsoluteFill>
);
