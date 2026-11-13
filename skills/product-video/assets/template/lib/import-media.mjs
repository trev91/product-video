/**
 * Brings supplied screenshots and videos into the project so the edit can use them, as an
 * alternative (or an addition) to recording the app.
 *   node lib/import-media.mjs <file-or-folder> [...]
 *
 * Images (png, jpg, webp; heic, tiff, bmp and gif are converted to png) are copied and capped at
 * 3840 px on the long side. Videos (mp4, mov, m4v, webm, mkv, avi) are re-encoded to silent,
 * constant 30 fps H.264, capped at 1920 px on the long side. The originals are never changed.
 *
 * Writes raw/media/<nn>-<name>.<ext>, raw/media/index.json (what each item is) and
 * log/media/sheet.jpg (a numbered contact sheet to look through before scripting).
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { PROJECT_DIR } from "./profile.mjs";

const READY_IMAGES = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const CONVERTED_IMAGES = new Set([".heic", ".heif", ".tif", ".tiff", ".bmp", ".gif"]);
const VIDEOS = new Set([".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi"]);
const MAX_IMAGE_SIDE = 3840;
const MAX_VIDEO_SIDE = 1920;
const THUMB = { width: 480, height: 300 };
const SHEET_COLUMNS = 4;

const mediaDir = path.join(PROJECT_DIR, "raw", "media");
const logDir = path.join(PROJECT_DIR, "log", "media");
const indexPath = path.join(mediaDir, "index.json");

const inputs = process.argv.slice(2);
if (!inputs.length) throw new Error("Usage: node lib/import-media.mjs <file-or-folder> [...]");

const naturalOrder = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const extensionOf = (file) => path.extname(file).toLowerCase();
const isMedia = (file) => READY_IMAGES.has(extensionOf(file)) || CONVERTED_IMAGES.has(extensionOf(file)) || VIDEOS.has(extensionOf(file));

/** Every media file named directly, plus the media files directly inside each named folder. */
function collect(paths) {
  const files = [];
  for (const input of paths) {
    const full = path.resolve(input);
    if (!existsSync(full)) throw new Error(`not found: ${input}`);
    if (statSync(full).isDirectory()) {
      const inside = readdirSync(full).filter((name) => !name.startsWith(".") && isMedia(name)).sort(naturalOrder.compare);
      files.push(...inside.map((name) => path.join(full, name)));
    } else if (isMedia(full)) {
      files.push(full);
    } else {
      console.warn(`skipped (not an image or video this tool reads): ${input}`);
    }
  }
  return files;
}

function slug(file) {
  const base = path.basename(file, path.extname(file)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return base.slice(0, 40) || "media";
}

function probe(file) {
  const out = execFileSync("ffprobe", [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height:format=duration", "-of", "json", file,
  ]).toString();
  const parsed = JSON.parse(out);
  const stream = parsed.streams[0];
  if (!stream) throw new Error(`no picture found in ${path.basename(file)}`);
  const duration = Number(parsed.format?.duration);
  return { width: stream.width, height: stream.height, duration: Number.isFinite(duration) ? Math.round(duration * 100) / 100 : null };
}

/** macOS converts and resizes images with its own `sips`; elsewhere ffmpeg does it. */
const HAS_SIPS = process.platform === "darwin";

function convertToPng(source, target) {
  if (HAS_SIPS) execFileSync("sips", ["-s", "format", "png", source, "--out", target], { stdio: "ignore" });
  else execFileSync("ffmpeg", ["-v", "error", "-y", "-i", source, "-frames:v", "1", target]);
}

/** Scales an image down in place so its long side is at most `maxSide`. */
function capLongSide(file, maxSide) {
  if (HAS_SIPS) {
    execFileSync("sips", ["-Z", String(maxSide), file], { stdio: "ignore" });
    return;
  }
  const resized = `${file}.resized${extensionOf(file)}`;
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-frames:v", "1",
    "-vf", `scale=${maxSide}:${maxSide}:force_original_aspect_ratio=decrease`, resized]);
  renameSync(resized, file);
}

function importImage(source, target) {
  if (READY_IMAGES.has(extensionOf(source))) copyFileSync(source, target);
  else convertToPng(source, target);
  const { width, height } = probe(target);
  if (Math.max(width, height) > MAX_IMAGE_SIDE) capLongSide(target, MAX_IMAGE_SIDE);
}

function importVideo(source, target) {
  // Landscape is capped by width, portrait by height; -2 keeps the other side even, as H.264 needs.
  const scale = `scale=w='if(gte(iw,ih),min(${MAX_VIDEO_SIDE},iw),-2)':h='if(gte(iw,ih),-2,min(${MAX_VIDEO_SIDE},ih))'`;
  execFileSync("ffmpeg", [
    "-v", "error", "-y", "-i", source, "-an", "-vf", `fps=30,${scale}`,
    "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart", target,
  ]);
}

/** Portrait media is shown in the phone frame; everything else fills the frame. */
const shotKind = (width, height) => (height > width * 1.2 ? "mobile" : "web");

function writeSheet(index) {
  rmSync(logDir, { recursive: true, force: true });
  mkdirSync(logDir, { recursive: true });
  const fit = `scale=${THUMB.width}:${THUMB.height}:force_original_aspect_ratio=decrease,pad=${THUMB.width}:${THUMB.height}:(ow-iw)/2:(oh-ih)/2:color=0x1A1A1A,format=yuvj420p`;
  index.forEach((item, position) => {
    const number = String(position + 1).padStart(3, "0");
    execFileSync("ffmpeg", [
      "-v", "error", "-y", ...(item.type === "video" ? ["-ss", String(Math.min(1, (item.duration ?? 0) / 2))] : []),
      "-i", path.join(PROJECT_DIR, item.file), "-frames:v", "1", "-vf", fit, path.join(logDir, `thumb-${number}.jpg`),
    ]);
  });
  const rows = Math.ceil(index.length / SHEET_COLUMNS);
  execFileSync("ffmpeg", [
    "-v", "error", "-y", "-start_number", "1", "-i", path.join(logDir, "thumb-%03d.jpg"),
    "-frames:v", "1", "-vf", `tile=${SHEET_COLUMNS}x${rows}:padding=8:color=0x000000`, path.join(logDir, "sheet.jpg"),
  ]);
}

mkdirSync(mediaDir, { recursive: true });
const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf8")) : [];
const added = [];
for (const source of collect(inputs)) {
  const isVideo = VIDEOS.has(extensionOf(source));
  const number = String(index.length + 1).padStart(2, "0");
  const extension = isVideo ? ".mp4" : READY_IMAGES.has(extensionOf(source)) ? extensionOf(source) : ".png";
  const file = `raw/media/${number}-${slug(source)}${extension}`;
  const target = path.join(PROJECT_DIR, file);
  if (isVideo) importVideo(source, target);
  else importImage(source, target);
  const { width, height, duration } = probe(target);
  const item = {
    file,
    original: path.basename(source),
    type: isVideo ? "video" : "image",
    width,
    height,
    ...(isVideo ? { duration } : {}),
    kind: shotKind(width, height),
  };
  index.push(item);
  added.push(item);
}
if (!added.length) throw new Error("no images or videos found in what was given");
writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
writeSheet(index);

console.log(`imported ${added.length} item(s); ${index.length} in raw/media/index.json. Contact sheet: log/media/sheet.jpg (left to right, top to bottom, in index order).`);
for (const [position, item] of index.entries()) {
  const size = `${item.width}x${item.height}`;
  const length = item.type === "video" ? `, ${item.duration}s` : "";
  console.log(`  ${String(position + 1).padStart(2, " ")}. ${item.file}  (${item.type}, ${size}${length}, ${item.kind} shot)  from ${item.original}`);
}
console.log(`use one in edit/shots.json as: "03-1": { "kind": "<web|mobile>", "src": "<file>" }`);
