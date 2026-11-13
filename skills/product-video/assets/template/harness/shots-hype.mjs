/**
 * Hype-cut web captures (see hq.mjs). Stills are page states at 2x; clips are
 * short screencast recordings. Nothing here may save, send or submit.
 *   node hq.mjs still home        -> raw/web/still-home.png
 *   node hq.mjs clip tour         -> raw/web/hq-tour.mp4 + hq-tour.json (markers)
 */
import { settle } from "./shots-web.mjs";

export const stills = {
  /* `prepare(page)` is optional: open a menu or scroll before the screenshot. */
  home: { path: "/" },
};

export const clips = {
  /* Example: the start page with one slow scroll; s.snap saves a 2x still of that moment. */
  tour: {
    startPath: "/",
    script: async (s) => {
      await settle(s, 400);
      await s.mark("top");
      await s.pause(1500);
      await s.scroll(500);
      await s.mark("scrolled");
      await s.snap("scrolled");
      await s.pause(1500);
    },
  },
};
