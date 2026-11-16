/**
 * Keeps device windows inside the frame. No imports, so tests can load it directly.
 * Boxes are for a window centred in the frame, then moved by (x, y) and scaled about its centre,
 * which is how Browser and Phone place themselves. Rotation is ignored: keep a margin for tilts.
 */

export type FrameSize = { width: number; height: number };
export type Box = { left: number; top: number; right: number; bottom: number };
export type WindowPlacement = { width: number; height: number; x?: number; y?: number; scale?: number };

/** Where a window lands on screen. */
export function windowBox({ width, height, x = 0, y = 0, scale = 1 }: WindowPlacement, frame: FrameSize): Box {
  const left = frame.width / 2 + x - (width * scale) / 2;
  const top = frame.height / 2 + y - (height * scale) / 2;
  return { left, top, right: left + width * scale, bottom: top + height * scale };
}

/** How far a box crosses each edge of the frame (inset by `margin`), e.g. ["left by 40px"]; empty when inside. */
export function offFrame(box: Box, frame: FrameSize, margin = 0): string[] {
  const over: Array<[string, number]> = [
    ["left", margin - box.left],
    ["top", margin - box.top],
    ["right", box.right - (frame.width - margin)],
    ["bottom", box.bottom - (frame.height - margin)],
  ];
  return over.filter(([, by]) => by > 0.5).map(([edge, by]) => `${edge} by ${Math.round(by)}px`);
}

export type FitOptions = {
  frame: FrameSize;
  /** Page width / page height of the content (STILL_ASPECT for a Browser). */
  aspect: number;
  /** Fixed height above the page, such as the browser's title bar. */
  bar?: number;
  marginX?: number;
  marginY?: number;
};

/**
 * The largest width (up to the one asked for) and the nearest x and y that keep a window of
 * `aspect` inside the frame less the margins, at the given scale:
 *   const fit = fitWindow({ width: 1500, x: 400, scale: 1.1 }, { frame, aspect: STILL_ASPECT, bar: 40 });
 *   <Browser width={fit.width} x={fit.x} y={fit.y} scale={1.1}>
 */
export function fitWindow(
  { width, x = 0, y = 0, scale = 1 }: { width: number; x?: number; y?: number; scale?: number },
  { frame, aspect, bar = 0, marginX = 0, marginY = 0 }: FitOptions,
): { width: number; x: number; y: number } {
  const maxByWidth = (frame.width - 2 * marginX) / scale;
  const maxByHeight = ((frame.height - 2 * marginY) / scale - bar) * aspect;
  const fitted = Math.max(0, Math.min(width, maxByWidth, maxByHeight));
  const height = bar + fitted / aspect;
  const limitX = Math.max(0, (frame.width - 2 * marginX - fitted * scale) / 2);
  const limitY = Math.max(0, (frame.height - 2 * marginY - height * scale) / 2);
  const clamp = (value: number, limit: number): number => Math.min(limit, Math.max(-limit, value));
  return { width: fitted, x: clamp(x, limitX), y: clamp(y, limitY) };
}

/** The tag stills.mjs --check looks for in the browser console. */
export const OFF_FRAME_TAG = "[product-video:off-frame]";
