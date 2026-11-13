/**
 * Web recorder: one recording per shot, with a drawn cursor (a ring in the
 * brand's accent colour that follows the pointer and pulses on click). Each
 * shot also writes a sidecar JSON of named markers (time + element box) so the
 * edit can place zooms and callouts without guessing coordinates.
 * Where it records, how it signs in and what it must not touch come from
 * profile.json (see lib/profile.mjs).
 */
import { mkdir, copyFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

import { launchBrowser } from "../lib/browser.mjs";
import { authContextOptions, installGuards, loadProfile, PROJECT_DIR, rgbTriplet, signIn } from "../lib/profile.mjs";

export const profile = loadProfile();
export const OUT_DIR = path.join(PROJECT_DIR, "raw", "web");
const VIEWPORT = profile.web.viewport;
const ACCENT = profile.brand.colors.accent;
const ACCENT_RGB = rgbTriplet(ACCENT);

const CURSOR_SCRIPT = `
(() => {
  if (window.__videoCursorInstalled) return;
  window.__videoCursorInstalled = true;
  const install = () => {
    if (!document.body) return requestAnimationFrame(install);
    const ring = document.createElement("div");
    ring.id = "__video_ring";
    Object.assign(ring.style, {
      position: "fixed", left: "-100px", top: "-100px", width: "56px", height: "56px",
      marginLeft: "-28px", marginTop: "-28px", borderRadius: "50%",
      border: "3px solid ${ACCENT}", background: "rgba(${ACCENT_RGB},0.4)",
      zIndex: "2147483646", pointerEvents: "none",
    });
    const cursor = document.createElement("div");
    cursor.id = "__video_cursor";
    cursor.innerHTML = '<svg width="26" height="30" viewBox="0 0 26 30">' +
      '<path d="M2 1 L2 24 L8 19 L12 28 L16 26 L12 17 L20 17 Z" ' +
      'fill="#111" stroke="#fff" stroke-width="1.8"/></svg>';
    Object.assign(cursor.style, {
      position: "fixed", left: "-100px", top: "-100px", zIndex: "2147483647",
      pointerEvents: "none", transform: "translate(-2px,-1px)",
      filter: "drop-shadow(0 1px 2px rgba(0,0,0,.4))",
    });
    document.body.appendChild(ring);
    document.body.appendChild(cursor);
    document.addEventListener("mousemove", (e) => {
      cursor.style.left = e.clientX + "px"; cursor.style.top = e.clientY + "px";
      ring.style.left = e.clientX + "px"; ring.style.top = e.clientY + "px";
    }, true);
    document.addEventListener("mousedown", (e) => {
      const pulse = document.createElement("div");
      Object.assign(pulse.style, {
        position: "fixed", left: e.clientX + "px", top: e.clientY + "px",
        zIndex: "2147483645", pointerEvents: "none",
        width: "40px", height: "40px", borderRadius: "50%",
        border: "3px solid ${ACCENT}", transform: "translate(-50%,-50%)",
        transition: "width .3s ease-out, height .3s ease-out, opacity .3s ease-out", opacity: "1",
      });
      document.body.appendChild(pulse);
      requestAnimationFrame(() => { pulse.style.width = "80px"; pulse.style.height = "80px"; pulse.style.opacity = "0"; });
      setTimeout(() => pulse.remove(), 400);
    }, true);
  };
  install();
})();
`;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class Shot {
  constructor(page, baseline) {
    this.page = page;
    this.baseline = baseline;
    this.markers = [];
    this.mouse = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 };
  }
  now() { return (Date.now() - this.baseline) / 1000; }
  /** Record a named moment, with the element's box when given, for the edit. */
  async mark(name, target = null) {
    let box = null;
    if (target) {
      const b = await target.boundingBox().catch(() => null);
      if (b) box = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
    }
    this.markers.push({ name, t: Math.round(this.now() * 100) / 100, box, mouse: { ...this.mouse } });
  }
  async pause(ms) { await this.page.waitForTimeout(ms); }
  /** Glide the cursor to a locator (or {x,y}) over ~0.9 s, then pause ~1 s before any click. */
  async moveTo(target, { offsetX = 0, offsetY = 0, ms = 900 } = {}) {
    let dest;
    if (target && typeof target === "object" && "x" in target) {
      dest = { x: target.x, y: target.y };
    } else {
      await target.scrollIntoViewIfNeeded();
      await this.pause(150);
      const box = await target.boundingBox();
      if (!box) throw new Error("moveTo: target has no bounding box");
      dest = { x: box.x + box.width / 2 + offsetX, y: box.y + box.height / 2 + offsetY };
    }
    const from = { ...this.mouse };
    const steps = Math.max(12, Math.round(ms / 16));
    for (let i = 1; i <= steps; i++) {
      const t = easeInOutCubic(i / steps);
      await this.page.mouse.move(from.x + (dest.x - from.x) * t, from.y + (dest.y - from.y) * t);
      await this.pause(16);
    }
    this.mouse = dest;
  }
  async hover(target, name, holdMs = 1500) {
    await this.moveTo(target);
    await this.mark(name, typeof target === "object" && "x" in target ? null : target);
    await this.pause(holdMs);
  }
  async click(target, name = null, opts = {}) {
    await this.moveTo(target, opts);
    await this.pause(1000);
    if (name) await this.mark(name, typeof target === "object" && "x" in target ? null : target);
    await this.page.mouse.down();
    await this.pause(90);
    await this.page.mouse.up();
    await this.pause(350);
  }
  async type(target, text, name = null, { delay = 48 } = {}) {
    await this.click(target, name);
    await this.page.keyboard.type(text, { delay });
    await this.pause(250);
  }
  async fill(target, value, name = null) {
    await this.moveTo(target);
    await this.pause(500);
    if (name) await this.mark(name, target);
    await target.fill(value);
    await this.pause(400);
  }
  async scroll(deltaY, { steps = 18 } = {}) {
    for (let i = 0; i < steps; i++) {
      await this.page.mouse.wheel(0, deltaY / steps);
      await this.pause(30);
    }
    await this.pause(300);
  }
}

/** Opens a guarded, signed-in browser context on the profile's web app. */
export async function openContext(options = {}) {
  const browser = await launchBrowser();
  const context = await browser.newContext({
    baseURL: profile.web.baseUrl,
    colorScheme: profile.web.colorScheme,
    ...authContextOptions(profile),
    ...options,
  });
  const { blocked, arm } = await installGuards(context, profile);
  if (profile.web.hideCss) {
    await context.addInitScript((css) => {
      const add = () => {
        if (!document.head) return requestAnimationFrame(add);
        const style = document.createElement("style");
        style.textContent = css;
        document.head.appendChild(style);
      };
      add();
    }, profile.web.hideCss);
  }
  await signIn(context, profile);
  arm();
  return { browser, context, blocked };
}

/** Record one web shot. `script(shot)` drives it; sign-in, capture and sidecar are handled here. */
export async function recordShot({ id, startPath = "/", script, take = 1 }) {
  await mkdir(OUT_DIR, { recursive: true });
  const { browser, context, blocked } = await openContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT_DIR, size: VIEWPORT },
  });
  await context.addInitScript(CURSOR_SCRIPT);

  const page = await context.newPage();
  const baseline = Date.now();
  const shot = new Shot(page, baseline);
  let error = null;
  try {
    await page.goto(startPath, { waitUntil: "networkidle" });
    await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);
    await shot.pause(2000); // 2 s handle before the action
    await shot.mark("start");
    await script(shot);
    await shot.mark("end");
    await shot.pause(2000);
  } catch (err) {
    error = err;
  } finally {
    const recordedMs = Date.now() - baseline;
    const video = page.video();
    await context.close();
    const rawPath = await video.path();
    const dest = path.join(OUT_DIR, `shot-${id}-take${take}.webm`);
    await copyFile(rawPath, dest);
    await unlink(rawPath).catch(() => {});
    await writeFile(
      path.join(OUT_DIR, `shot-${id}-take${take}.json`),
      JSON.stringify({ id, take, recordedMs, markers: shot.markers, blocked, error: error ? String(error.message) : null }, null, 2),
    );
    await browser.close();
    console.log(`[shot ${id} take ${take}] ${(recordedMs / 1000).toFixed(1)}s, ${shot.markers.length} markers${blocked.length ? `, ${blocked.length} blocked request(s)` : ""}${error ? " FAILED: " + error.message.split("\n")[0] : ""}`);
  }
  if (error) throw error;
}
