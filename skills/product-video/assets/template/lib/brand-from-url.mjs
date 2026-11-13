/**
 * Drafts a brand from a public website: name, tagline, colours, fonts and logo.
 * It only loads the page and reads it; nothing is clicked or submitted.
 * The result is a draft with the evidence behind each pick, for a person to confirm.
 *   import { extractBrand } from "./brand-from-url.mjs"
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { launchBrowser } from "./browser.mjs";
import { PROJECT_DIR } from "./profile.mjs";

const FALLBACK = { accent: "#3B82F6", dark: "#1F2937", light: "#FFFFFF", font: "Inter" };
const GENERIC_FONTS = /^(serif|sans-serif|monospace|system-ui|ui-sans-serif|ui-serif|ui-monospace|cursive|fantasy|inherit|-apple-system|blinkmacsystemfont|segoe ui|arial|helvetica|helvetica neue|times new roman|times|georgia|verdana|tahoma|roboto mono|courier new)$/i;

/** Runs in the page: collects what the site shows, without judging it. */
function readPage() {
  const toHex = (color) => {
    const match = /rgba?\(([^)]+)\)/.exec(color);
    if (!match) return null;
    const [r, g, b, a = "1"] = match[1].split(/[,/ ]+/).filter(Boolean);
    if (Number(a) < 0.5) return null;
    return `#${[r, g, b].map((value) => Math.round(Number(value)).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
  };
  const visible = (element) => {
    const box = element.getBoundingClientRect();
    return box.width > 4 && box.height > 4 && getComputedStyle(element).visibility !== "hidden";
  };
  const meta = (selector) => document.querySelector(selector)?.getAttribute("content")?.trim() || null;
  const firstFamily = (element) =>
    element ? getComputedStyle(element).fontFamily.split(",").map((name) => name.trim().replace(/^["']|["']$/g, "")) : [];

  const tally = new Map();
  const count = (hex, source, weight) => {
    if (!hex) return;
    const entry = tally.get(hex) ?? { hex, weight: 0, sources: new Set() };
    entry.weight += weight;
    entry.sources.add(source);
    tally.set(hex, entry);
  };
  for (const element of document.querySelectorAll("button, [role=button], a[class*=btn], a[class*=button], input[type=submit]")) {
    if (visible(element)) count(toHex(getComputedStyle(element).backgroundColor), "button background", 5);
  }
  for (const element of [...document.querySelectorAll("a")].slice(0, 200)) {
    if (visible(element)) count(toHex(getComputedStyle(element).color), "link colour", 1);
  }
  for (const element of [...document.querySelectorAll("svg, [class*=icon], [class*=badge], [class*=accent], [class*=primary]")].slice(0, 200)) {
    if (!visible(element)) continue;
    count(toHex(getComputedStyle(element).color), "icon or accent element", 1);
    count(toHex(getComputedStyle(element).backgroundColor), "accent element background", 2);
  }
  const rootStyle = getComputedStyle(document.documentElement);
  for (const name of [...document.styleSheets].flatMap((sheet) => {
    try {
      return [...sheet.cssRules].flatMap((rule) => (rule.style ? [...rule.style].filter((property) => property.startsWith("--")) : []));
    } catch {
      return []; // cross-origin stylesheet
    }
  })) {
    if (!/(primary|brand|accent)/i.test(name)) continue;
    const probe = document.createElement("span");
    probe.style.color = rootStyle.getPropertyValue(name).trim();
    document.body.appendChild(probe);
    count(toHex(getComputedStyle(probe).color), `CSS variable ${name}`, 6);
    probe.remove();
  }
  const themeProbe = document.createElement("span");
  themeProbe.style.color = meta("meta[name=theme-color]") ?? "";
  document.body.appendChild(themeProbe);
  if (themeProbe.style.color) count(toHex(getComputedStyle(themeProbe).color), "theme-color tag", 3);
  themeProbe.remove();

  const header = document.querySelector("header, nav, [role=banner]");
  const logoCandidates = [...document.querySelectorAll("header img, header svg, nav img, nav svg, [role=banner] img, [role=banner] svg, a[href='/'] img, a[href='/'] svg, img, svg")]
    .filter(visible)
    .map((element, index) => {
      const box = element.getBoundingClientRect();
      const label = `${element.getAttribute("alt") ?? ""} ${element.getAttribute("class") ?? ""} ${element.id} ${element.getAttribute("src") ?? ""} ${element.getAttribute("aria-label") ?? ""} ${element.closest("a")?.getAttribute("aria-label") ?? ""}`;
      let score = 0;
      if (/logo|brand|wordmark/i.test(label)) score += 6;
      if (element.closest("header, nav, [role=banner]")) score += 3;
      if (element.closest("a[href='/'], a[href='./'], a[href='" + location.origin + "/']")) score += 3;
      if (box.top < 160) score += 2;
      if (box.width < 24 || box.height < 12 || box.width > 600) score -= 5;
      element.setAttribute("data-video-logo-candidate", String(index));
      const isImage = element.tagName === "IMG";
      return {
        index,
        score,
        width: Math.round(box.width),
        height: Math.round(box.height),
        src: isImage ? element.currentSrc || element.src : null,
        // An inline SVG is carried as markup, with the colour it inherits made explicit.
        markup: isImage ? null : element.outerHTML.replace(/^<svg/, `<svg style="color:${getComputedStyle(element).color}"`),
      };
    })
    .sort((a, b) => b.score - a.score);

  const heading = document.querySelector("h1, h2");
  return {
    title: document.title.trim(),
    siteName: meta("meta[property='og:site_name']") ?? meta("meta[name='application-name']"),
    description: meta("meta[property='og:description']") ?? meta("meta[name=description]"),
    headline: heading?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    colors: [...tally.values()].map((entry) => ({ ...entry, sources: [...entry.sources] })),
    textColor: toHex(getComputedStyle(heading ?? document.body).color),
    pageBackground: toHex(getComputedStyle(document.body).backgroundColor) ?? toHex(getComputedStyle(document.documentElement).backgroundColor),
    headerBackground: header ? toHex(getComputedStyle(header).backgroundColor) : null,
    headingFonts: firstFamily(heading),
    bodyFonts: firstFamily(document.querySelector("p") ?? document.body),
    logo: logoCandidates[0] && logoCandidates[0].score >= 5 ? logoCandidates[0] : null,
  };
}

function channels(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => channel / 255);
}
const luminance = (hex) => {
  const [r, g, b] = channels(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const saturation = (hex) => {
  const [r, g, b] = channels(hex);
  const max = Math.max(r, g, b);
  return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
};

/** The product name: the site's own name tag, else the part of the title that matches the domain. */
function productName(page, url) {
  if (page.siteName) return page.siteName;
  const parts = page.title.split(/\s+[|–—·:-]\s+/).map((part) => part.trim()).filter(Boolean);
  const label = new URL(url).hostname.replace(/^www\./, "").split(".")[0].toLowerCase();
  const matching = parts.find((part) => part.toLowerCase().replace(/[^a-z0-9]/g, "").includes(label.replace(/[^a-z0-9]/g, "")));
  // Without a match, the shortest part: a name is shorter than the tagline beside it.
  return matching ?? [...parts].sort((a, b) => a.length - b.length)[0] ?? label;
}

/** @font-face rules found in the stylesheets the page loaded, with absolute file URLs. */
function fontFaces(stylesheets) {
  const faces = [];
  for (const { url, text } of stylesheets) {
    for (const block of text.match(/@font-face\s*{[^}]*}/g) ?? []) {
      const family = /font-family:\s*["']?([^;"'}]+)["']?/i.exec(block)?.[1].trim();
      const weight = /font-weight:\s*([^;}]+)/i.exec(block)?.[1].trim() ?? "400";
      const italic = /font-style:\s*italic/i.test(block);
      const sources = [...block.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)(?:\s*format\(\s*["']?([^"')]+)["']?\s*\))?/g)];
      const kind = (source) => `${source[1]} ${source[2] ?? ""}`;
      const best = sources.find((source) => /woff2/.test(kind(source))) ?? sources.find((source) => /woff|ttf|otf|truetype|opentype/.test(kind(source)));
      if (family && best && !italic && !best[1].startsWith("data:")) faces.push({ family, weight, file: new URL(best[1], url).href });
    }
  }
  return faces;
}

/**
 * Chooses a usable font: a Google Fonts family by name when the edit can load it,
 * else the site's own font files, else the fallback.
 */
async function chooseFont(role, families, wantedWeights, faces, context, notes) {
  const candidates = families.filter((name) => !GENERIC_FONTS.test(name));
  const googleDir = path.join(PROJECT_DIR, "edit", "node_modules", "@remotion", "google-fonts", "dist", "cjs");
  for (const family of candidates) {
    if (existsSync(path.join(googleDir, `${family.replace(/\s+/g, "")}.js`))) return { family, files: [] };
  }
  for (const family of candidates) {
    const own = faces.filter((face) => face.family.toLowerCase() === family.toLowerCase());
    if (!own.length) continue;
    const files = [];
    const fontDir = path.join(PROJECT_DIR, "gfx", "fonts");
    mkdirSync(fontDir, { recursive: true });
    for (const weight of wantedWeights) {
      // A variable font declares a range ("100 900"); it serves every weight in it.
      const face = own.find((candidate) => {
        const [low, high = low] = candidate.weight.split(/\s+/).map(Number);
        return Number(weight) >= low && Number(weight) <= high;
      }) ?? own.find((candidate) => candidate.weight === "normal" && weight === "400") ?? own.find((candidate) => candidate.weight === "bold" && weight === "700");
      if (!face) continue;
      const response = await context.request.get(face.file);
      if (!response.ok()) continue;
      const extension = path.extname(new URL(face.file).pathname) || ".woff2";
      const target = `gfx/fonts/${family.replace(/\s+/g, "")}-${weight}${extension}`;
      writeFileSync(path.join(PROJECT_DIR, target), await response.body());
      files.push({ family, path: target, weight });
    }
    if (files.length) {
      notes.push(`${role} font "${family}" is not on Google Fonts: its files were downloaded from the site. Confirm the organization's licence covers video.`);
      return { family, files };
    }
  }
  notes.push(`${role} font: none of [${candidates.join(", ") || "system fonts only"}] could be loaded; using ${FALLBACK.font}.`);
  return { family: FALLBACK.font, files: [] };
}

/**
 * Saves the logo with a transparent background: the original file for a raster image,
 * otherwise the SVG drawn on its own on an empty page (a screenshot in place would
 * carry the header's background into the cards).
 */
async function saveLogo(context, logo) {
  const gfx = path.join(PROJECT_DIR, "gfx");
  mkdirSync(gfx, { recursive: true });
  const extension = logo.src ? path.extname(new URL(logo.src).pathname).toLowerCase() : "";
  if (logo.src && [".png", ".webp", ".gif", ".avif"].includes(extension)) {
    const response = await context.request.get(logo.src);
    if (response.ok()) {
      writeFileSync(path.join(gfx, `logo${extension}`), await response.body());
      return `gfx/logo${extension}`;
    }
  }
  const sheet = await context.newPage();
  const size = `width:${logo.width}px;height:${logo.height}px`;
  const content = logo.src ? `<img id="logo" src="${logo.src}" style="${size}">` : `<div id="logo" style="${size};display:inline-block">${logo.markup}</div>`;
  await sheet.setContent(`<html><body style="margin:0;background:transparent">${content}</body></html>`, { waitUntil: "networkidle" });
  await sheet.locator("#logo").screenshot({ path: path.join(gfx, "logo.png"), omitBackground: true });
  await sheet.close();
  return "gfx/logo.png";
}

/** Opens the site and returns a draft brand plus the evidence for each choice. */
export async function extractBrand(url) {
  const notes = [];
  const browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 });
  const stylesheets = [];
  context.on("response", async (response) => {
    if (response.request().resourceType() !== "stylesheet") return;
    const text = await response.text().catch(() => "");
    stylesheets.push({ url: response.url(), text });
  });
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 }).catch(() => page.waitForLoadState("domcontentloaded"));
    await page.waitForTimeout(800);
    const read = await page.evaluate(readPage);
    const inline = await page.evaluate(() => [...document.querySelectorAll("style")].map((style) => style.textContent ?? "").join("\n"));
    stylesheets.push({ url: page.url(), text: inline });

    const ranked = read.colors
      .filter((color) => saturation(color.hex) > 0.3 && luminance(color.hex) > 0.12 && luminance(color.hex) < 0.9)
      .sort((a, b) => b.weight - a.weight);
    const accent = ranked[0]?.hex ?? FALLBACK.accent;
    if (!ranked.length) notes.push(`No saturated brand colour found; accent falls back to ${FALLBACK.accent}.`);
    const dark = read.textColor && luminance(read.textColor) < 0.3 ? read.textColor : FALLBACK.dark;
    const light = read.pageBackground && luminance(read.pageBackground) > 0.85 ? read.pageBackground : FALLBACK.light;

    let logo = null;
    if (read.logo) {
      logo = await saveLogo(context, read.logo);
      const backdrop = read.headerBackground ?? read.pageBackground;
      if (backdrop && luminance(backdrop) < 0.4) notes.push(`The logo sits on a dark header: it may be light-coloured and vanish on the light cards. Look at ${logo} and supply a dark version if so.`);
    } else {
      notes.push("No logo element found: cards will show the product name as text. Supply a logo file if there is one.");
    }

    const faces = fontFaces(stylesheets);
    const heading = await chooseFont("Heading", read.headingFonts, ["600", "700"], faces, context, notes);
    const body = await chooseFont("Body", read.bodyFonts, ["400", "500", "600"], faces, context, notes);
    const name = productName(read, url);
    const tagline = read.headline && read.headline.length <= 48 ? read.headline : "";
    if (!tagline) notes.push("No short headline found for the tagline: write one (under 48 characters).");

    return {
      product: { name, ...(tagline ? { tagline } : {}) },
      brand: {
        colors: { accent, dark, light },
        fonts: { heading: heading.family, body: body.family },
        ...(heading.files.length || body.files.length ? { fontFiles: [...heading.files, ...body.files.filter((file) => !heading.files.some((other) => other.path === file.path))] } : {}),
        ...(logo ? { logo } : {}),
      },
      evidence: {
        source: page.url(),
        accentCandidates: ranked.slice(0, 5).map((color) => ({ hex: color.hex, seenAs: color.sources })),
        siteHeadingFonts: read.headingFonts,
        siteBodyFonts: read.bodyFonts,
        title: read.title,
        description: read.description,
      },
      notes,
    };
  } finally {
    await browser.close();
  }
}
