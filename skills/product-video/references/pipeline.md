# Pipeline reference

Contents: project layout · data files · web recording · mobile recording · voice · timing tools ·
render · gotchas.

## Project layout (created by `scripts/new-project.sh <dir> <name> <profile.json>`)

```
<dir>/
  profile.json   the organization profile for this project (validated on every run)
  lib/           profile.mjs (load, validate, guard, sign in), apply-profile.mjs, check-env.mjs, profile.schema.json,
                 draft-profile.mjs + brand-from-url.mjs (draft a profile from two URLs)
  harness/       web capture: lib.mjs, record.mjs, shots-web.mjs, probe-web.mjs, explore.mjs, sign-in.mjs, hq.mjs,
                 shots-hype.mjs, convert-web.sh
  mobile/        simulator capture: device.sh, session.sh, record-shot.sh, record-batch.sh, _prologue.yaml, shot-*.yaml
  edit/          Remotion project: video.json, shots.json, build-edl.mjs, cuts.txt, make-cuts.sh, stills.mjs, src/
  vo/            lines.json (script), gen-vo.mjs, <prefix><shot>.wav, <prefix>durations.json
  captions/      optional hand-written <name>.srt
  raw/web/       shot-<id>-take<n>.webm/.mp4 + .json marker sidecars, still-<id>.png, hq-<id>.mp4
  raw/mobile/    shot-<id>-take<n>.mp4
  raw/cuts/      clips baked for the hype cut
  gfx/ music/    logo, optional music file
  export/        make-deliverables.sh, render-hype.sh, qc.sh, contact-sheet.sh, the MP4s
  log/           recording-log.txt, probe output, contact sheets
```
`edit/public/{raw,vo,music,gfx}` are symlinks into the project so Remotion's `staticFile()` sees them.

## Data files (narrated video)

**edit/video.json**: `name`, `voPrefix` ("vo-"), `shotTail`, `sceneTail`, `music` (false or a path
under `music/`), `titleShot` and `endShot` (shot ids of the cards), `titleCard` and `endCard` text,
and `scenes` (`"2": { "title": "...", "subtitle": "..." }`).

**vo/lines.json**: ordered shots `{ "shot": "02-1", "scene": 2, "text": "..." }`. Shot ids are
`SS-N` (scene-shot). Optional `"captions": [6, 7, 8]` indexes cues in `captions/<name>.srt`;
without an SRT the builder chunks the text into 32-character, two-line cues.

**edit/shots.json**: one entry per shot id.
```json
"03-1": { "kind": "web", "src": "raw/web/shot-03-1-take1.mp4", "trimStart": 7.0, "speed": 1.25, "extraHold": 1.0,
  "zooms":    [{ "atMarker": "title", "lead": -0.2, "hold": 2.0, "scale": 1.3 }],
  "callouts": [{ "atMarker": "save", "lead": -0.1, "hold": 2.0, "pad": 8 }],
  "taps":     [{ "at": 3.2, "x": 603, "y": 1500 }],
  "segments": [{ "trimStart": 21.5, "sourceDuration": 4.6, "speed": 1.5 }, { "trimStart": 26.5 }],
  "patches":  [{ "fromSegment": 1, "x": 150, "y": 684, "w": 345, "h": 52, "fill": "#FDFDFD",
                 "text": "(555) 012-3456", "fontSize": 36, "color": "#7F7C71" }] }
```
- `kind`: `web` (full frame) or `mobile` (framed on the dark backdrop). The card shots are named in video.json.
- Duration = 0.35 + voice + shotTail (+ sceneTail at a scene end) + `extraHold`. The clip must
  cover it; the builder warns `last piece needs ...s` when it does not.
- `segments`: jump cuts. Every piece but the last gives `sourceDuration`; the last fills the shot.
- Marker-based zooms and callouts read the web recording's sidecar: `atMarker` names a
  `s.mark(name, locator)` call in the shot script; `lead` shifts earlier (negative) or later.
  Pixels are source coordinates.
- `patches`: covers drawn with the clip, under zooms; `from` and `to` in shot seconds, or
  `fromSegment` to start exactly at a jump cut. Use them for anything in `safety.mask`.

## Web recording

- `harness/lib.mjs` opens the installed Chrome, checks the host against the profile, installs the
  request guards, signs in as `web.auth` says, draws the cursor, records at `web.viewport` with 2 s
  handles, and writes a `.json` sidecar with the markers and any **blocked requests**. A blocked
  request means a script reached for something it should not; fix the script.
- `sign-in.mjs` opens a visible Chrome window for the person to sign in, and saves the session to
  `web.auth.path` until they close it (for `web.auth.type: "storageState"`).
- `explore.mjs [--max 20] [--depth 2]` crawls the app by links only (never a click or a form; it
  skips sign-out, delete, export and download links) and writes `log/explore/`: `<nn>-<page>.png`
  and `.aria.txt`, `pages.json`, `sheet.jpg` and `shot-list.md`, a ranked draft with a suggested
  shot per page and every request the guard blocked.
- `probe-web.mjs [path ...]` saves `log/web-probe/<page>.png` and `<page>.aria.txt`. Read the aria
  file for exact roles and names (`getByRole("button", { name: "New item" })`).
- **Read-only mode** (`safety.readOnly`): after sign-in, every request that is not GET, HEAD or
  OPTIONS is aborted and listed under `blocked` in the sidecar. An empty or half-loaded page usually
  means the app reads with POST (GraphQL, search): confirm the request is a pure read, then add it
  to `safety.readOnlyAllow`.
- Shot helpers in `shots-web.mjs`: `navLink`, `field`, `action`, `row`, `toggle`, `settle`. The
  `Shot` object has `mark`, `pause`, `moveTo`, `hover`, `click`, `type`, `fill`, `scroll`.
- `convert-web.sh` turns the webm takes into constant 30 fps H.264.
- `hq.mjs still|clip <id>` (entries in `shots-hype.mjs`) captures 2x stills and a screencast with
  no cursor, for the hype cut.

## Mobile recording (iOS Simulator)

- `mobile/device.sh` resolves the simulator and app from the profile; every script sources it.
- `./session.sh start` boots the simulator and sets a clean status bar. `./session.sh end` runs the
  profile's `cleanupFlows` and clears the status bar. Always end the session.
- A shot is `shot-<id>.yaml` starting with `- runFlow: _prologue.yaml` (relaunch, wait for the
  profile's `readyWhen`). Hold with `extendedWaitUntil: { visible: "NEVER-SHOWN-SLEEP", timeout: N, optional: true }`.
  Percent points are whole numbers. `MAESTRO_*` variables pass through the environment.
- `record-shot.sh` wraps `xcrun simctl io <udid> recordVideo` around the flow with 2.5 s handles.
- To learn an app's element ids and labels, run `maestro hierarchy` or take screenshots in a probe
  flow; do not guess selectors.
- The recorder can capture the previous screen for the first seconds: choose `trimStart` from a
  contact sheet, never assume 0.

## Voice

`node vo/gen-vo.mjs [--shots a,b] [--prefix vo-]` follows `narration.mode`:
`system` (macOS `say`), `command` (the profile's own command reads `$VO_TEXT_FILE`, writes
`$VO_OUT`), `recorded` (measures supplied files), `silent`. `narration.pronunciations` rewrites
spellings before speaking. A different voice later: generate under another prefix and build with
`VO_PREFIX=<prefix> node build-edl.mjs`.

## Timing tools

- `CROP=w:h:x:y node edit/sample-strip.mjs <clip> <from> <to> [step]` prints the mean brightness
  of a region by seeking, to find the moment a screen changes. Simulator recordings are variable
  frame rate: seek timing matches Remotion, frame counting drifts.
- `ffmpeg -ss T -i clip -frames:v 1 out.png` for trim checks; `fps=1/2,scale=...,tile=10x2` for a
  quick contact sheet of a take.
- `node edit/stills.mjs <Video|Hype> <outDir> <frame>...` renders half-scale frames of the edit.

## Render

- Narrated: `export/make-deliverables.sh` (master + two-pass delivery, `VIDEO_KBPS` to change the
  bitrate), `export/qc.sh` (size against `delivery.maxSizeMb`, codecs, loudness),
  `export/contact-sheet.sh` (one frame per 12 s).
- Hype: `export/render-hype.sh <name>` (Rec. 709 master, a smaller preview, and the raw render).

## Gotchas

- Start services from background shell commands and stop them by port at the end.
- zsh does not word-split `$VAR` in `for x in $VAR`; the project scripts are bash for that reason.
- Remotion `Composition` props must extend `Record<string, unknown>` to pass the type check.
- A text-to-speech model may read a leading style instruction aloud; send plain script text.
- Natural speech often runs faster than planned: check `durations.json` against the brief.
- Next.js and similar dev overlays sit over the UI: hide them with `web.hideCss`
  (for example `nextjs-portal { display: none !important; }`).
- Remotion needs a paid company licence for organizations with more than three people.
