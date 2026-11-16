#!/usr/bin/env node
// Create a video project from the template, with a profile that is either supplied or drafted.
//   node new-project.mjs <project-dir> <video-name> <profile.json>
//   node new-project.mjs <project-dir> <video-name> --from-urls <brand-url> <app-url>
//   node new-project.mjs <project-dir> <video-name> --from-media <brand-url>
//   e.g. node new-project.mjs ./videos/onboarding-tour onboarding-tour ./video-profile.json
//        node new-project.mjs ./videos/launch launch-hype --from-urls https://example.com https://app.example.com
// A supplied profile is copied into the project (with its logo and fonts), validated and applied.
// --from-urls drafts the profile: brand from the first URL, the app to record from the second,
// with read-only mode on. --from-media drafts a profile with the brand only, for a video made
// from supplied screenshots and videos (lib/import-media.mjs) with no app recorded.
// Confirm the draft (log/profile-draft.md) with the person before recording or editing.
// Needs no shell: it finds ~/.product-video/bin itself (scripts/new-project.sh wraps it).
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { findChrome, run, which } from "../assets/template/lib/tools.mjs";

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const USAGE = "usage: node new-project.mjs <project-dir> <video-name> <profile.json | --from-urls <brand-url> <app-url> | --from-media <brand-url>>";

function fail(message) {
  console.error(message);
  process.exit(1);
}

const [dirArg, name, source, ...rest] = process.argv.slice(2);
if (!dirArg || !name || !source) fail(USAGE);
let profilePath = "";
let brandUrl = "";
let appUrl = "";
if (source === "--from-urls") {
  [brandUrl, appUrl] = rest;
  if (!brandUrl || !appUrl) fail("--from-urls needs a brand URL and an app URL");
} else if (source === "--from-media") {
  [brandUrl] = rest;
  if (!brandUrl) fail("--from-media needs a brand URL");
  appUrl = "--media";
} else {
  profilePath = path.resolve(source);
  if (!existsSync(profilePath)) fail(`profile not found: ${source}`);
}
const DIR = path.resolve(dirArg);
if (existsSync(path.join(DIR, "profile.json"))) fail(`${dirArg} already holds a project`);
if (DIR.includes(" ")) fail(`the project path must not contain spaces: ${DIR}`);
if (!which("npm")) fail("npm is missing: run scripts/setup.mjs install first");

for (const folder of ["raw/web", "raw/mobile", "raw/cuts", "raw/media", "music", "gfx", "log", "captions", "auth"]) {
  mkdirSync(path.join(DIR, folder), { recursive: true });
}
cpSync(path.join(SKILL, "assets/template"), DIR, { recursive: true });
rmSync(path.join(DIR, "profile.example.json"));

const videoPath = path.join(DIR, "edit/video.json");
const video = JSON.parse(readFileSync(videoPath, "utf8"));
video.name = name;
writeFileSync(videoPath, `${JSON.stringify(video, null, 2)}\n`);

// A supplied profile, with its logo and font files copied beside it so the project is self-contained.
if (profilePath) {
  const profile = JSON.parse(readFileSync(profilePath, "utf8"));
  const bring = (relative, folder, fileName) => {
    const from = path.resolve(path.dirname(profilePath), relative);
    const target = `${folder}/${fileName ?? path.basename(from)}`;
    mkdirSync(path.join(DIR, folder), { recursive: true });
    copyFileSync(from, path.join(DIR, target));
    return target;
  };
  profile.$schema = "./lib/profile.schema.json";
  if (profile.brand?.logo) profile.brand.logo = bring(profile.brand.logo, "gfx", `logo${path.extname(profile.brand.logo)}`);
  for (const file of profile.brand?.fontFiles ?? []) file.path = bring(file.path, "gfx/fonts");
  writeFileSync(path.join(DIR, "profile.json"), `${JSON.stringify(profile, null, 2)}\n`);
}

console.log("installing dependencies (a few minutes the first time)...");
for (const folder of [DIR, path.join(DIR, "edit")]) {
  try {
    run("npm", ["install", "--no-audit", "--no-fund"], { cwd: folder, quiet: true });
  } catch (error) {
    fail(`npm install failed in ${folder}\n${error.message}`);
  }
}
// Without Chrome or Chromium, the recorder uses Playwright's own Chromium (lib/browser.mjs decides the same way).
if (!findChrome()) {
  console.log("Google Chrome not found: downloading a private copy of Chromium...");
  try {
    run("npx", ["playwright", "install", "chromium"], { cwd: DIR, quiet: true });
  } catch (error) {
    fail(`could not download Chromium\n${error.message}`);
  }
}
// Remotion serves media from edit/public: link the project folders into it.
const publicDir = path.join(DIR, "edit/public");
mkdirSync(publicDir, { recursive: true });
for (const folder of ["raw", "vo", "music", "gfx"]) {
  const link = path.join(publicDir, folder);
  rmSync(link, { force: true, recursive: false });
  symlinkSync(path.join("..", "..", folder), link, "dir");
}
// Root.tsx imports edit/src/edl.json for the narrated "Video" composition, so the bundle fails
// without it. A silent hype cut never runs build-edl.mjs (it needs voice durations): start with an
// empty edit decision list, which build-edl.mjs overwrites.
const edlPath = path.join(DIR, "edit/src/edl.json");
if (!existsSync(edlPath)) {
  const emptyEdl = {
    fps: 30,
    captions: [],
    scenes: [],
    musicSrc: null,
    totalDuration: 0,
    transitionFrames: 10,
    titleCard: { heading: "", subline: "" },
    endCard: { heading: "", subline: "", contactLine: "" },
  };
  writeFileSync(edlPath, `${JSON.stringify(emptyEdl, null, 2)}\n`);
}
if (brandUrl) {
  run(process.execPath, ["lib/draft-profile.mjs", brandUrl, appUrl], { cwd: DIR, quiet: true });
  console.log(`profile drafted from ${brandUrl}: read ${path.join(DIR, "log/profile-draft.md")} and confirm it with the person`);
}
run(process.execPath, ["lib/apply-profile.mjs"], { cwd: DIR });

const started = new Date();
const stamp = `${started.getFullYear()}-${String(started.getMonth() + 1).padStart(2, "0")}-${String(started.getDate()).padStart(2, "0")} ${String(started.getHours()).padStart(2, "0")}:${String(started.getMinutes()).padStart(2, "0")}`;
writeFileSync(path.join(DIR, "log/recording-log.txt"), `Video "${name}" - recording log
Started ${stamp}. Project: ${DIR}

Session log (shot, take, time, anything created or deleted)
`);
console.log(`project ready: ${DIR}`);
console.log("next: node lib/check-env.mjs, then follow the skill's workflow");
