/**
 * Web shots, one entry per shot id, recorded with `node record.mjs <id> ...`.
 * Each script drives the app; `s.mark(name, locator)` records a moment and the
 * element's box so edit/shots.json can place zooms and callouts by name
 * ({ "atMarker": "new" }) instead of pixels.
 * Pace: move slowly and pause about 1 s before each click (s.click and s.hover
 * already do); the recorder adds 2 s handles at both ends.
 * Read the control names from the probe (node probe-web.mjs) before writing a shot,
 * and never script an action the profile's safety.neverDo forbids.
 */

/** A navigation link by its accessible name. */
export function navLink(s, name) {
  return s.page.getByRole("navigation").getByRole("link", { name, exact: true }).first();
}
/** A labelled form field (labels like "Title *" match on the prefix). */
export function field(s, label) {
  return s.page.getByLabel(label, { exact: false }).first();
}
/** A link-or-button action such as "New item". */
export function action(s, name) {
  return s.page.getByRole("link", { name }).or(s.page.getByRole("button", { name })).first();
}
/** A table row, optionally narrowed by text. */
export function row(s, hasText) {
  const rows = s.page.locator("main table tbody tr");
  return (hasText ? rows.filter({ hasText }) : rows).first();
}
/** A switch by its accessible name. */
export function toggle(s, name) {
  return s.page.getByRole("switch", { name, exact: false }).first();
}
export async function settle(s, ms = 600) {
  await s.page.waitForLoadState("networkidle");
  await s.pause(ms);
}

export const shots = {
  /* Example: the start page, a hold, then one slow scroll. */
  "EXAMPLE-home": {
    startPath: "/",
    script: async (s) => {
      await s.mark("home", s.page.locator("main").first());
      await s.pause(2500);
      await s.scroll(400);
      await s.pause(1500);
    },
  },
};
