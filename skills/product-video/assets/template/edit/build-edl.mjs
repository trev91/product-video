/**
 * Build edit/src/edl.json and export/<name>.srt from:
 *  - edit/video.json           name, scene titles, card text, tails, which shots are the cards
 *  - vo/lines.json             shot order: { shot, scene, text, captions? }
 *  - vo/<prefix>durations.json seconds per shot's voice file (written by the VO generators)
 *  - captions/<name>.srt       optional hand-written cues (lines.json "captions" index them);
 *                              without it, cues are chunked from each shot's text
 *  - edit/shots.json           per-shot clip: src, trimStart, speed, extraHold, segments,
 *                              zooms/callouts/taps (marker-based), patches
 *
 * Voice sets the timing: each shot lasts voLead + voice + shotTail (+ sceneTail on the
 * last shot of a scene); scene changes cross-dissolve over 10 frames.
 *
 *   node build-edl.mjs                     # voice prefix from video.json (vo-)
 *   VO_PREFIX=final- node build-edl.mjs    # a recorded voice: vo/final-<shot>.wav
 * Music: set "music" in video.json to a file under music/ (e.g. "music/bed.wav"); false for none.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ROOT = new URL("../", import.meta.url).pathname;
const VIDEO = JSON.parse(readFileSync(`${ROOT}edit/video.json`, "utf8"));
const PROFILE = JSON.parse(readFileSync(`${ROOT}edit/src/profile.json`, "utf8"));
const NAME = VIDEO.name;
const FPS = 30;
const TRANSITION_FRAMES = 10;
const VO_PREFIX = process.env.VO_PREFIX ?? VIDEO.voPrefix ?? "vo-";
const VO_LEAD = 0.35;
const SHOT_TAIL = Number(process.env.SHOT_TAIL ?? VIDEO.shotTail ?? 0.7);
const SCENE_TAIL = Number(process.env.SCENE_TAIL ?? VIDEO.sceneTail ?? 0.8);
const SCENES = VIDEO.scenes;
const DEFAULT_KIND = { [VIDEO.titleShot]: "title", [VIDEO.endShot]: "end" };

const lines = JSON.parse(readFileSync(`${ROOT}vo/lines.json`, "utf8"));
const durations = JSON.parse(readFileSync(`${ROOT}vo/${VO_PREFIX}durations.json`, "utf8"));
const shotsConfig = existsSync(`${ROOT}edit/shots.json`)
  ? JSON.parse(readFileSync(`${ROOT}edit/shots.json`, "utf8"))
  : {};

function parseSrt(text) {
  const out = new Map();
  for (const block of text.replace(/\r/g, "").trim().split(/\n\n+/)) {
    const [index, , ...rest] = block.split("\n");
    out.set(Number(index), rest.join("\n").trim());
  }
  return out;
}
const srtPath = `${ROOT}${VIDEO.captionsFile ?? `captions/${NAME}.srt`}`;
const srt = existsSync(srtPath) ? parseSrt(readFileSync(srtPath, "utf8")) : null;

/** Caption cues from plain text: lines of at most 32 characters, two lines per cue, breaking at sentence ends. */
function chunkCaptions(text, maxLine = 32) {
  const words = text.split(/\s+/).filter(Boolean);
  const rows = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxLine && cur) { rows.push(cur); cur = w; } else cur = next;
  }
  if (cur) rows.push(cur);
  const cues = [];
  for (let i = 0; i < rows.length;) {
    let a = rows[i], b = rows[i + 1];
    if (b && !/[.!?]$/.test(a)) {
      // No orphaned word on the second line: borrow from the first while it fits.
      let aw = a.split(" "), bw = b.split(" ");
      while (bw.length < 2 && aw.length > 2 && (aw.at(-1).length + 1 + b.length) <= maxLine) { bw.unshift(aw.pop()); b = bw.join(" "); a = aw.join(" "); }
      cues.push(`${a}\n${b}`); i += 2;
    } else { cues.push(a); i += 1; }
  }
  return cues;
}

function probe(src) {
  const out = execFileSync("ffprobe", [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height:format=duration", "-of", "json", `${ROOT}${src}`,
  ]).toString();
  const j = JSON.parse(out);
  return { width: j.streams[0].width, height: j.streams[0].height, duration: Number(j.format.duration) };
}

/**
 * Overlays may name a recording marker instead of giving times and pixels:
 *   { "atMarker": "send-at", "lead": -0.2, "hold": 2, "scale": 1.35 }   (zoom: focus = box centre)
 *   { "atMarker": "send-at", "hold": 2, "pad": 10 }                      (callout: the marker's box)
 *   { "atMarker": "a", "untilMarker": "b", ... }                         (callout spanning two boxes)
 * Marker times are in the recording; they become shot time via trimStart and speed.
 */
function loadMarkers(cfg) {
  if (!cfg.src) return [];
  const sidecar = `${ROOT}${cfg.src.replace(/\.mp4$/, ".json")}`;
  if (!existsSync(sidecar)) return [];
  return JSON.parse(readFileSync(sidecar, "utf8")).markers ?? [];
}
function resolveOverlays(shotId, items, cfg, trimStart, speed, kind) {
  const markers = loadMarkers(cfg);
  return items.map((item) => {
    if (!item.atMarker) return item;
    const marker = markers.find((m) => m.name === item.atMarker);
    if (!marker) throw new Error(`${shotId}: marker ${item.atMarker} not found`);
    const at = Math.max(0, (marker.t - trimStart) / speed + (item.lead ?? 0));
    const box = marker.box ?? { x: marker.mouse.x - 20, y: marker.mouse.y - 20, w: 40, h: 40 };
    const pad = item.pad ?? 0;
    if (kind === "zoom") {
      return { at: round2(at), hold: item.hold ?? 1.5, scale: item.scale ?? 1.35, x: Math.round(box.x + box.w / 2), y: Math.round(box.y + box.h / 2) };
    }
    if (kind === "callout") {
      let { x, y, w, h } = box;
      if (item.untilMarker) {
        const other = markers.find((m) => m.name === item.untilMarker);
        if (!other || !other.box) throw new Error(`${shotId}: marker ${item.untilMarker} not found`);
        const x2 = Math.max(x + w, other.box.x + other.box.w), y2 = Math.max(y + h, other.box.y + other.box.h);
        x = Math.min(x, other.box.x); y = Math.min(y, other.box.y); w = x2 - x; h = y2 - y;
      }
      return { at: round2(at), hold: item.hold ?? 2, x: x - pad, y: y - pad, w: w + pad * 2, h: h + pad * 2 };
    }
    return { at: round2(at), x: Math.round(box.x + box.w / 2), y: Math.round(box.y + box.h / 2) };
  });
}
function round2(n) { return Math.round(n * 100) / 100; }

/** On-screen pieces: every piece but the last has a source length; the last fills the rest of the shot. */
function buildSegments(cfg, trimStart, duration, speed) {
  const defs = cfg.segments ?? [{ trimStart }];
  const out = [];
  let remaining = duration;
  defs.forEach((d, i) => {
    const isLast = i === defs.length - 1;
    const segSpeed = d.speed ?? speed;
    const onScreen = isLast ? remaining : (d.sourceDuration ?? 0) / segSpeed;
    out.push({ trimStart: d.trimStart, duration: round2(Math.max(0, onScreen)), speed: segSpeed });
    remaining -= onScreen;
  });
  return out;
}
/** Shot-time at which segment `index` starts. */
function segmentStart(segments, index) {
  return round2(segments.slice(0, index).reduce((a, s) => a + s.duration, 0));
}

const scenes = [];
let sceneIndex = -1;
for (const line of lines) {
  const cfg = shotsConfig[line.shot] ?? {};
  const kind = cfg.kind ?? DEFAULT_KIND[line.shot] ?? "web";
  const vo = durations[line.shot];
  if (typeof vo !== "number") throw new Error(`no voice duration for ${line.shot} in vo/${VO_PREFIX}durations.json`);
  if (!SCENES[line.scene]) throw new Error(`scene ${line.scene} is not in edit/video.json`);
  const isSceneEnd = lines.indexOf(line) === lines.length - 1 || lines[lines.indexOf(line) + 1].scene !== line.scene;
  let duration = VO_LEAD + vo + SHOT_TAIL + (isSceneEnd ? SCENE_TAIL : 0) + (cfg.extraHold ?? 0);
  if (kind === "title") duration = Math.max(6.0, VO_LEAD + vo + 0.3);
  if (kind === "end") duration = Math.max(6.0, VO_LEAD + vo + 1.6);
  duration = Math.round(duration * FPS) / FPS;

  const speed = cfg.speed ?? 1;
  let src = cfg.src ?? null;
  let srcWidth = kind === "mobile" ? PROFILE.phoneScreen.width : PROFILE.webViewport.width;
  let srcHeight = kind === "mobile" ? PROFILE.phoneScreen.height : PROFILE.webViewport.height;
  const trimStart = cfg.trimStart ?? 0;
  const segments = buildSegments(cfg, trimStart, duration, speed);
  if (src) {
    if (!existsSync(`${ROOT}${src}`)) {
      console.warn(`WARN ${line.shot}: ${src} missing, using placeholder`);
      src = null;
    } else {
      const info = probe(src);
      srcWidth = info.width;
      srcHeight = info.height;
      const last = segments.at(-1);
      const lastEnd = last.trimStart + last.duration * last.speed;
      if (info.duration < lastEnd) {
        console.warn(`WARN ${line.shot}: clip ${src} is ${info.duration.toFixed(1)}s, last piece needs ${lastEnd.toFixed(1)}s`);
      }
    }
  } else if (kind !== "title" && kind !== "end") {
    console.warn(`WARN ${line.shot}: no clip yet`);
  }

  // Captions: hand-written cues from the SRT when indexed, otherwise chunked from the text;
  // spread over the voice by character count.
  const texts = srt && line.captions?.length
    ? line.captions.map((i) => { const t = srt.get(i); if (!t) throw new Error(`caption ${i} missing from ${srtPath}`); return t; })
    : chunkCaptions(line.text);
  const totalChars = texts.reduce((a, t) => a + t.replace(/\n/g, " ").length, 0);
  let cursor = VO_LEAD - 0.1;
  const captions = texts.map((text) => {
    const share = (text.replace(/\n/g, " ").length / totalChars) * vo;
    const c = { start: round2(cursor), end: round2(cursor + share), text };
    cursor += share;
    return c;
  });

  if (sceneIndex < 0 || scenes[sceneIndex].number !== line.scene) {
    scenes.push({ number: line.scene, title: SCENES[line.scene].title, subtitle: SCENES[line.scene].subtitle ?? "", shots: [] });
    sceneIndex += 1;
  }
  scenes[sceneIndex].shots.push({
    id: line.shot,
    scene: line.scene,
    kind,
    src,
    srcWidth,
    srcHeight,
    trimStart,
    duration,
    speed,
    segments,
    patches: (cfg.patches ?? []).map((p) => {
      const from = p.fromSegment !== undefined ? segmentStart(segments, p.fromSegment) : (p.from ?? 0);
      const { fromSegment, ...rest } = p;
      return { to: null, ...rest, from };
    }),
    voSrc: `vo/${VO_PREFIX}${line.shot}.wav`,
    voDuration: vo,
    voLead: VO_LEAD,
    zooms: resolveOverlays(line.shot, cfg.zooms ?? [], cfg, trimStart, speed, "zoom"),
    callouts: resolveOverlays(line.shot, cfg.callouts ?? [], cfg, trimStart, speed, "callout"),
    taps: resolveOverlays(line.shot, cfg.taps ?? [], cfg, trimStart, speed, "tap"),
    captions,
  });
}

// Absolute timeline (scene changes overlap by the transition).
const overlap = TRANSITION_FRAMES / FPS;
let sceneStart = 0;
const absoluteCaptions = [];
for (const [i, scene] of scenes.entries()) {
  let shotStart = sceneStart;
  for (const shot of scene.shots) {
    for (const c of shot.captions) {
      const start = shotStart + c.start;
      const end = Math.max(start + 1.0, shotStart + c.end);
      absoluteCaptions.push({ start: round2(start), end: round2(end), text: c.text });
    }
    shotStart += shot.duration;
  }
  const sceneDuration = scene.shots.reduce((a, s) => a + s.duration, 0);
  sceneStart += sceneDuration - (i < scenes.length - 1 ? overlap : 0);
}
for (let i = 0; i < absoluteCaptions.length - 1; i++) {
  if (absoluteCaptions[i].end > absoluteCaptions[i + 1].start) {
    absoluteCaptions[i].end = round2(absoluteCaptions[i + 1].start - 0.05);
  }
}
const totalDuration = Math.round(sceneStart * FPS) / FPS;

const edl = {
  fps: FPS,
  captions: absoluteCaptions,
  scenes,
  musicSrc: typeof VIDEO.music === "string" ? VIDEO.music : null,
  totalDuration,
  transitionFrames: TRANSITION_FRAMES,
  titleCard: VIDEO.titleCard,
  endCard: VIDEO.endCard,
};
writeFileSync(`${ROOT}edit/src/edl.json`, JSON.stringify(edl, null, 2));

function ts(sec) {
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000), r = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(r).padStart(3, "0")}`;
}
writeFileSync(`${ROOT}export/${NAME}.srt`, absoluteCaptions.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join("\n"));

const mm = Math.floor(totalDuration / 60), ss = Math.round(totalDuration % 60);
console.log(`EDL: ${scenes.length} scenes, ${lines.length} shots, ${absoluteCaptions.length} captions, ${mm}:${String(ss).padStart(2, "0")} (${totalDuration.toFixed(2)}s)${srt ? "" : " [captions chunked from the script]"}`);
for (const scene of scenes) {
  console.log(`  scene ${scene.number} ${scene.title}: ` + scene.shots.map((s) => `${s.id}=${s.duration.toFixed(2)}s${s.src ? "" : "(no clip)"}`).join("  "));
}
