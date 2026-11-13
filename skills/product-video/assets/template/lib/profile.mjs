/**
 * Loads and validates the organization profile (profile.json at the project
 * root) and holds the safety checks every recorder runs before it opens a page.
 */
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PROJECT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROFILE_PATH = path.join(PROJECT_DIR, "profile.json");
const SCHEMA_PATH = path.join(PROJECT_DIR, "lib", "profile.schema.json");

const DEFAULTS = {
  viewport: { width: 1920, height: 1080 },
  stillViewport: { width: 1440, height: 900 },
  stage: "#060706",
  bpm: 120,
  delivery: { loudnessLufs: -16 },
};

/** Reads profile.json, validates it against the schema and fills in the defaults. */
export function loadProfile() {
  const profile = JSON.parse(readFileSync(PROFILE_PATH, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(JSON.parse(readFileSync(SCHEMA_PATH, "utf8")));
  if (!validate(profile)) {
    const problems = validate.errors.map((e) => `  ${e.instancePath || "/"} ${e.message}`).join("\n");
    throw new Error(`profile.json is not valid:\n${problems}`);
  }
  profile.brand.colors.stage ??= DEFAULTS.stage;
  profile.product.windowTitle ??= profile.product.name;
  profile.music ??= { mode: "none" };
  profile.music.bpm ??= DEFAULTS.bpm;
  profile.narration ??= { mode: "silent" };
  profile.delivery = { ...DEFAULTS.delivery, ...profile.delivery };
  if (profile.web) {
    profile.web.viewport ??= DEFAULTS.viewport;
    profile.web.stillViewport ??= DEFAULTS.stillViewport;
    profile.web.colorScheme ??= "light";
    assertAllowed(profile, profile.web.baseUrl);
  }
  return profile;
}

/** Throws unless the URL's host is one the profile allows and none it forbids. */
export function assertAllowed(profile, url) {
  const host = new URL(url).host;
  const { allowedHosts, forbiddenHosts = [] } = profile.environment;
  if (forbiddenHosts.includes(host)) {
    throw new Error(`Refusing to record: ${host} is listed in environment.forbiddenHosts.`);
  }
  if (!allowedHosts.includes(host)) {
    throw new Error(`Refusing to record: ${host} is not in environment.allowedHosts (${allowedHosts.join(", ")}).`);
  }
}

const READS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Turns a glob such as "**\/api/search" into a pattern for a whole URL. */
function globPattern(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*");
  return new RegExp(`^${escaped.replace(/\u0000/g, ".*").replace(/\?/g, ".")}$`);
}

/**
 * Aborts requests to forbidden hosts, any request matching safety.blockRequests and,
 * in read-only mode, every request that is not a read. Read-only blocking starts when
 * the returned `arm()` is called, so that signing in (often a POST) still works.
 */
export async function installGuards(context, profile) {
  const blocked = [];
  const abort = (route) => {
    blocked.push(`${route.request().method()} ${route.request().url()}`);
    return route.abort("blockedbyclient");
  };
  let armed = false;
  if (profile.safety.readOnly) {
    const allow = (profile.safety.readOnlyAllow ?? []).map((rule) => ({ method: rule.method, pattern: globPattern(rule.url) }));
    await context.route("**/*", (route) => {
      const request = route.request();
      if (!armed || READS.has(request.method())) return route.fallback();
      const allowed = allow.some((rule) => (!rule.method || rule.method === request.method()) && rule.pattern.test(request.url()));
      return allowed ? route.fallback() : abort(route);
    });
  }
  for (const host of profile.environment.forbiddenHosts ?? []) {
    await context.route((url) => url.host === host, abort);
  }
  for (const rule of profile.safety.blockRequests ?? []) {
    await context.route(rule.url, (route) => (rule.method && route.request().method() !== rule.method ? route.fallback() : abort(route)));
  }
  return { blocked, arm: () => { armed = true; } };
}

/** Replaces "env:NAME" with that environment variable; the value itself is never logged. */
function fromEnv(value) {
  if (!value.startsWith("env:")) return value;
  const name = value.slice(4);
  const resolved = process.env[name];
  if (!resolved) throw new Error(`Set the ${name} environment variable before recording.`);
  return resolved;
}

/** Playwright context options for the profile's sign-in method. */
export function authContextOptions(profile) {
  const { auth } = profile.web;
  if (auth.type !== "storageState") return {};
  const file = path.resolve(PROJECT_DIR, auth.path);
  if (!existsSync(file)) throw new Error(`No saved sign-in at ${auth.path}. Run: node harness/sign-in.mjs`);
  return { storageState: file };
}

/** Signs the context in as the profile describes. Call it after installGuards. */
export async function signIn(context, profile) {
  const { auth, baseUrl } = profile.web;
  if (auth.type === "none" || auth.type === "storageState") return;
  if (auth.type === "request") {
    const body = Object.fromEntries(Object.entries(auth.body).map(([key, value]) => [key, fromEnv(value)]));
    const response = await context.request.post(new URL(auth.url, baseUrl).href, { data: body });
    if (!response.ok()) throw new Error(`Sign-in failed: ${response.status()}`);
    return;
  }
  const page = await context.newPage();
  await page.goto(new URL(auth.path, baseUrl).href, { waitUntil: "networkidle" });
  for (const field of auth.fields) {
    await page.getByLabel(field.label, { exact: false }).first().fill(fromEnv(`env:${field.env}`));
  }
  await page.getByRole("button", { name: auth.submit }).first().click();
  if (auth.waitFor) await page.waitForURL(`**${auth.waitFor}`);
  else await page.waitForLoadState("networkidle");
  await page.close();
}

/** "#3B82F6" -> "59,130,246", for rgba() strings. */
export function rgbTriplet(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return `${(value >> 16) & 255},${(value >> 8) & 255},${value & 255}`;
}
