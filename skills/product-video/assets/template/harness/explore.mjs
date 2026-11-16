/**
 * Explores the web app and proposes what could be shown. It only follows links
 * (page loads on the app's own host); it never clicks a button or fills a form,
 * and the profile's guards, read-only mode included, stay on throughout.
 * Writes to log/explore/: a screenshot and accessibility snapshot per page,
 * pages.json, a contact sheet, and shot-list.md (a draft to refine with the person).
 * Pages showing text that looks like a name, an email address or a phone number are listed
 * as "check before use" against safety.mask. On a live or read-only app a form is only
 * ever suggested as a still of the empty form.
 *   node explore.mjs [--max 20] [--depth 2]
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { PROJECT_DIR } from "../lib/profile.mjs";
import { findPersonalData, isLookOnly, shotListMarkdown, suggestion } from "./explore-rules.mjs";
import { openContext, profile } from "./lib.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? Number(args[args.indexOf(name) + 1]) : fallback);
const MAX_PAGES = option("--max", 20);
const MAX_DEPTH = option("--depth", 2);
const OUT = path.join(PROJECT_DIR, "log", "explore");
/** Links that end a session or act on data are never followed, even as page loads. */
const SKIP = /log-?out|sign-?out|delete|remove|destroy|unsubscribe|cancel|revoke|impersonate|export|download|\.(pdf|zip|csv|xlsx?)$/i;
mkdirSync(OUT, { recursive: true });

/** Runs in the page: what is on it, and where its links go. */
function describePage() {
  const visible = (element) => {
    const box = element.getBoundingClientRect();
    return box.width > 4 && box.height > 4;
  };
  const count = (selector) => [...document.querySelectorAll(selector)].filter(visible).length;
  const text = (selector) => document.querySelector(selector)?.textContent?.replace(/\s+/g, " ").trim().slice(0, 90) ?? "";
  return {
    title: document.title.trim(),
    heading: text("h1") || text("h2"),
    tables: count("table"),
    charts: count("canvas, svg[class*=chart], [class*=chart] svg, [class*=recharts]"),
    forms: count("form"),
    inputs: count("input:not([type=hidden]), textarea, select"),
    buttons: [...document.querySelectorAll("button, [role=button]")].filter(visible).map((button) => button.textContent?.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 12),
    cards: count("[class*=card], article"),
    height: document.documentElement.scrollHeight,
    hasPassword: count("input[type=password]") > 0,
    links: [...document.querySelectorAll("a[href]")].filter(visible).map((link) => ({
      href: link.href,
      label: (link.textContent ?? link.getAttribute("aria-label") ?? "").replace(/\s+/g, " ").trim().slice(0, 60),
      inNav: Boolean(link.closest("nav, header, aside, [role=navigation]")),
    })),
  };
}

/** How much there is to show: data and visuals count for more than plain text. */
const richness = (page) => page.charts * 4 + page.tables * 3 + Math.min(page.cards, 8) + Math.min(page.inputs, 6) + (page.heading ? 1 : 0);

const LOOK_ONLY = isLookOnly(profile);

const origin = new URL(profile.web.baseUrl).origin;
const start = (profile.web.probePaths ?? ["/"]).map((probePath) => new URL(probePath, origin).href);
const queue = start.map((href) => ({ href, depth: 0, via: "start" }));
const seen = new Set(start.map((href) => href.split("#")[0]));
const pages = [];

const { browser, context, blocked } = await openContext({ viewport: profile.web.stillViewport, deviceScaleFactor: 1 });
const page = await context.newPage();
while (queue.length && pages.length < MAX_PAGES) {
  const { href, depth, via } = queue.shift();
  try {
    await page.goto(href, { waitUntil: "networkidle", timeout: 45000 }).catch(() => page.waitForLoadState("domcontentloaded"));
    await page.waitForTimeout(600);
    const landed = new URL(page.url());
    if (landed.origin !== origin) {
      console.log(`left the app (${landed.host}), skipped: ${href}`);
      continue;
    }
    const info = await page.evaluate(describePage);
    const name = String(pages.length + 1).padStart(2, "0") + "-" + (landed.pathname.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home");
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    const aria = await page.locator("body").ariaSnapshot();
    writeFileSync(path.join(OUT, `${name}.aria.txt`), aria);
    const { links, ...summary } = info;
    const personalData = findPersonalData(aria);
    pages.push({ name, path: landed.pathname + landed.search, via, depth, ...summary, score: richness(info), suggestion: suggestion(info, { lookOnly: LOOK_ONLY }), personalData });
    console.log(`${name}: ${info.heading || info.title} (score ${richness(info)})`);
    if (depth >= MAX_DEPTH) continue;
    // Navigation links first: they are the app's own map of what matters.
    for (const link of links.sort((a, b) => Number(b.inNav) - Number(a.inNav))) {
      const target = link.href.split("#")[0];
      if (!target.startsWith(origin) || seen.has(target) || SKIP.test(target) || SKIP.test(link.label)) continue;
      seen.add(target);
      queue.push({ href: target, depth: depth + 1, via: link.label || "link" });
    }
  } catch (error) {
    console.log(`FAILED ${href}: ${error.message.split("\n")[0]}`);
  }
}
await browser.close();

writeFileSync(path.join(OUT, "pages.json"), `${JSON.stringify({ origin, pages, blocked, notVisited: queue.map((item) => item.href) }, null, 2)}\n`);
if (pages.length) {
  const columns = Math.min(4, pages.length);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-pattern_type", "glob", "-i", path.join(OUT, "[0-9][0-9]-*.png"),
    "-vf", `scale=480:-2,tile=${columns}x${Math.ceil(pages.length / columns)}`, "-frames:v", "1", path.join(OUT, "sheet.jpg")]);
}
writeFileSync(
  path.join(OUT, "shot-list.md"),
  shotListMarkdown({ origin, pages, blocked, notVisited: queue.length, lookOnly: LOOK_ONLY, mask: profile.safety.mask }),
);
const toCheck = pages.filter((item) => item.personalData.length).length;
console.log(`\n${pages.length} page(s)${toCheck ? `, ${toCheck} to check before use (possible names, emails or phone numbers)` : ""}. Read log/explore/shot-list.md and look at log/explore/sheet.jpg.`);
