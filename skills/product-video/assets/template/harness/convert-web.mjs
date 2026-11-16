// Convert Playwright's VP8 webm recordings to constant 30 fps H.264 mp4 for the edit.
// Skips a take whose mp4 is newer than its webm.
//   node harness/convert-web.mjs
// Needs no shell (harness/convert-web.sh wraps it).
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { capture, run } from "../lib/tools.mjs";

const WEB_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "raw", "web");
const takes = existsSync(WEB_DIR) ? readdirSync(WEB_DIR).filter((file) => /^shot-.*\.webm$/.test(file)).sort() : [];
if (!takes.length) console.log("no shot-*.webm in raw/web");
for (const take of takes) {
  const source = path.join(WEB_DIR, take);
  const out = source.replace(/\.webm$/, ".mp4");
  if (existsSync(out) && statSync(out).mtimeMs > statSync(source).mtimeMs) continue;
  run("ffmpeg", ["-v", "error", "-y", "-i", source, "-vf", "fps=30", "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-pix_fmt", "yuv420p", "-an", out]);
  const seconds = capture("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out]).trim();
  console.log(`${take} -> ${path.basename(out)} (${seconds}s)`);
}
