/**
 * Launches the browser the recorder drives: the installed Google Chrome or Chromium when there is
 * one (see findChrome in tools.mjs, which honours PRODUCT_VIDEO_CHROME), otherwise Playwright's own
 * Chromium (downloaded by new-project.mjs when no browser is found).
 */
import { chromium } from "playwright";

import { findChrome } from "./tools.mjs";

export function launchBrowser(options = {}) {
  const executablePath = findChrome();
  return chromium.launch({ ...(executablePath ? { executablePath } : {}), ...options });
}
