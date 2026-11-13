// Web probe: sign in, visit each path in web.probePaths (or the paths given on
// the command line), and save a screenshot plus an accessibility snapshot of
// each, so shot scripts can use the app's exact control names.
//   node probe-web.mjs [path ...]
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { PROJECT_DIR } from "../lib/profile.mjs";
import { openContext, profile } from "./lib.mjs";

const OUT = path.join(PROJECT_DIR, "log", "web-probe");
mkdirSync(OUT, { recursive: true });
const paths = process.argv.length > 2 ? process.argv.slice(2) : (profile.web.probePaths ?? ["/"]);

const { browser, context } = await openContext({ viewport: profile.web.viewport, deviceScaleFactor: 1 });
const page = await context.newPage();
for (const pagePath of paths) {
  const name = pagePath.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home";
  const startedAt = Date.now();
  try {
    await page.goto(pagePath, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    writeFileSync(path.join(OUT, `${name}.aria.txt`), await page.locator("body").ariaSnapshot());
    console.log(`${name}: ok (${((Date.now() - startedAt) / 1000).toFixed(1)}s) ${page.url()}`);
  } catch (error) {
    console.log(`${name}: FAILED ${error.message.split("\n")[0]}`);
  }
}
await browser.close();
