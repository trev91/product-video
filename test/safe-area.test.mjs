// Loads the edit's TypeScript helper directly: needs Node 22.18 or newer (type stripping).
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fitWindow, offFrame, windowBox } from "../skills/product-video/assets/template/edit/src/hype/safeArea.ts";

const frame = { width: 1920, height: 1080 };
const browser = { frame, aspect: 1440 / 900, bar: 40, marginX: 96, marginY: 54 };

describe("windowBox and offFrame", () => {
  it("places a centred window and finds nothing wrong", () => {
    const box = windowBox({ width: 1200, height: 790, y: -36 }, frame);
    assert.deepEqual(box, { left: 360, top: 109, right: 1560, bottom: 899 });
    assert.deepEqual(offFrame(box, frame), []);
  });

  it("reports how far a moved or scaled window leaves the frame", () => {
    assert.deepEqual(offFrame(windowBox({ width: 1500, height: 977.5, x: 600 }, frame), frame), ["right by 390px"]);
    assert.deepEqual(offFrame(windowBox({ width: 1200, height: 790, scale: 1.5 }, frame), frame), ["top by 53px", "bottom by 53px"]);
  });

  it("can check against the title-safe margin instead of the frame edge", () => {
    const box = windowBox({ width: 1800, height: 600 }, frame);
    assert.deepEqual(offFrame(box, frame), []);
    assert.deepEqual(offFrame(box, frame, 96), ["left by 36px", "right by 36px"]);
  });
});

describe("fitWindow", () => {
  it("leaves a window that already fits alone", () => {
    assert.deepEqual(fitWindow({ width: 1200, y: -36 }, browser), { width: 1200, x: 0, y: -36 });
  });

  it("moves a window back inside instead of letting it run off the edge", () => {
    const fit = fitWindow({ width: 1200, x: 600 }, browser);
    assert.equal(fit.width, 1200);
    assert.equal(fit.x, 264);
    const height = 40 + fit.width / browser.aspect;
    assert.deepEqual(offFrame(windowBox({ width: fit.width, height, x: fit.x, y: fit.y }, frame), frame, 96), []);
  });

  it("shrinks a window too big for the frame at its scale", () => {
    const fit = fitWindow({ width: 1800, scale: 1.2 }, browser);
    const height = 40 + fit.width / browser.aspect;
    assert.ok(fit.width < 1800);
    const box = windowBox({ width: fit.width, height, x: fit.x, y: fit.y, scale: 1.2 }, frame);
    assert.ok(box.left >= 96 - 0.01 && box.right <= 1920 - 96 + 0.01);
    assert.ok(box.top >= 54 - 0.01 && box.bottom <= 1080 - 54 + 0.01);
  });
});
