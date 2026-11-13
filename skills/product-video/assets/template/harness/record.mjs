/**
 * Record web shots by id: node record.mjs 01-3 03-1 ... [--take 2]
 * Needs the profile's environment running (node ../lib/check-env.mjs).
 */
import { recordShot } from "./lib.mjs";
import { shots } from "./shots-web.mjs";
import { appendFileSync } from "node:fs";

const args = process.argv.slice(2);
const takeIndex = args.indexOf("--take");
const take = takeIndex >= 0 ? Number(args[takeIndex + 1]) : 1;
const ids = args.filter((a, i) => a !== "--take" && (takeIndex < 0 || i !== takeIndex + 1));
const selected = ids.length ? ids : Object.keys(shots);
const LOG = new URL("../log/recording-log.txt", import.meta.url).pathname;

const failures = [];
for (const id of selected) {
  const shot = shots[id];
  if (!shot) throw new Error(`Unknown shot ${id}`);
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  try {
    await recordShot({ id, take, startPath: shot.startPath, script: shot.script });
    appendFileSync(LOG, `${stamp}  web shot ${id} take ${take}: recorded -> raw/web/shot-${id}-take${take}.webm\n`);
  } catch (err) {
    failures.push(id);
    appendFileSync(LOG, `${stamp}  web shot ${id} take ${take}: FAILED (${String(err.message).split("\n")[0]})\n`);
  }
}
if (failures.length) {
  console.error("Failed:", failures.join(", "));
  process.exit(1);
}
