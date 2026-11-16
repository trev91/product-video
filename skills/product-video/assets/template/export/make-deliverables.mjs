// Narrated video: render the master from Remotion, then a compact two-pass delivery file
// (H.264 1920x1080 30 fps, AAC 192 kbps 48 kHz stereo, loudness from the profile's
// delivery.loudnessLufs with true peak at -1 dB).
// VIDEO_KBPS sets the delivery bitrate (default 420, about 3.4 MB a minute; screen recordings compress well).
// Output names come from edit/video.json ("name"): <name>-master.mp4, <name>.mp4
//   node export/make-deliverables.mjs
// Needs no shell (export/make-deliverables.sh wraps it).
import { readFileSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { capture, humanSize, remotionBrowserArgs, run } from "../lib/tools.mjs";

const EXPORT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.join(EXPORT_DIR, "..");
const EDIT_DIR = path.join(PROJECT_DIR, "edit");
const name = JSON.parse(readFileSync(path.join(EDIT_DIR, "video.json"), "utf8")).name;
const lufs = JSON.parse(readFileSync(path.join(PROJECT_DIR, "profile.json"), "utf8")).delivery?.loudnessLufs ?? -16;
const kbps = Number(process.env.VIDEO_KBPS ?? 420);
const master = path.join(EXPORT_DIR, `${name}-master.mp4`);
const delivery = path.join(EXPORT_DIR, `${name}.mp4`);

run("npx", ["remotion", "render", "src/index.ts", "Video", master, "--codec", "h264", "--crf", "18",
  "--audio-codec", "aac", "--audio-bitrate", "256k", "--log=error", ...remotionBrowserArgs()], { cwd: EDIT_DIR });

const rate = ["-b:v", `${kbps}k`, "-maxrate", `${Math.floor((kbps * 5) / 4)}k`, "-bufsize", `${Math.floor((kbps * 5) / 2)}k`];
const passlog = path.join(EXPORT_DIR, "x264pass");
const nullOut = os.platform() === "win32" ? "NUL" : "/dev/null";
run("ffmpeg", ["-v", "error", "-y", "-i", master, "-c:v", "libx264", ...rate, "-preset", "slow", "-pix_fmt", "yuv420p", "-r", "30",
  "-pass", "1", "-passlogfile", passlog, "-an", "-f", "mp4", nullOut], { cwd: EXPORT_DIR });
run("ffmpeg", ["-v", "error", "-y", "-i", master, "-c:v", "libx264", ...rate, "-preset", "slow", "-pix_fmt", "yuv420p", "-r", "30",
  "-pass", "2", "-passlogfile", passlog, "-af", `loudnorm=I=${lufs}:TP=-1:LRA=11`, "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
  "-movflags", "+faststart", delivery], { cwd: EXPORT_DIR });
rmSync(`${passlog}-0.log`, { force: true });
rmSync(`${passlog}-0.log.mbtree`, { force: true });

const masterSeconds = capture("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", master]).trim();
console.log(`master:   ${humanSize(statSync(master).size)}  ${masterSeconds}s`);
const deliveryInfo = capture("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_name,width,height,r_frame_rate,sample_rate,channels", "-of", "csv=p=0", delivery]);
console.log(`delivery: ${humanSize(statSync(delivery).size)}  ${deliveryInfo.trim().split("\n").join(" ")}`);
