#!/usr/bin/env node
// Checks this Mac (or Linux machine, for web videos) for what the video pipeline needs and, when
// asked, installs what is missing into the person's home folder. No administrator password,
// nothing system-wide. Runs with any Node 18 or newer; scripts/setup.sh wraps it and installs
// Node first when there is none at all.
//   node setup.mjs check      report only; changes nothing
//   node setup.mjs install    install whatever "check" reported missing, then report again
// Everything it installs lives in ~/.product-video ($PRODUCT_VIDEO_HOME; delete that folder to undo it):
//   tools/node-*   Node.js from nodejs.org, checksum-verified   (about 50 MB download, 190 MB on disk)
//   tools/ffmpeg   ffmpeg and ffprobe builds from the npm packages ffmpeg-static and @ffprobe-installer/ffprobe (about 65 MB)
//   bin/, env.sh   links to those tools, and a PATH line for people who use a shell (the Node
//                  scripts find bin/ themselves)
// Output lines start with READY, MISSING, INSTALLED, OPTIONAL or NEEDS-PERSON so they are easy to relay.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, rmSync, statfsSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import { capture, findChrome, installedNodeBin, loadToolPath, productVideoHome, run, which } from "../assets/template/lib/tools.mjs";

const NODE_LINE = 22;
const MIN_NODE = 20;
const MIN_FREE_GB = 3;

function sayLine(status, text) {
  console.log(`${status.padEnd(13)} ${text}`);
}

/** The major version of the `node` on PATH (not necessarily this process), or 0. */
function nodeMajor() {
  if (!which("node")) return 0;
  try {
    return Number(capture("node", ["-p", "process.versions.node.split('.')[0]"]).trim());
  } catch {
    return 0;
  }
}

function nodeOk() {
  return nodeMajor() >= MIN_NODE && which("npm") !== null;
}

/** A tool built for the other processor only runs where Rosetta happens to be installed, so it does not count. */
function native(command) {
  if (process.platform !== "darwin") return true;
  try {
    return capture("file", ["-L", which(command)]).includes(os.machine?.() ?? process.arch);
  } catch {
    return false;
  }
}

function ffmpegOk() {
  if (!which("ffmpeg") || !which("ffprobe") || !native("ffmpeg") || !native("ffprobe")) return false;
  try {
    return capture("ffmpeg", ["-hide_banner", "-encoders"]).includes("libx264");
  } catch {
    return false;
  }
}

function ffmpegVersion() {
  return capture("ffmpeg", ["-version"]).split("\n")[0].split(" ")[2];
}

/** The voice engine `narration.mode: system` will use here, or null. */
function systemVoice() {
  if (process.platform === "darwin" && which("say")) return "macOS say";
  return ["espeak-ng", "espeak"].find((command) => which(command)) ?? null;
}

function freeGb(dir) {
  const stats = statfsSync(dir);
  return Math.floor((stats.bavail * stats.bsize) / 1024 ** 3);
}

/** Writes env.sh (for shells) and puts the tools on this process's PATH. */
function writeEnv(home) {
  const bin = path.join(home, "bin");
  mkdirSync(bin, { recursive: true });
  const nodeBin = installedNodeBin();
  writeFileSync(
    path.join(home, "env.sh"),
    `# Written by product-video setup. The Node scripts find these folders themselves; this is for shells.\nexport PATH="${bin}${nodeBin ? `:${nodeBin}` : ""}:$PATH"\n`,
  );
  loadToolPath();
}

async function installNode(home) {
  const arch = { arm64: "arm64", x64: "x64" }[process.arch];
  const platform = { darwin: "darwin", linux: "linux" }[process.platform];
  if (!arch || !platform) {
    sayLine("MISSING", `Node.js: unsupported computer (${process.platform} ${process.arch})`);
    return false;
  }
  const base = `https://nodejs.org/dist/latest-v${NODE_LINE}.x`;
  const tools = path.join(home, "tools");
  mkdirSync(tools, { recursive: true });
  let sums;
  try {
    sums = await (await fetch(`${base}/SHASUMS256.txt`)).text();
  } catch {
    sayLine("MISSING", "Node.js: could not reach nodejs.org");
    return false;
  }
  const file = sums.match(new RegExp(`node-v[0-9.]+-${platform}-${arch}\\.tar\\.gz`))?.[0];
  if (!file) {
    sayLine("MISSING", "Node.js: no build listed for this computer");
    return false;
  }
  const response = await fetch(`${base}/${file}`).catch(() => null);
  if (!response?.ok) {
    sayLine("MISSING", "Node.js: download failed");
    return false;
  }
  const data = Buffer.from(await response.arrayBuffer());
  const sum = createHash("sha256").update(data).digest("hex");
  if (!sums.split("\n").includes(`${sum}  ${file}`)) {
    sayLine("MISSING", "Node.js: the download did not match its published checksum and was discarded");
    return false;
  }
  // Unzipped here so only `tar` itself is needed.
  const archive = path.join(tools, file.replace(/\.gz$/, ""));
  writeFileSync(archive, gunzipSync(data));
  try {
    run("tar", ["-xf", archive], { cwd: tools, quiet: true });
  } catch (error) {
    sayLine("MISSING", `Node.js: could not unpack the download (${error.message.split("\n")[0]})`);
    return false;
  } finally {
    rmSync(archive, { force: true });
  }
  writeEnv(home);
  if (!nodeOk()) return false;
  sayLine("INSTALLED", `Node.js ${capture("node", ["--version"]).trim()}`);
  return true;
}

function installFfmpeg(home) {
  const dir = path.join(home, "tools", "ffmpeg");
  const bin = path.join(home, "bin");
  mkdirSync(dir, { recursive: true });
  mkdirSync(bin, { recursive: true });
  rmSync(path.join(bin, "ffmpeg"), { force: true });
  rmSync(path.join(bin, "ffprobe"), { force: true });
  try {
    run("npm", ["install", "--prefix", ".", "--no-audit", "--no-fund", "ffmpeg-static", "@ffprobe-installer/ffprobe"], { cwd: dir, quiet: true });
  } catch {
    sayLine("MISSING", "ffmpeg: the download failed");
    return false;
  }
  let ffmpegPath;
  let ffprobePath;
  try {
    ffmpegPath = capture("node", ["-p", "require('ffmpeg-static')"], { cwd: dir }).trim();
    ffprobePath = capture("node", ["-p", "require('@ffprobe-installer/ffprobe').path"], { cwd: dir }).trim();
  } catch {
    ffmpegPath = "";
  }
  if (!ffmpegPath || !existsSync(ffmpegPath) || !existsSync(ffprobePath)) {
    sayLine("MISSING", "ffmpeg: no build for this computer in the packages");
    return false;
  }
  symlinkSync(ffmpegPath, path.join(bin, "ffmpeg"));
  symlinkSync(ffprobePath, path.join(bin, "ffprobe"));
  writeEnv(home);
  if (!ffmpegOk()) {
    sayLine("MISSING", "ffmpeg: the packaged build does not run natively on this computer");
    return false;
  }
  sayLine("INSTALLED", `ffmpeg ${ffmpegVersion()}`);
  return true;
}

/** Prints one line per requirement and returns whether the machine is ready. */
function report() {
  if (!["darwin", "linux"].includes(process.platform)) {
    sayLine("MISSING", "This setup supports macOS and Linux only.");
    return false;
  }
  let ready = true;
  if (nodeOk()) sayLine("READY", `Node.js ${capture("node", ["--version"]).trim()}`);
  else {
    sayLine("MISSING", "Node.js (runs the recorder and the editor)");
    ready = false;
  }
  if (ffmpegOk()) sayLine("READY", `ffmpeg ${ffmpegVersion()}`);
  else {
    sayLine("MISSING", "ffmpeg (converts and exports video)");
    ready = false;
  }
  let chrome = null;
  try {
    chrome = findChrome();
  } catch (error) {
    sayLine("NEEDS-PERSON", error.message);
  }
  if (chrome) sayLine("READY", `Chrome (${chrome})`);
  else sayLine("OPTIONAL", "Google Chrome or Chromium is not installed: a private copy of Chromium (about 150 MB) is downloaded with the first project instead");
  const voice = systemVoice();
  if (voice) sayLine("READY", `Narration voice for drafts (${voice})`);
  else sayLine("OPTIONAL", "No system voice for narrated drafts (macOS say or espeak-ng). Hype cuts are silent and do not need one; narrated videos can use a recorded voice, your own voice command, or captions only.");
  if (process.platform !== "darwin") {
    sayLine("OPTIONAL", "Phone-app recording needs a Mac (iOS Simulator). Web recording does not need it.");
  } else if (which("xcrun") && which("maestro")) {
    sayLine("READY", "Phone-app recording (iOS Simulator and Maestro)");
  } else {
    sayLine("OPTIONAL", "Phone-app recording is not set up (needs Xcode and Maestro). Web recording does not need it.");
  }
  const free = freeGb(os.homedir());
  if (free < MIN_FREE_GB) {
    sayLine("NEEDS-PERSON", `Only ${free} GB of disk is free; a video project needs about 2 GB.`);
    ready = false;
  }
  sayLine("RESULT", ready ? "ready to make videos" : "not ready");
  return ready;
}

async function install() {
  if (!["darwin", "linux"].includes(process.platform)) {
    sayLine("MISSING", "This setup supports macOS and Linux only.");
    return false;
  }
  const home = productVideoHome();
  mkdirSync(home, { recursive: true });
  if (!nodeOk()) await installNode(home);
  if (nodeOk() && !ffmpegOk()) installFfmpeg(home);
  writeEnv(home);
  return report();
}

const mode = process.argv[2] ?? "check";
if (mode === "check") process.exitCode = report() ? 0 : 1;
else if (mode === "install") process.exitCode = (await install()) ? 0 : 1;
else {
  console.error("usage: node setup.mjs check|install");
  process.exitCode = 2;
}
