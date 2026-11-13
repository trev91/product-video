// Seek-based mean brightness of a region over a time window, the same seeking the edit uses,
// for finding the moment a screen changes:
//   CROP=300:35:150:740 node sample-strip.mjs <clip> <from> <to> [step]     (CROP is ffmpeg's w:h:x:y)
import { execFileSync } from "node:child_process";
const [file, from, to, step = "0.25"] = process.argv.slice(2);
const out = [];
for (let t = Number(from); t <= Number(to) + 1e-9; t += Number(step)) {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-ss", t.toFixed(2), "-i", file, "-frames:v", "1", "-vf", `crop=${process.env.CROP ?? "300:35:150:740"}`, "-f", "rawvideo", "-pix_fmt", "gray", "-"]);
  let s = 0; for (let k = 0; k < raw.length; k++) s += raw[k];
  out.push(`${t.toFixed(2)}:${Math.round(s / raw.length)}`);
}
console.log(out.join("  "));
