/**
 * Finds the tools the pipeline runs (node, ffmpeg, ffprobe, Chrome) without a shell.
 * Importing this module puts ~/.product-video/bin (and the Node that setup installed there)
 * at the front of PATH for this process and everything it starts, so no script needs
 * `source ~/.product-video/env.sh` first. It has no dependencies, so it works before
 * `npm install` (scripts/setup.mjs and scripts/new-project.mjs use it too).
 */
import { spawnSync } from "node:child_process";
import { accessSync, constants, existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/** Where setup installs its tools: $PRODUCT_VIDEO_HOME, else ~/.product-video. */
export function productVideoHome(env = process.env) {
  return env.PRODUCT_VIDEO_HOME || path.join(env.HOME || os.homedir(), ".product-video");
}

/** The Node folder setup installed (tools/node-*), the last one by name, or null. */
export function installedNodeBin(env = process.env) {
  const tools = path.join(productVideoHome(env), "tools");
  if (!existsSync(tools)) return null;
  const names = readdirSync(tools).filter((entry) => entry.startsWith("node-")).sort();
  const bins = names.map((name) => path.join(tools, name, "bin")).filter((dir) => existsSync(path.join(dir, "node")));
  return bins.at(-1) ?? null;
}

/** The folders setup installs into that exist: bin/ first, then its Node (the same order as env.sh). */
export function toolDirs(env = process.env) {
  return [path.join(productVideoHome(env), "bin"), installedNodeBin(env)].filter((dir) => dir && existsSync(dir));
}

/** Prepends the setup folders to env.PATH (each once) and returns the new PATH. */
export function loadToolPath(env = process.env) {
  const current = (env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const add = toolDirs(env).filter((dir) => !current.includes(dir));
  env.PATH = [...add, ...current].join(path.delimiter);
  return env.PATH;
}

function isExecutable(file) {
  try {
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** The full path of a command on PATH, or null. */
export function which(name, env = process.env) {
  const extensions = process.platform === "win32" ? ["", ".exe", ".cmd"] : [""];
  for (const dir of (env.PATH ?? "").split(path.delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      const candidate = path.join(dir, name + extension);
      if (isExecutable(candidate)) return candidate;
    }
  }
  return null;
}

/** Commands that start Google Chrome or Chromium on Linux, in order of preference. */
export const LINUX_CHROME_COMMANDS = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"];
/** Fixed install locations tried on Linux when none of the commands is on PATH. */
export const LINUX_CHROME_PATHS = [
  "/opt/google/chrome/chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
];

/**
 * The Chrome or Chromium the recorder (and, where it works, the renderer) should use, or null
 * when there is none and Playwright's own Chromium is needed.
 * Order: $PRODUCT_VIDEO_CHROME; on macOS the Google Chrome app; on Linux /opt/google/chrome/chrome,
 * then google-chrome, google-chrome-stable, chromium and chromium-browser on PATH, then the usual
 * fixed paths (Snap's /snap/bin/chromium last).
 * Flatpak installs are not tried: their launchers start a sandbox that Playwright cannot drive.
 * Point PRODUCT_VIDEO_CHROME at the real binary instead.
 */
export function findChrome({ env = process.env, platform = process.platform, exists = isExecutable } = {}) {
  const override = env.PRODUCT_VIDEO_CHROME;
  if (override) {
    if (exists(override)) return override;
    throw new Error(`PRODUCT_VIDEO_CHROME is set to ${override}, which is not an executable file.`);
  }
  const home = env.HOME || os.homedir();
  if (platform === "darwin") {
    const binary = "Contents/MacOS/Google Chrome";
    return [path.join("/Applications/Google Chrome.app", binary), path.join(home, "Applications/Google Chrome.app", binary)]
      .find((candidate) => exists(candidate)) ?? null;
  }
  if (platform === "linux") {
    // Where the google-chrome-stable package puts the real binary (what Playwright's "chrome" channel runs).
    if (exists(LINUX_CHROME_PATHS[0])) return LINUX_CHROME_PATHS[0];
    for (const command of LINUX_CHROME_COMMANDS) {
      for (const dir of (env.PATH ?? "").split(path.delimiter).filter(Boolean)) {
        const candidate = path.join(dir, command);
        if (exists(candidate)) return candidate;
      }
    }
    return LINUX_CHROME_PATHS.find((candidate) => exists(candidate)) ?? null;
  }
  if (platform === "win32") {
    const roots = [env.PROGRAMFILES, env["PROGRAMFILES(X86)"], env.LOCALAPPDATA].filter(Boolean);
    return roots.map((root) => path.join(root, "Google/Chrome/Application/chrome.exe")).find((candidate) => exists(candidate)) ?? null;
  }
  return null;
}

/**
 * The browser Remotion renders with. By default Remotion downloads its own Chrome Headless Shell
 * (about 100 MB) on the first render. On Linux, where it has been tried, an installed Chrome or
 * Chromium is used instead, in Remotion's "chrome-for-testing" mode (a full Chrome needs
 * --headless=new; the default mode passes --headless=old, which Chrome 132 and later removed).
 * PRODUCT_VIDEO_REMOTION_BROWSER=system uses the installed browser on any system;
 * PRODUCT_VIDEO_REMOTION_BROWSER=bundled always uses Remotion's own download.
 * Returns null for Remotion's default, else { browserExecutable, chromeMode }.
 */
export function remotionBrowser({ env = process.env, platform = process.platform, exists = isExecutable } = {}) {
  const choice = env.PRODUCT_VIDEO_REMOTION_BROWSER ?? (platform === "linux" ? "system" : "bundled");
  if (choice === "bundled") return null;
  if (choice !== "system") throw new Error(`PRODUCT_VIDEO_REMOTION_BROWSER must be "system" or "bundled", not "${choice}".`);
  const browserExecutable = findChrome({ env, platform, exists });
  return browserExecutable ? { browserExecutable, chromeMode: "chrome-for-testing" } : null;
}

/** remotionBrowser() as `npx remotion render` flags. */
export function remotionBrowserArgs(options) {
  const browser = remotionBrowser(options);
  return browser ? [`--browser-executable=${browser.browserExecutable}`, `--chrome-mode=${browser.chromeMode}`] : [];
}

/**
 * Runs a command with its output shown, and throws if it fails.
 * `quiet` hides the output unless the command fails.
 */
export function run(command, args, { cwd, quiet = false, env = process.env } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: quiet ? ["ignore", "pipe", "pipe"] : "inherit",
    shell: process.platform === "win32",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw new Error(`${command} could not start: ${result.error.message}`);
  if (result.status !== 0) {
    const output = quiet ? `\n${String(result.stdout ?? "")}${String(result.stderr ?? "")}`.trimEnd() : "";
    throw new Error(`${command} ${args.join(" ")} failed (exit ${result.status})${output}`);
  }
}

/** Runs a command and returns its standard output as text. */
export function capture(command, args, { cwd, env = process.env } = {}) {
  const result = spawnSync(command, args, { cwd, env, encoding: "utf8", shell: process.platform === "win32", maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw new Error(`${command} could not start: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed (exit ${result.status})\n${result.stderr}`);
  return result.stdout;
}

/** "12.3 MB" for a byte count. */
export function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

loadToolPath();
