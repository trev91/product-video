// Bakes the trims and speed changes for the hype cut into constant 30 fps clips in raw/cuts/
// (simulator recordings are variable frame rate, so the edit plays every cut at 1x from frame 0).
// Each clip ends on a 4 s frozen tail: check what that last frame is before relying on it.
//   node edit/make-cuts.mjs            # reads edit/cuts.txt
// cuts.txt, one clip per line (paths relative to the project root):
//   <name> <file>:<start>:<duration>:<speed> [<file>:<start>:<duration>:<speed> ...]
//   <name>.png <file>:<time>                 a single frame
// CUT_SCALE sets the output size (default -2:1748, two thirds of a 2622 px phone recording).
// Needs no shell (edit/make-cuts.sh wraps it).
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { capture, run } from "../lib/tools.mjs";

const PROJECT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(PROJECT_DIR, "raw", "cuts");
const SCALE = process.env.CUT_SCALE || "-2:1748";
mkdirSync(OUT, { recursive: true });

/** The ffmpeg arguments for one clip made of `segments` ("file:start:duration:speed"). */
function cutArgs(segments, output, scale = SCALE) {
  const inputs = [];
  let filter = "";
  let labels = "";
  segments.forEach((segment, i) => {
    const [file, start, duration, speed] = segment.split(":");
    inputs.push("-ss", start, "-t", duration, "-i", file);
    filter += `[${i}:v]setpts=(PTS-STARTPTS)/${speed},fps=30,scale=${scale}:flags=lanczos[v${i}];`;
    labels += `[v${i}]`;
  });
  filter += `${labels}concat=n=${segments.length}:v=1:a=0,tpad=stop_mode=clone:stop_duration=4[out]`;
  return ["-v", "error", "-y", ...inputs, "-filter_complex", filter, "-map", "[out]", "-an",
    "-c:v", "libx264", "-crf", "15", "-preset", "slow", "-pix_fmt", "yuv420p", "-g", "15", "-r", "30", output];
}

for (const line of readFileSync(path.join(PROJECT_DIR, "edit", "cuts.txt"), "utf8").split("\n")) {
  const [name, ...rest] = line.trim().split(/\s+/);
  if (!name || name.startsWith("#")) continue;
  if (name.endsWith(".png")) {
    const [file, at] = rest[0].split(":");
    run("ffmpeg", ["-v", "error", "-y", "-ss", at, "-i", file, "-frames:v", "1", path.join(OUT, name)], { cwd: PROJECT_DIR });
    console.log(name);
  } else {
    const output = path.join(OUT, `${name}.mp4`);
    run("ffmpeg", cutArgs(rest, output), { cwd: PROJECT_DIR });
    console.log(`${name} ${capture("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", output]).trim()}`);
  }
}
