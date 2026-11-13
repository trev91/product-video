/**
 * Sharp web capture for the hype cut, instead of Playwright's low-bitrate webm.
 * - stills: a 2x PNG of a page state.
 * - clips: Chrome's screencast JPEGs (1x, the screencast ignores the device scale)
 *   assembled by timestamp into a constant 30 fps H.264 clip; `s.snap(name)`
 *   inside a clip script saves a 2x PNG of that moment for zooms.
 * No cursor is drawn: the hype cut frames the UI and moves the camera instead.
 * Usage: node hq.mjs still|clip <id> [...ids]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

import { openContext, OUT_DIR, profile, Shot } from "./lib.mjs";
import { clips, stills } from "./shots-hype.mjs";

const FRAMES_ROOT = process.env.FRAMES_ROOT ?? path.join(OUT_DIR, "frames");
const VIEWPORT = profile.web.stillViewport;
const SCALE = 2;

async function open() {
  const { browser, context } = await openContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
  const page = await context.newPage();
  return { browser, context, page };
}

async function still(id) {
  const spec = stills[id];
  if (!spec) throw new Error(`Unknown still "${id}"`);
  const { browser, page } = await open();
  try {
    await page.goto(spec.path, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    if (spec.prepare) await spec.prepare(page);
    await page.waitForTimeout(400);
    await mkdir(OUT_DIR, { recursive: true });
    const out = path.join(OUT_DIR, `still-${id}.png`);
    await page.screenshot({ path: out });
    console.log(`[still ${id}] ${out}`);
  } finally {
    await browser.close();
  }
}

async function clip(id) {
  const spec = clips[id];
  if (!spec) throw new Error(`Unknown clip "${id}"`);
  const framesDir = path.join(FRAMES_ROOT, id);
  await mkdir(framesDir, { recursive: true });
  const { browser, context, page } = await open();
  const frames = [];
  let error = null;
  try {
    await page.goto(spec.startPath, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const cdp = await context.newCDPSession(page);
    const writes = [];
    cdp.on("Page.screencastFrame", (event) => {
      const file = path.join(framesDir, `f${String(frames.length).padStart(5, "0")}.jpg`);
      frames.push({ file, t: event.metadata.timestamp });
      writes.push(writeFile(file, Buffer.from(event.data, "base64")));
      cdp.send("Page.screencastFrameAck", { sessionId: event.sessionId }).catch(() => {});
    });
    await cdp.send("Page.startScreencast", {
      format: "jpeg", quality: 92, everyNthFrame: 1,
      maxWidth: VIEWPORT.width * SCALE, maxHeight: VIEWPORT.height * SCALE,
    });
    const baseline = Date.now();
    const shot = new Shot(page, baseline);
    shot.snap = async (name) => {
      await page.screenshot({ path: path.join(OUT_DIR, `hq-${id}-${name}.png`) });
    };
    await shot.pause(1000);
    await shot.mark("start");
    try {
      await spec.script(shot);
    } catch (err) {
      error = err;
    }
    await shot.mark("end");
    await shot.pause(1500);
    await cdp.send("Page.stopScreencast");
    await Promise.all(writes);
    const endT = frames[frames.length - 1].t + 0.5;
    const t0 = frames[0].t;
    // ffmpeg concat list: each frame holds until the next one arrives.
    const list = frames
      .map((frame, i) => {
        const next = i + 1 < frames.length ? frames[i + 1].t : endT;
        return `file '${frame.file}'\nduration ${(next - frame.t).toFixed(4)}`;
      })
      .join("\n") + `\nfile '${frames[frames.length - 1].file}'\n`;
    const listPath = path.join(framesDir, "list.txt");
    await writeFile(listPath, list);
    const out = path.join(OUT_DIR, `hq-${id}.mp4`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listPath,
      "-vf", "fps=30", "-c:v", "libx264", "-crf", "14", "-preset", "medium",
      "-pix_fmt", "yuv420p", "-g", "15", "-an", out]);
    // Screencast timestamps are wall-clock seconds; markers are relative to the script baseline.
    const offset = baseline / 1000 - t0;
    const markers = shot.markers.map((m) => ({ ...m, t: Math.round((m.t + offset) * 100) / 100 }));
    await writeFile(path.join(OUT_DIR, `hq-${id}.json`),
      JSON.stringify({ id, frames: frames.length, duration: endT - t0, markers, error: error ? String(error.message) : null }, null, 2));
    console.log(`[clip ${id}] ${frames.length} frames, ${(endT - t0).toFixed(1)}s -> ${out}${error ? " FAILED: " + error.message.split("\n")[0] : ""}`);
  } finally {
    await browser.close();
  }
  if (error) throw error;
}

const [mode, ...ids] = process.argv.slice(2);
for (const id of ids) {
  if (mode === "still") await still(id);
  else if (mode === "clip") await clip(id);
  else throw new Error("Usage: node hq.mjs still|clip <id> [...ids]");
}
