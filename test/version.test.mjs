import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const plugin = JSON.parse(read(".claude-plugin/plugin.json"));

const newer = (a, b) => {
  const [x, y] = [a, b].map((version) => version.split(".").map(Number));
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

it("the plugin version moved past 0.2.0, so claude plugin update sees a change", () => {
  assert.match(plugin.version, /^\d+\.\d+\.\d+$/);
  assert.ok(newer(plugin.version, "0.2.0"), `${plugin.version} is not newer than 0.2.0`);
});

it("the README Status section names the current version", () => {
  assert.match(read("README.md"), new RegExp(`^Version ${plugin.version.replace(/\./g, "\\.")}:`, "m"));
});

it("the marketplace entry does not pin an older version", () => {
  const marketplace = JSON.parse(read(".claude-plugin/marketplace.json"));
  for (const entry of marketplace.plugins) assert.ok(entry.version === undefined || entry.version === plugin.version);
});
