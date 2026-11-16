// Renders single frames of a composition at half scale for review:
//   node stills.mjs <Video|Hype> <outDir> <frame> [frame...]
//   node stills.mjs --check Hype <outDir> <frame> [frame...]
// --check also reports every frame where a Browser window crosses the frame edge (Devices.tsx
// logs it) and exits with status 2 if any does. Uses the installed Chrome on Linux (see
// remotionBrowser in lib/tools.mjs) instead of downloading Remotion's own browser.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { remotionBrowser } from "../lib/tools.mjs";

const OFF_FRAME_TAG = "[product-video:off-frame]"; // the same tag as src/hype/safeArea.ts

const args = process.argv.slice(2);
const check = args.includes("--check");
const [id, outDir, ...frames] = args.filter((arg) => arg !== "--check");
if (!id || !outDir || !frames.length) throw new Error("Usage: node stills.mjs [--check] <Video|Hype> <outDir> <frame> [frame...]");
mkdirSync(outDir, { recursive: true });
const browser = remotionBrowser() ?? {};
const problems = [];
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id, ...browser });
for (const frame of frames.map(Number)) {
  const output = path.join(outDir, `f${String(frame).padStart(4, "0")}.jpg`);
  const onBrowserLog = (log) => {
    if (log.text.includes(OFF_FRAME_TAG)) problems.push(`frame ${frame}: ${log.text.slice(log.text.indexOf(OFF_FRAME_TAG) + OFF_FRAME_TAG.length).trim()}`);
  };
  await renderStill({ serveUrl, composition, frame, output, imageFormat: "jpeg", jpegQuality: 85, scale: 0.5, onBrowserLog, ...browser });
  console.log(output);
}
if (check) {
  const unique = [...new Set(problems)];
  if (unique.length) {
    console.log(`\nOFF-FRAME: ${unique.length} problem(s)`);
    for (const line of unique) console.log(`  ${line}`);
    process.exitCode = 2;
  } else {
    console.log("\ncheck: every Browser window stays inside the frame");
  }
}
