import type { FC, ReactNode } from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";

import { ACCENT_RGB, PHONE_ASPECT, STILL_ASPECT, WINDOW_TITLE } from "../brand";
import { BODY } from "../fonts";
import { ramp } from "./motion";

const BROWSER_BAR = 40;
const SHADOW = `0 70px 140px rgba(0,0,0,0.65), 0 0 110px rgba(${ACCENT_RGB},0.13)`;

type Pose = {
  x?: number;
  y?: number;
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  scale?: number;
  opacity?: number;
};

function poseTransform({ x = 0, y = 0, rotateX = 0, rotateY = 0, rotateZ = 0, scale = 1 }: Pose): string {
  return `translate(${x}px, ${y}px) scale(${scale}) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`;
}

/** A floating phone. `height` is the screen height in pixels; children fill the screen. */
export const Phone: FC<Pose & { height: number; children: ReactNode }> = ({ height, children, ...pose }) => {
  const width = height * PHONE_ASPECT;
  const bezel = width * 0.032;
  const radius = width * 0.15;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", perspective: 2400, opacity: pose.opacity ?? 1 }}>
      <div
        style={{
          boxSizing: "border-box",
          width: width + bezel * 2,
          height: height + bezel * 2,
          padding: bezel,
          borderRadius: radius + bezel,
          background: "linear-gradient(145deg, #4a4d52 0%, #17181a 22%, #0a0a0b 60%, #2a2c30 100%)",
          boxShadow: `${SHADOW}, inset 0 0 0 1.5px rgba(255,255,255,0.14)`,
          transform: poseTransform(pose),
        }}
      >
        <div style={{ position: "relative", width, height, borderRadius: radius, overflow: "hidden", background: "#000" }}>
          {children}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(118deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 26%)",
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** A minimal browser window with no address bar. `width` is the page width in pixels. */
export const Browser: FC<Pose & { width: number; children: ReactNode }> = ({ width, children, ...pose }) => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", perspective: 2600, opacity: pose.opacity ?? 1 }}>
    <div
      style={{
        width,
        borderRadius: 16,
        overflow: "hidden",
        background: "#1b1c1e",
        boxShadow: `${SHADOW}, 0 0 0 1px rgba(255,255,255,0.10)`,
        transform: poseTransform(pose),
      }}
    >
      <div style={{ height: BROWSER_BAR, display: "flex", alignItems: "center", padding: "0 16px", gap: 8 }}>
        {["#5d5f63", "#4b4d51", "#3b3d40"].map((dot) => (
          <div key={dot} style={{ width: 11, height: 11, borderRadius: 6, background: dot }} />
        ))}
        <div
          style={{
            margin: "0 auto",
            transform: "translateX(-28px)",
            padding: "4px 44px",
            borderRadius: 7,
            background: "rgba(255,255,255,0.07)",
            fontFamily: BODY,
            fontWeight: 500,
            fontSize: 14,
            color: "rgba(255,255,255,0.55)",
          }}
        >
          {WINDOW_TITLE}
        </div>
      </div>
      <div style={{ position: "relative", width, height: width / STILL_ASPECT, overflow: "hidden", background: "#fff" }}>
        {children}
      </div>
    </div>
  </AbsoluteFill>
);

/** Zooms its children toward a focus point (0 to 1 on each axis) without leaving the frame. */
export const Camera: FC<{ zoom: number; fx: number; fy: number; children: ReactNode }> = ({ zoom, fx, fy, children }) => {
  const shift = (focus: number): number => Math.min(0, Math.max(-(zoom - 1), 0.5 - focus * zoom)) * 100;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transformOrigin: "0 0",
        transform: `translate(${shift(fx)}%, ${shift(fy)}%) scale(${zoom})`,
      }}
    >
      {children}
    </div>
  );
};

const FILL = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" } as const;

export const Clip: FC<{ src: string; trimBefore?: number; playbackRate?: number }> = ({ src, trimBefore, playbackRate }) => (
  <OffthreadVideo src={staticFile(src)} muted trimBefore={trimBefore} playbackRate={playbackRate} style={FILL} />
);

export const Still: FC<{ src: string }> = ({ src }) => <Img src={staticFile(src)} style={FILL} />;

const FadeIn: FC<{ frames: number; children: ReactNode }> = ({ frames, children }) => {
  const frame = useCurrentFrame();
  return <div style={{ position: "absolute", inset: 0, opacity: ramp(frame, 0, frames) }}>{children}</div>;
};

/** Screen content that fades in at `from` and is dropped at `to`; its own clock starts at `from`. */
export const Layer: FC<{ from: number; to?: number; fade?: number; children: ReactNode }> = ({
  from,
  to,
  fade = 5,
  children,
}) => (
  <Sequence from={from} durationInFrames={to === undefined ? undefined : to - from} layout="none">
    <FadeIn frames={fade}>{children}</FadeIn>
  </Sequence>
);
