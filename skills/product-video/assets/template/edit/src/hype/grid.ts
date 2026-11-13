import { BPM, FPS } from "../brand";

/** The cut runs on a beat grid: at 120 BPM and 30 fps a beat is 15 frames and a bar is 2 seconds. */
export const BEAT = Math.round((FPS * 60) / BPM);
export const BAR = BEAT * 4;
/** Length of the cut in bars: 30 bars at 120 BPM is 60 seconds. */
export const TOTAL_BARS = 30;
export const TOTAL_FRAMES = TOTAL_BARS * BAR;

/** First frame of a bar, counting bars from 1. */
export const bar = (n: number): number => (n - 1) * BAR;
