// Runs scripts/setup.mjs check in a scratch HOME. It never installs anything and never touches the
// real ~/.product-video.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const SETUP = fileURLToPath(new URL("../skills/product-video/scripts/setup.mjs", import.meta.url));
const STATUSES = new Set(["READY", "MISSING", "INSTALLED", "OPTIONAL", "NEEDS-PERSON", "RESULT"]);

function check(env) {
  const result = spawnSync(process.execPath, [SETUP, "check"], { env, encoding: "utf8" });
  return { status: result.status, lines: result.stdout.trim().split("\n"), stderr: result.stderr };
}

function executable(file, body) {
  writeFileSync(file, `#!${process.execPath}\n${body}\n`);
  chmodSync(file, 0o755);
}

describe("setup.mjs check", { skip: process.platform !== "linux" && "the fake tools below are Linux-only (macOS checks the processor with file)" }, () => {
  it("finds tools in ~/.product-video/bin of a fresh HOME with no shell and no env.sh", () => {
    const home = mkdtempSync(path.join(os.tmpdir(), "pv-setup-"));
    const bin = path.join(home, ".product-video", "bin");
    mkdirSync(bin, { recursive: true });
    // Fake ffmpeg and ffprobe: enough for the checks, nothing else.
    executable(path.join(bin, "ffmpeg"), `const a = process.argv.slice(2);
if (a.includes("-encoders")) console.log(" V..... libx264 H.264");
else console.log("ffmpeg version 9.9-fake Copyright (c) the test");`);
    executable(path.join(bin, "ffprobe"), "");
    const chrome = path.join(home, "fake-chrome");
    executable(chrome, "");
    // PATH has node and npm but no ffmpeg; setup must find bin/ itself.
    const nodeDir = path.dirname(process.execPath);
    const { status, lines, stderr } = check({ HOME: home, PATH: nodeDir, PRODUCT_VIDEO_CHROME: chrome });

    assert.equal(stderr, "");
    for (const line of lines) assert.ok(STATUSES.has(line.split(/\s+/)[0]), `unexpected line: ${line}`);
    assert.ok(lines.includes(`READY         ffmpeg 9.9-fake`), lines.join("\n"));
    assert.ok(lines.includes(`READY         Chrome (${chrome})`), lines.join("\n"));
    assert.ok(lines.some((line) => line.startsWith("OPTIONAL") && line.includes("Phone-app recording needs a Mac")));
    // Ready needs npm too, which is normally installed beside node.
    if (existsSync(path.join(nodeDir, "npm"))) {
      assert.equal(lines.at(-1), "RESULT        ready to make videos");
      assert.equal(status, 0);
    }
  });

  it("reports MISSING ffmpeg and not ready when there is none", () => {
    const home = mkdtempSync(path.join(os.tmpdir(), "pv-setup-"));
    const { status, lines } = check({ HOME: home, PATH: path.dirname(process.execPath), PRODUCT_VIDEO_CHROME: process.execPath });
    assert.ok(lines.some((line) => /^MISSING\s+ffmpeg/.test(line)), lines.join("\n"));
    assert.equal(lines.at(-1), "RESULT        not ready");
    assert.equal(status, 1);
  });

  it("says when PRODUCT_VIDEO_CHROME points nowhere", () => {
    const home = mkdtempSync(path.join(os.tmpdir(), "pv-setup-"));
    const { lines } = check({ HOME: home, PATH: path.dirname(process.execPath), PRODUCT_VIDEO_CHROME: "/no/such/chrome" });
    assert.ok(lines.some((line) => line.startsWith("NEEDS-PERSON") && line.includes("PRODUCT_VIDEO_CHROME")), lines.join("\n"));
  });
});
