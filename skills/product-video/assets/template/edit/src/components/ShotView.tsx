import { AbsoluteFill, Easing, Img, OffthreadVideo, Series, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

import { ACCENT, DARK } from "../brand";
import type { Callout, Patch, Shot, Tap, Zoom } from "../edl";
import { BODY } from "../fonts";

const ZOOM_RAMP = 0.5;

function zoomState(zooms: Zoom[], t: number): { scale: number; ox: number; oy: number } | null {
  for (const z of zooms) {
    const inEnd = z.at + ZOOM_RAMP;
    const outStart = inEnd + z.hold;
    const outEnd = outStart + ZOOM_RAMP;
    if (t < z.at || t >= outEnd) continue;
    let p: number;
    if (t < inEnd) p = (t - z.at) / ZOOM_RAMP;
    else if (t < outStart) p = 1;
    else p = 1 - (t - outStart) / ZOOM_RAMP;
    const eased = Easing.inOut(Easing.cubic)(p);
    return { scale: 1 + (z.scale - 1) * eased, ox: z.x, oy: z.y };
  }
  return null;
}

const CalloutBox: React.FC<{ callout: Callout; t: number; srcWidth: number; srcHeight: number }> = ({
  callout,
  t,
  srcWidth,
  srcHeight,
}) => {
  const fadeInEnd = callout.at + 0.25;
  const fadeOutStart = fadeInEnd + callout.hold;
  const fadeOutEnd = fadeOutStart + 0.5;
  if (t < callout.at || t > fadeOutEnd) return null;
  const opacity = interpolate(t, [callout.at, fadeInEnd, fadeOutStart, fadeOutEnd], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: `${(callout.x / srcWidth) * 100}%`,
        top: `${(callout.y / srcHeight) * 100}%`,
        width: `${(callout.w / srcWidth) * 100}%`,
        height: `${(callout.h / srcHeight) * 100}%`,
        border: `4px solid ${ACCENT}`,
        borderRadius: 12,
        boxSizing: "border-box",
        opacity,
      }}
    />
  );
};

const TapMarker: React.FC<{ tap: Tap; t: number; srcWidth: number; srcHeight: number }> = ({
  tap,
  t,
  srcWidth,
  srcHeight,
}) => {
  if (t < tap.at || t > tap.at + 0.3) return null;
  const p = (t - tap.at) / 0.3;
  return (
    <div
      style={{
        position: "absolute",
        left: `${(tap.x / srcWidth) * 100}%`,
        top: `${(tap.y / srcHeight) * 100}%`,
        width: 70,
        height: 70,
        marginLeft: -35,
        marginTop: -35,
        borderRadius: "50%",
        backgroundColor: "rgba(255,255,255,0.5)",
        transform: `scale(${0.6 + 0.4 * p})`,
        opacity: 1 - p * 0.8,
      }}
    />
  );
};

const PatchBox: React.FC<{ patch: Patch; t: number; srcWidth: number; srcHeight: number; scale: number }> = ({
  patch,
  t,
  srcWidth,
  srcHeight,
  scale,
}) => {
  if (t < patch.from || (patch.to !== null && t >= patch.to)) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: `${(patch.x / srcWidth) * 100}%`,
        top: `${(patch.y / srcHeight) * 100}%`,
        width: `${(patch.w / srcWidth) * 100}%`,
        height: `${(patch.h / srcHeight) * 100}%`,
        backgroundColor: patch.fill,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: BODY,
        fontWeight: 400,
        fontSize: (patch.fontSize ?? 36) * scale,
        color: patch.color ?? "#8E8E8E",
        whiteSpace: "nowrap",
        letterSpacing: 0.2 * scale,
      }}
    >
      {patch.text ?? ""}
    </div>
  );
};

const FRAME = { width: 1920, height: 1080 };

/** The largest box of the source's shape that fits the frame, centred ("contain"); the whole frame for "cover". */
function stageBox(shot: Shot): { left: number; top: number; width: number; height: number } {
  if (shot.fit === "cover") return { left: 0, top: 0, ...FRAME };
  const scale = Math.min(FRAME.width / shot.srcWidth, FRAME.height / shot.srcHeight);
  const width = Math.round(shot.srcWidth * scale);
  const height = Math.round(shot.srcHeight * scale);
  return { left: (FRAME.width - width) / 2, top: (FRAME.height - height) / 2, width, height };
}

/**
 * One shot: a recorded or supplied clip, or a supplied image (full frame for web shots, in a
 * phone frame on the dark backdrop for mobile shots), with zooms, callouts, taps and patches.
 */
export const ShotView: React.FC<{ shot: Shot }> = ({ shot }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const zoom = zoomState(shot.zooms, t);

  const phoneWidth = Math.round((820 * shot.srcWidth) / shot.srcHeight);
  const box = stageBox(shot);
  const overlayScale = (shot.kind === "mobile" ? phoneWidth : box.width) / shot.srcWidth;
  const overlays = (
    <>
      {shot.patches.map((p, i) => (
        <PatchBox key={`p${i}`} patch={p} t={t} srcWidth={shot.srcWidth} srcHeight={shot.srcHeight} scale={overlayScale} />
      ))}
      {shot.callouts.map((c, i) => (
        <CalloutBox key={`c${i}`} callout={c} t={t} srcWidth={shot.srcWidth} srcHeight={shot.srcHeight} />
      ))}
      {shot.taps.map((tap, i) => (
        <TapMarker key={`t${i}`} tap={tap} t={t} srcWidth={shot.srcWidth} srcHeight={shot.srcHeight} />
      ))}
    </>
  );

  const zoomStyle: React.CSSProperties = zoom
    ? {
        transform: `scale(${zoom.scale})`,
        transformOrigin: `${(zoom.ox / shot.srcWidth) * 100}% ${(zoom.oy / shot.srcHeight) * 100}%`,
      }
    : {};

  const fill: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };
  const clip =
    shot.src === null ? null : shot.media === "image" ? (
      <Img src={staticFile(shot.src)} style={fill} />
    ) : (
      <Series>
        {shot.segments.map((segment, i) => (
          <Series.Sequence key={i} durationInFrames={Math.max(1, Math.round(segment.duration * fps))}>
            <OffthreadVideo
              src={staticFile(shot.src as string)}
              startFrom={Math.round(segment.trimStart * fps)}
              playbackRate={segment.speed}
              muted
              style={fill}
            />
          </Series.Sequence>
        ))}
      </Series>
    );
  // A still image drifts slowly toward the viewer so it never sits frozen; overlays move with it.
  const drift = 1 + shot.drift * Math.min(1, t / shot.duration);
  const content = (
    <AbsoluteFill style={{ transform: `scale(${drift})` }}>
      {clip}
      {overlays}
    </AbsoluteFill>
  );

  if (shot.kind === "mobile") {
    const height = 820;
    const width = phoneWidth;
    return (
      <AbsoluteFill style={{ backgroundColor: DARK }}>
        <div
          style={{
            position: "absolute",
            top: 40,
            left: (1920 - width) / 2,
            width,
            height,
            borderRadius: 40,
            overflow: "hidden",
            boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
            backgroundColor: "#000",
            ...zoomStyle,
          }}
        >
          {content}
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: DARK }}>
      <div style={{ position: "absolute", ...box, overflow: "hidden", ...zoomStyle }}>{content}</div>
    </AbsoluteFill>
  );
};
