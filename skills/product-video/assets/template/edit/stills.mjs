// Renders single frames of a composition at half scale for review:
//   node stills.mjs <Video|Hype> <outDir> <frame> [frame...]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync } from "node:fs";
import path from "node:path";

const [id, outDir, ...frames] = process.argv.slice(2);
if (!id || !outDir || !frames.length) throw new Error("Usage: node stills.mjs <Video|Hype> <outDir> <frame> [frame...]");
mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id });
for (const frame of frames.map(Number)) {
  const output = path.join(outDir, `f${String(frame).padStart(4, "0")}.jpg`);
  await renderStill({ serveUrl, composition, frame, output, imageFormat: "jpeg", jpegQuality: 85, scale: 0.5 });
  console.log(output);
}
