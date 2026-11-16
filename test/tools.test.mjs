import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  findChrome,
  loadToolPath,
  remotionBrowser,
  remotionBrowserArgs,
  toolDirs,
  which,
} from "../skills/product-video/assets/template/lib/tools.mjs";

/** An `exists` stand-in that knows only these paths. */
const only = (...paths) => (candidate) => paths.includes(candidate);

describe("findChrome", () => {
  const env = { HOME: "/home/test", PATH: "/usr/local/bin:/usr/bin:/snap/bin" };

  it("uses PRODUCT_VIDEO_CHROME first", () => {
    const chrome = findChrome({ env: { ...env, PRODUCT_VIDEO_CHROME: "/custom/chrome" }, platform: "linux", exists: only("/custom/chrome", "/opt/google/chrome/chrome") });
    assert.equal(chrome, "/custom/chrome");
  });

  it("refuses a PRODUCT_VIDEO_CHROME that is not there", () => {
    assert.throws(() => findChrome({ env: { ...env, PRODUCT_VIDEO_CHROME: "/missing" }, platform: "linux", exists: only() }), /PRODUCT_VIDEO_CHROME/);
  });

  it("prefers the Google Chrome package binary on Linux", () => {
    const chrome = findChrome({ env, platform: "linux", exists: only("/opt/google/chrome/chrome", "/usr/bin/chromium") });
    assert.equal(chrome, "/opt/google/chrome/chrome");
  });

  it("finds google-chrome-stable, chromium and chromium-browser on PATH, in that order", () => {
    assert.equal(findChrome({ env, platform: "linux", exists: only("/usr/bin/google-chrome-stable", "/usr/bin/chromium") }), "/usr/bin/google-chrome-stable");
    assert.equal(findChrome({ env, platform: "linux", exists: only("/usr/local/bin/chromium", "/usr/bin/chromium-browser") }), "/usr/local/bin/chromium");
    assert.equal(findChrome({ env, platform: "linux", exists: only("/usr/bin/chromium-browser") }), "/usr/bin/chromium-browser");
  });

  it("falls back to Snap's chromium when PATH has nothing", () => {
    assert.equal(findChrome({ env: { HOME: "/home/test", PATH: "/nowhere" }, platform: "linux", exists: only("/snap/bin/chromium") }), "/snap/bin/chromium");
  });

  it("returns null when there is no browser", () => {
    assert.equal(findChrome({ env, platform: "linux", exists: only() }), null);
  });

  it("finds the Chrome app on macOS, system-wide or in the home folder", () => {
    const system = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    const personal = "/home/test/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    assert.equal(findChrome({ env, platform: "darwin", exists: only(system) }), system);
    assert.equal(findChrome({ env, platform: "darwin", exists: only(personal) }), personal);
    assert.equal(findChrome({ env, platform: "darwin", exists: only("/usr/bin/chromium") }), null);
  });
});

describe("remotionBrowser", () => {
  const env = { HOME: "/home/test", PATH: "/usr/bin" };
  const chrome = only("/opt/google/chrome/chrome");

  it("reuses the installed Chrome on Linux in chrome-for-testing mode", () => {
    assert.deepEqual(remotionBrowser({ env, platform: "linux", exists: chrome }), { browserExecutable: "/opt/google/chrome/chrome", chromeMode: "chrome-for-testing" });
    assert.deepEqual(remotionBrowserArgs({ env, platform: "linux", exists: chrome }), ["--browser-executable=/opt/google/chrome/chrome", "--chrome-mode=chrome-for-testing"]);
  });

  it("keeps Remotion's own browser on macOS unless asked", () => {
    const mac = only("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
    assert.equal(remotionBrowser({ env, platform: "darwin", exists: mac }), null);
    assert.equal(remotionBrowser({ env: { ...env, PRODUCT_VIDEO_REMOTION_BROWSER: "system" }, platform: "darwin", exists: mac }).chromeMode, "chrome-for-testing");
  });

  it("can be told to use the bundled browser, and rejects other values", () => {
    assert.equal(remotionBrowser({ env: { ...env, PRODUCT_VIDEO_REMOTION_BROWSER: "bundled" }, platform: "linux", exists: chrome }), null);
    assert.throws(() => remotionBrowser({ env: { ...env, PRODUCT_VIDEO_REMOTION_BROWSER: "chrome" }, platform: "linux", exists: chrome }), /system" or "bundled/);
  });

  it("returns null when no browser is installed", () => {
    assert.equal(remotionBrowser({ env, platform: "linux", exists: only() }), null);
    assert.deepEqual(remotionBrowserArgs({ env, platform: "linux", exists: only() }), []);
  });
});

describe("loadToolPath", () => {
  it("puts ~/.product-video/bin and setup's Node in front of PATH, once", () => {
    const home = mkdtempSync(path.join(os.tmpdir(), "pv-tools-"));
    const bin = path.join(home, ".product-video", "bin");
    const nodeBin = path.join(home, ".product-video", "tools", "node-v22.0.0-linux-x64", "bin");
    mkdirSync(bin, { recursive: true });
    mkdirSync(nodeBin, { recursive: true });
    writeFileSync(path.join(nodeBin, "node"), "");
    const env = { HOME: home, PATH: "/usr/bin" };
    assert.deepEqual(toolDirs(env), [bin, nodeBin]);
    loadToolPath(env);
    loadToolPath(env);
    assert.equal(env.PATH, [bin, nodeBin, "/usr/bin"].join(path.delimiter));
  });

  it("honours PRODUCT_VIDEO_HOME and skips folders that do not exist", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "pv-tools-"));
    const env = { HOME: "/nowhere", PRODUCT_VIDEO_HOME: root, PATH: "/usr/bin" };
    assert.deepEqual(toolDirs(env), []);
    mkdirSync(path.join(root, "bin"));
    assert.equal(loadToolPath(env), [path.join(root, "bin"), "/usr/bin"].join(path.delimiter));
  });

  it("lets which() find a tool installed there", { skip: process.platform === "win32" }, () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "pv-tools-"));
    mkdirSync(path.join(root, "bin"));
    const ffmpeg = path.join(root, "bin", "ffmpeg");
    writeFileSync(ffmpeg, "#!/bin/sh\n");
    chmodSync(ffmpeg, 0o755);
    const env = { PRODUCT_VIDEO_HOME: root, PATH: "/nowhere" };
    assert.equal(which("ffmpeg", env), null);
    loadToolPath(env);
    assert.equal(which("ffmpeg", env), ffmpeg);
  });
});
