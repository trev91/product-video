/** The edit decision list the composition is built from (edit/edl.json). */
export type ShotKind = "title" | "end" | "web" | "mobile";

export interface Zoom {
  /** Seconds into the shot when the zoom-in starts. */
  at: number;
  /** Seconds the zoom holds at full scale (excludes the 0.5 s in and out). */
  hold: number;
  /** 1.3 to 1.5 reads well. */
  scale: number;
  /** Focus point in source-video pixels. */
  x: number;
  y: number;
}

export interface Callout {
  at: number;
  hold: number;
  /** Box in source-video pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Tap {
  /** Seconds into the shot. */
  at: number;
  /** Position in source-video pixels. */
  x: number;
  y: number;
}

export interface Patch {
  /** Shot seconds the patch is on screen; `to` null means until the shot ends. */
  from: number;
  to: number | null;
  /** Box in source-video pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Fill colour matching the surface being covered. */
  fill: string;
  /** Replacement text drawn centred in the box, in source pixels. */
  text?: string;
  fontSize?: number;
  color?: string;
}

export interface Caption {
  /** Seconds relative to the shot start. */
  start: number;
  end: number;
  text: string;
}

export interface Segment {
  /** Seconds into the source where this piece starts. */
  trimStart: number;
  /** On-screen seconds for this piece. */
  duration: number;
  /** Playback rate for this piece (defaults to the shot's speed). */
  speed: number;
}

export interface Shot {
  id: string;
  scene: number;
  kind: ShotKind;
  /** Path under public/, e.g. raw/web/shot-01-3.mp4 or raw/media/03-pricing.png. */
  src: string | null;
  /** What `src` is: a clip that plays, or a still image held for the whole shot. */
  media: "video" | "image";
  /** "cover" fills the frame (recordings); "contain" shows the whole source with dark bars (supplied media). */
  fit: "cover" | "contain";
  /** How far a still image scales up over the shot (0.04 = 4%); 0 for clips. */
  drift: number;
  /** Source width and height in pixels (for zoom and callout math). */
  srcWidth: number;
  srcHeight: number;
  /** Seconds into the source where the shot starts. */
  trimStart: number;
  /** On-screen length in seconds. */
  duration: number;
  /** Playback rate of the source clip (1 = natural; typing-heavy shots run faster). */
  speed: number;
  /** Pieces of the source shown back to back (a jump cut between them); covers the whole shot. */
  segments: Segment[];
  voSrc: string | null;
  voDuration: number;
  /** Seconds of silence before the voice starts inside the shot. */
  voLead: number;
  zooms: Zoom[];
  callouts: Callout[];
  taps: Tap[];
  /** Covers for values that must not appear on screen; drawn with the clip, under zooms. */
  patches: Patch[];
  captions: Caption[];
}

export interface Scene {
  number: number;
  title: string;
  subtitle: string;
  shots: Shot[];
}

export interface Edl {
  fps: number;
  /** Burned-in captions with absolute times (seconds from the start of the video). */
  captions: Caption[];
  scenes: Scene[];
  /** Null means no music bed. */
  musicSrc: string | null;
  /** Total length in seconds (sum of shots; transitions overlap by `transitionFrames`). */
  totalDuration: number;
  transitionFrames: number;
  titleCard: CardText;
  endCard: EndCardText;
}

export interface CardText {
  heading: string;
  subline: string;
}

export interface EndCardText extends CardText {
  contactLine: string;
}
