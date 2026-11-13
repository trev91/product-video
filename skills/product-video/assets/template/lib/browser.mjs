/**
 * Launches the browser the recorder drives: the installed Google Chrome when there is one,
 * otherwise Playwright's own Chromium (downloaded by new-project.sh when Chrome is missing).
 */
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const CHROME_APPS = ["/Applications/Google Chrome.app", path.join(os.homedir(), "Applications", "Google Chrome.app")];

export const hasChrome = () => process.platform !== "darwin" || CHROME_APPS.some((app) => existsSync(app));

export function launchBrowser(options = {}) {
  return chromium.launch({ ...(hasChrome() ? { channel: "chrome" } : {}), ...options });
}
