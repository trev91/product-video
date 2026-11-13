import { Easing, interpolate } from "remotion";

export type EasingFn = (n: number) => number;

/** Fast start, long settle: the default move for everything in the cut. */
export const EASE_OUT: EasingFn = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN: EasingFn = Easing.in(Easing.cubic);

/** Clamped interpolation between two frames. */
export function ramp(
  frame: number,
  from: number,
  to: number,
  a: number = 0,
  b: number = 1,
  easing: EasingFn = EASE_OUT,
): number {
  return interpolate(frame, [from, to], [a, b], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });
}

export type Key = readonly [frame: number, value: number];

/** Holds each key's value and eases to the next one over `travel` frames, starting on the key's frame. */
export function track(frame: number, keys: readonly Key[], travel: number = 22): number {
  let value = keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [at, next] = keys[i];
    value += (next - value) * ramp(frame, at, at + travel);
  }
  return value;
}
