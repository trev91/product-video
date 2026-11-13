/**
 * Launches the browser the recorder drives: the installed Google Chrome when there is one,
 * otherwise Playwright's own Chromium (downloaded by new-project.sh when Chrome is missing).
 */
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const CHROME_APPS = ["/Applications/Google Chrome.app", path.join(os.homedir(), "Applications", "Google Chrome.app")];
/** Where Playwright's "chrome" channel looks on Linux (the google-chrome-stable package installs it here). */
const LINUX_CHROME = "/opt/google/chrome/chrome";

export function hasChrome() {
  if (process.platform === "darwin") return CHROME_APPS.some((app) => existsSync(app));
  if (process.platform === "linux") return existsSync(LINUX_CHROME);
  return true;
}

export function launchBrowser(options = {}) {
  return chromium.launch({ ...(hasChrome() ? { channel: "chrome" } : {}), ...options });
}
