/**
 * Drafts profile.json from two URLs: a public website to take the brand from and the
 * web app to record. The app is treated as live, so the draft turns read-only mode on.
 * Writes profile.json and log/profile-draft.md (what was picked, why, and what to confirm).
 *   node lib/draft-profile.mjs <brand-url> <app-url>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { extractBrand } from "./brand-from-url.mjs";
import { launchBrowser } from "./browser.mjs";
import { PROJECT_DIR } from "./profile.mjs";

const [brandUrl, appUrl] = process.argv.slice(2);
if (!brandUrl || !appUrl) throw new Error("Usage: node lib/draft-profile.mjs <brand-url> <app-url>");

/** Loads the app once, without signing in, to see whether it asks for a login. */
async function inspectApp(url) {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 }).catch(() => page.waitForLoadState("domcontentloaded"));
    const asksForPassword = (await page.locator("input[type=password]").count()) > 0;
    const landed = new URL(page.url());
    const looksLikeLogin = /login|signin|sign-in|auth|sso/i.test(landed.pathname + landed.host);
    return { needsSignIn: asksForPassword || looksLikeLogin || landed.host !== new URL(url).host, landedOn: landed.href };
  } finally {
    await browser.close();
  }
}

const app = new URL(appUrl);
const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(app.hostname) || /\.(localhost|test|local)$/.test(app.hostname);
const draft = await extractBrand(brandUrl);
const inspected = await inspectApp(appUrl);

const profile = {
  $schema: "./lib/profile.schema.json",
  schemaVersion: 1,
  organization: { name: draft.product.name },
  product: draft.product,
  brand: draft.brand,
  web: {
    baseUrl: app.origin,
    probePaths: [app.pathname || "/"],
    auth: inspected.needsSignIn ? { type: "storageState", path: "auth/state.json" } : { type: "none" },
  },
  environment: {
    kind: isLocal ? "local" : "live",
    description: isLocal
      ? "A local copy of the app. Confirm whose data it holds and how it is reset."
      : "The live app, recorded in read-only mode: page loads and reads only. Confirm which account is used and that nothing in it is private.",
    allowedHosts: [app.host],
    forbiddenHosts: [],
  },
  safety: {
    readOnly: true,
    neverDo: ["submit, save, send, delete, buy or publish anything", "change a setting", "invite or message anyone"],
    mask: ["real names", "email addresses", "phone numbers", "account or payment numbers"],
  },
  narration: { mode: "silent" },
  music: { mode: "none", bpm: 120 },
  delivery: { handoff: "Send to the requester only. Never upload, post or commit the video." },
  decisions: [],
};
writeFileSync(path.join(PROJECT_DIR, "profile.json"), `${JSON.stringify(profile, null, 2)}\n`);

const { evidence, notes } = draft;
const report = `# Profile draft

Brand read from ${evidence.source}; app at ${app.origin}. Everything below is a draft to confirm with the person.

## Picked
- Product name: **${draft.product.name}** (page title: "${evidence.title}")
- Tagline: ${draft.product.tagline ? `"${draft.product.tagline}"` : "none found"}
- Accent ${draft.brand.colors.accent}, dark ${draft.brand.colors.dark}, light ${draft.brand.colors.light}
- Fonts: heading ${draft.brand.fonts.heading}, body ${draft.brand.fonts.body}
- Logo: ${draft.brand.logo ?? "none"}

## Evidence
- Accent candidates, strongest first:
${evidence.accentCandidates.map((color) => `  - ${color.hex} (${color.seenAs.join(", ")})`).join("\n") || "  - none"}
- Site heading fonts: ${evidence.siteHeadingFonts.join(", ") || "none"}
- Site body fonts: ${evidence.siteBodyFonts.join(", ") || "none"}
- Site description: ${evidence.description ?? "none"}

## Notes
${notes.map((note) => `- ${note}`).join("\n") || "- none"}

## The app
- Opening ${appUrl} landed on ${inspected.landedOn}.
- Sign-in: ${inspected.needsSignIn ? "needed. The person signs in once with `node harness/sign-in.mjs`; no password is handled by the recorder." : "not needed."}
- Environment: ${profile.environment.kind}, read-only mode ON. If a page stays empty because the app reads data with POST requests, check the blocked list in the recording sidecar and add only true reads to safety.readOnlyAllow.

## Confirm before recording
1. The product name, tagline, colours, fonts and logo above (look at gfx/logo.png).
2. Which account is recorded, and what in it must not be shown (extend safety.mask).
3. Anything else that must never happen (extend safety.neverDo).
4. Narration, music and who receives the video.
`;
mkdirSync(path.join(PROJECT_DIR, "log"), { recursive: true });
writeFileSync(path.join(PROJECT_DIR, "log", "profile-draft.md"), report);
console.log(report);
