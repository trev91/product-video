// Silent hype cut: render the Hype composition, then make the files to hand off.
//   <name>-render.mp4   Remotion's own output (full-range colour; keep for re-encodes)
//   <name>.mp4          master for an editor: Rec. 709 video range, crf 15
//   <name>-web.mp4      smaller preview copy, crf 20
// Remotion's JPEG frames come out full range; the conversion adds a light luma dither
// because a plain range conversion bands the dark glow of the stage.
//   node export/render-hype.mjs <name>
//   node export/render-hype.mjs <name> --frames 0-149     just those frames (a quick sample)
// Needs no shell (export/render-hype.sh wraps it).
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { capture, humanSize, remotionBrowserArgs, run } from "../lib/tools.mjs";

const EXPORT_DIR = path.dirname(fileURLToPath(import.meta.url));
const EDIT_DIR = path.join(EXPORT_DIR, "..", "edit");
const args = process.argv.slice(2);
const name = args[0];
if (!name || name.startsWith("-")) {
  console.error("usage: node export/render-hype.mjs <name> [--frames <from>-<to>]");
  process.exit(1);
}
const frames = args.includes("--frames") ? args[args.indexOf("--frames") + 1] : null;
const out = (suffix) => path.join(EXPORT_DIR, `${name}${suffix}.mp4`);

run("npx", [
  "remotion", "render", "src/index.ts", "Hype", out("-render"),
  "--codec=h264", "--crf=16", "--muted", "--log=error",
  ...(frames ? [`--frames=${frames}`] : []),
  ...remotionBrowserArgs(),
], { cwd: EDIT_DIR });

// The dither needs ffmpeg's noise filter; some minimal builds leave it out.
const hasNoise = /^\s*\S+\s+noise\s/m.test(capture("ffmpeg", ["-hide_banner", "-filters"]));
if (!hasNoise) console.warn("WARNING: this ffmpeg has no noise filter, so the dark glow is converted without dither and may band.");
const rec709 = `${hasNoise ? "noise=c0s=3:c0f=t+u," : ""}scale=in_range=full:in_color_matrix=bt601:out_range=tv:out_color_matrix=bt709,format=yuv420p`;
const tags = ["-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart"];
for (const [suffix, crf] of [["", "15"], ["-web", "20"]]) {
  run("ffmpeg", ["-v", "error", "-y", "-i", out("-render"), "-vf", rec709, "-c:v", "libx264", "-preset", "slow", "-crf", crf, ...tags, "-an", out(suffix)]);
}
for (const suffix of ["", "-web"]) {
  const file = out(suffix);
  const probe = capture("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries",
    "format=duration:stream=width,height,r_frame_rate,pix_fmt,color_range", "-of", "csv=p=0", file]);
  console.log(`${path.basename(file)}: ${humanSize(statSync(file).size)}  ${probe.trim().split("\n").join(" ")}`);
}
