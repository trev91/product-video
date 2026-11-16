# Silent hype cut

A short "Apple ad" style promo instead of a narrated tour: type and product on a dark stage, cut
to a beat, no voice. The engine is `edit/src/hype/`; the template's `Scenes.tsx` holds one example
of each pattern and renders before anything is recorded.

## Defaults (the profile's `decisions` and `music` override them)

- **Silent.** No voice and no audio stream. If the music is added later by someone else, cut on a
  steady grid and deliver a cue sheet with the MP4: bar, time, what is on screen, and the suggested
  musical moment.
- **Look.** Near-black stage with a slow glow in the accent colour, white heading font at weight
  700 with tight tracking, words that land one per beat, one floating phone with a 3D tilt, a
  minimal browser window with no address bar and a camera that pushes in, then a flip to the light
  card for the logo. No captions bar, no lower thirds.
- **Words.** Few and concrete: two to four words a line, one idea per scene, the accent colour on
  the words that carry it.
- Safety rules are unchanged: show a form, never submit it.

## Mechanics

- `grid.ts`: `BEAT` and `BAR` in frames from the profile's `music.bpm` (120 BPM at 30 fps is 15 and
  60), `TOTAL_BARS` for the length (30 bars at 120 BPM is 60 s), `bar(n)` for a bar's first frame.
- `Hype.tsx`: the `SCENES` table (`name`, `fromBar`, `bars`, `component`). Hard cuts land on bar
  lines. Each scene is its own `<Sequence>`, so frame 0 inside a scene is that scene's first frame.
- `motion.ts`: `ramp(frame, from, to, a, b)` is a clamped eased move; `track(frame, keys, travel)`
  holds each keyframe's value and eases to the next.
- `Type.tsx`: `words(text, start, step, accentFrom)` builds a line whose words land `step` frames
  apart; `Headline`, `Eyebrow`, `Block` (a column on the left, right or centre), `Caption`.
- `Devices.tsx`: `Phone`, `Browser`, `Camera` (zoom toward a focus point), `Layer` (screen content
  that fades in at a frame), `Clip` and `Still` (media from `edit/public`), and `fitBrowser()`, which
  shrinks a window's width and moves its x and y until it fits the title-safe area at a given
  scale. `safeArea.ts` has the plain `fitWindow()` and `windowBox()` behind it.
- `Stage.tsx`: the shared background.

## Media

- Phone clips: list them in `edit/cuts.txt` and run `node edit/make-cuts.mjs`. It bakes each trim and
  speed change into a constant 30 fps clip in `raw/cuts/` so Remotion never seeks a variable-frame-
  rate simulator recording. Each clip ends on a 4 s frozen tail: look at that last frame, because a
  half-open sheet or mid-transition frame reads as a bug.
- Web pages: `node harness/hq.mjs still <id>` for 2x stills and `clip <id>` for a screencast
  (entries in `harness/shots-hype.mjs`). A still with a `Camera` push looks sharper than recorded
  video; use the screencast only where motion matters, such as text being typed.

- Supplied screenshots and videos (`node lib/import-media.mjs`, files in `raw/media/`) go straight
  into `Still` and `Clip`. Nothing covers private details here: use only media that is clean.

## Review and render

- `node edit/stills.mjs --check Hype <outDir> <frame>...` bundles once and renders half-scale
  frames; tile them with ffmpeg and read the sheet. Review every scene before the full render.
  `--check` also lists every frame where a `Browser` window runs off the frame edge (and exits 2).
- It cannot see cut words. A `Camera` push zooms toward its focus point (`fx`, `fy`), so put that
  point inside the column of text you want read, or the push crops the line mid-word. The same goes
  for type beside a window: keep headlines inside `Block` columns and windows inside `fitBrowser`,
  then read the stills at the end of each push.
- `node export/render-hype.mjs <name>` renders and writes the Rec. 709 master and a smaller preview
  (`--frames 0-149` for a quick sample first).
  Remotion's JPEG frames are full range; the script converts with a light luma dither because a
  plain conversion bands the dark glow.
- Some chat and file-sharing tools refuse large attachments: send the preview copy when the
  master is too big, and say where the master is.
