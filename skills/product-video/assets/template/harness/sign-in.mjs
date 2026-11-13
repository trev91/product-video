/**
 * Lets a person sign in to the web app themselves, and saves that session for the recorder.
 * Opens a visible Chrome window on the app; the person signs in (SSO and MFA included) and
 * closes the window. The session is saved to the profile's web.auth.path while the window is
 * open. No password is typed, read or stored by this script.
 *   node sign-in.mjs
 */
import { mkdirSync } from "node:fs";
import path from "node:path";

import { launchBrowser } from "../lib/browser.mjs";
import { loadProfile, PROJECT_DIR } from "../lib/profile.mjs";

const profile = loadProfile();
const { auth, baseUrl } = profile.web;
if (auth.type !== "storageState") throw new Error('web.auth.type must be "storageState" to save a sign-in.');
const statePath = path.resolve(PROJECT_DIR, auth.path);
mkdirSync(path.dirname(statePath), { recursive: true });
const MAX_MINUTES = 15;

const browser = await launchBrowser({ headless: false });
const context = await browser.newContext({ viewport: null });
const page = await context.newPage();
await page.goto(baseUrl);
console.log(`A browser window is open on ${baseUrl}. Sign in there, then close the window.`);

let saves = 0;
const deadline = Date.now() + MAX_MINUTES * 60_000;
while (browser.isConnected() && context.pages().length > 0 && Date.now() < deadline) {
  await context.storageState({ path: statePath }).then(() => { saves += 1; }).catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 1500));
}
await browser.close().catch(() => {});
if (!saves) throw new Error("The window closed before a session could be saved.");
console.log(`Session saved to ${auth.path} (git-ignored). Check it with: node probe-web.mjs`);
