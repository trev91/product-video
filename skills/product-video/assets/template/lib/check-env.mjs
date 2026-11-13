/**
 * Pre-flight for a recording session: validates the profile, confirms the web
 * app is on an allowed host, and reports whether each declared service answers.
 *   node lib/check-env.mjs
 */
import { loadProfile } from "./profile.mjs";

const profile = loadProfile();
const { environment } = profile;
console.log(`environment: ${environment.kind} - ${environment.description}`);
console.log(`allowed hosts: ${environment.allowedHosts.join(", ") || "none (nothing can be recorded; media is supplied)"}`);
if (environment.forbiddenHosts?.length) console.log(`forbidden hosts: ${environment.forbiddenHosts.join(", ")}`);
console.log(`read-only mode: ${profile.safety.readOnly ? "ON (writes are aborted after sign-in)" : "off"}`);

let down = 0;
for (const service of environment.services ?? []) {
  if (!service.readyUrl) {
    console.log(`  ${service.name}: no readyUrl to check (start with: ${service.command})`);
    continue;
  }
  const ok = await fetch(service.readyUrl, { redirect: "manual" })
    .then((response) => response.status < 400)
    .catch(() => false);
  if (!ok) down += 1;
  console.log(`  ${service.name}: ${ok ? "up" : `DOWN (start with: ${service.command}${service.cwd ? ` in ${service.cwd}` : ""})`}`);
}
console.log("never do:");
for (const rule of profile.safety.neverDo) console.log(`  - ${rule}`);
console.log("never readable on screen:");
for (const rule of profile.safety.mask) console.log(`  - ${rule}`);
process.exit(down ? 1 : 0);
