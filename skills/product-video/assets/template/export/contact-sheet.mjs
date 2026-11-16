// One frame every 12 s of the delivery file, tiled, for a quick visual review.
//   node export/contact-sheet.mjs [file.mp4] [out.png]
//   (paths relative to export/, or absolute; default export/<name>.mp4 from edit/video.json)
// --every <seconds> changes the spacing (a short hype cut reads better at 1 or 2).
// Needs no shell (export/contact-sheet.sh wraps it).
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { run } from "../lib/tools.mjs";

const EXPORT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.join(EXPORT_DIR, "..");
const args = process.argv.slice(2);
const every = args.includes("--every") ? Number(args.splice(args.indexOf("--every"), 2)[1]) : 12;
const name = JSON.parse(readFileSync(path.join(PROJECT_DIR, "edit/video.json"), "utf8")).name;
const file = path.resolve(EXPORT_DIR, args[0] ?? `${name}.mp4`);
const out = args[1] ? path.resolve(EXPORT_DIR, args[1]) : path.join(PROJECT_DIR, "log/sheets", `${path.basename(file, ".mp4")}-sheet.png`);
mkdirSync(path.dirname(out), { recursive: true });
run("ffmpeg", ["-v", "error", "-y", "-i", file, "-vf", `fps=1/${every},scale=384:-1,tile=6x4`, "-frames:v", "1", out]);
console.log(out);
