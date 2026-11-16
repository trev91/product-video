// QC numbers for a delivery file: size against the profile's delivery.maxSizeMb, codecs, loudness.
//   node export/qc.mjs            # export/<name>.mp4 from edit/video.json
//   node export/qc.mjs other.mp4  # a path relative to export/, or absolute
// Needs no shell (export/qc.sh wraps it).
import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { capture, humanSize } from "../lib/tools.mjs";

const EXPORT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.join(EXPORT_DIR, "..");
const name = JSON.parse(readFileSync(path.join(PROJECT_DIR, "edit/video.json"), "utf8")).name;
const file = path.resolve(EXPORT_DIR, process.argv[2] ?? `${name}.mp4`);
const limitMb = JSON.parse(readFileSync(path.join(PROJECT_DIR, "profile.json"), "utf8")).delivery?.maxSizeMb;

const bytes = statSync(file).size;
console.log(`file:      ${path.basename(file)} (${humanSize(bytes)}, ${bytes} bytes${limitMb ? `; limit ${limitMb} MB` : ""})`);
if (limitMb && bytes > Math.round(limitMb * 1048576)) console.log("OVER the size limit");
const streams = capture("ffprobe", ["-v", "error", "-show_entries",
  "format=duration:stream=codec_name,width,height,r_frame_rate,bit_rate,sample_rate,channels", "-of", "default=nw=1", file]);
console.log([...new Set(streams.trim().split("\n"))].sort().join("\n"));
const hasAudio = capture("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", file]).trim() !== "";
if (hasAudio) {
  // loudnorm prints its summary on stderr; ffmpeg exits 0.
  const result = spawnSync("ffmpeg", ["-nostats", "-i", file, "-af", "loudnorm=I=-16:TP=-1:LRA=11:print_format=summary", "-f", "null", "-"], { encoding: "utf8" });
  console.log("loudness:");
  console.log(String(result.stderr).split("\n").filter((line) => /Input Integrated|Input True Peak|Input LRA/.test(line)).join("\n"));
} else {
  console.log("loudness:  no audio stream");
}
