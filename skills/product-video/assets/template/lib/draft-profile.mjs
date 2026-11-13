/**
 * Drafts profile.json from a public website (the brand) and either the web app to record or,
 * with --media, no app at all: the video is then made from supplied screenshots and videos.
 * A recorded app is treated as live, so the draft turns read-only mode on.
 * Writes profile.json and log/profile-draft.md (what was picked, why, and what to confirm).
 *   node lib/draft-profile.mjs <brand-url> <app-url>
 *   node lib/draft-profile.mjs <brand-url> --media
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { extractBrand } from "./brand-from-url.mjs";
import { launchBrowser } from "./browser.mjs";
import { PROJECT_DIR } from "./profile.mjs";

const [brandUrl, appUrl] = process.argv.slice(2);
if (!brandUrl || !appUrl) throw new Error("Usage: node lib/draft-profile.mjs <brand-url> <app-url | --media>");
const mediaOnly = appUrl === "--media";

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

const app = mediaOnly ? null : new URL(appUrl);
const isLocal = app !== null && (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(app.hostname) || /\.(localhost|test|local)$/.test(app.hostname));
const draft = await extractBrand(brandUrl);
const inspected = mediaOnly ? null : await inspectApp(appUrl);

/** The parts of the profile that say where recording happens: an app, or nowhere. */
const recording = mediaOnly
  ? {
      environment: {
        kind: "supplied-media",
        description: "Nothing is recorded. The video is made from screenshots and videos the person supplies; confirm they may be shown.",
        allowedHosts: [],
      },
      neverDo: [],
    }
  : {
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
      neverDo: ["submit, save, send, delete, buy or publish anything", "change a setting", "invite or message anyone"],
    };

const profile = {
  $schema: "./lib/profile.schema.json",
  schemaVersion: 1,
  organization: { name: draft.product.name },
  product: draft.product,
  brand: draft.brand,
  ...(recording.web ? { web: recording.web } : {}),
  environment: recording.environment,
  safety: {
    readOnly: true,
    neverDo: recording.neverDo,
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

Brand read from ${evidence.source}; ${mediaOnly ? "no app is recorded (supplied screenshots and videos)" : `app at ${app.origin}`}. Everything below is a draft to confirm with the person.

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

${mediaOnly ? `## The media
- Nothing is recorded and no app is opened. Bring the person's screenshots and videos in with \`node lib/import-media.mjs <files or folder>\`.

## Confirm before editing
1. The product name, tagline, colours, fonts and logo above (look at gfx/logo.png).
2. That the person may show these screenshots and videos, and what in them must not be readable (extend safety.mask).
3. Narration, music and who receives the video.
` : `## The app
- Opening ${appUrl} landed on ${inspected.landedOn}.
- Sign-in: ${inspected.needsSignIn ? "needed. The person signs in once with \`node harness/sign-in.mjs\`; no password is handled by the recorder." : "not needed."}
- Environment: ${profile.environment.kind}, read-only mode ON. If a page stays empty because the app reads data with POST requests, check the blocked list in the recording sidecar and add only true reads to safety.readOnlyAllow.

## Confirm before recording
1. The product name, tagline, colours, fonts and logo above (look at gfx/logo.png).
2. Which account is recorded, and what in it must not be shown (extend safety.mask).
3. Anything else that must never happen (extend safety.neverDo).
4. Narration, music and who receives the video.
`}`;
mkdirSync(path.join(PROJECT_DIR, "log"), { recursive: true });
writeFileSync(path.join(PROJECT_DIR, "log", "profile-draft.md"), report);
console.log(report);
