import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { findPersonalData, isLookOnly, shotListMarkdown, suggestion } from "../skills/product-video/assets/template/harness/explore-rules.mjs";

// Every name, address and number in these fixtures is fictional.
const aria = readFileSync(new URL("./fixtures/home.aria.txt", import.meta.url), "utf8");
const formPage = { name: "02-book", path: "/book", heading: "Book a time", inputs: 4, charts: 0, tables: 0, cards: 0, height: 900, score: 5, via: "Book", buttons: ["Book"] };

describe("findPersonalData", () => {
  const found = findPersonalData(aria);
  const texts = (kind) => found.filter((item) => item.kind === kind).map((item) => item.text);

  it("flags a greeting with a first name, as in a dashboard mock-up", () => {
    assert.ok(texts("name").includes("Good morning, Avery"));
  });

  it("flags a whole value that reads like a name or a place", () => {
    assert.ok(texts("name").includes("Quinn Example"));
    assert.ok(texts("name").includes("Maple Hollow"));
  });

  it("flags emails and phone numbers", () => {
    assert.deepEqual(texts("email"), ["quinn@example.com"]);
    assert.deepEqual(texts("phone"), ["(555) 010-0199"]);
  });

  it("leaves interface labels, link names and times alone", () => {
    for (const label of ["Recent Activity", "Save Changes", "Book Tee Times", "Tee Sheet", "Name Email Phone", "Starts at 7:30"]) {
      assert.ok(!found.some((item) => item.text === label), `${label} should not be flagged`);
    }
  });

  it("finds nothing on a page with no personal details", () => {
    assert.deepEqual(findPersonalData('- heading "Reports" [level=1]\n- text: 42 bookings this week\n- button "Export"'), []);
  });

  it("does not count a short number or a date as a phone number", () => {
    assert.deepEqual(findPersonalData("- text: Order 1234 on 2026-11-15, 18 holes"), []);
  });

  it("finds international numbers", () => {
    assert.deepEqual(findPersonalData("- text: +44 20 7946 0958").map((item) => item.kind), ["phone"]);
  });
});

describe("look-only forms", () => {
  it("treats a live app or read-only mode as look-only", () => {
    assert.equal(isLookOnly({ environment: { kind: "live" }, safety: { readOnly: true } }), true);
    assert.equal(isLookOnly({ environment: { kind: "staging" }, safety: { readOnly: true } }), true);
    assert.equal(isLookOnly({ environment: { kind: "local" }, safety: {} }), false);
  });

  it("suggests an empty-form still on a look-only app, never filling it in", () => {
    const shot = suggestion(formPage, { lookOnly: true });
    assert.match(shot, /empty form/);
    assert.doesNotMatch(shot, /filled in/);
  });

  it("keeps the filled-in suggestion for a test app", () => {
    assert.equal(suggestion(formPage), "show the form filled in; stop before submitting");
  });
});

describe("shotListMarkdown", () => {
  const home = { name: "01-home", path: "/", heading: "Good morning, Avery", inputs: 0, charts: 0, tables: 1, cards: 2, height: 900, score: 6, via: "start", buttons: [], suggestion: "still of the list, then a slow scroll", personalData: findPersonalData(aria) };
  const book = { ...formPage, suggestion: suggestion(formPage, { lookOnly: true }), personalData: [] };
  const markdown = shotListMarkdown({ origin: "http://localhost:4173", pages: [home, book], lookOnly: true, mask: ["real names", "email addresses"] });

  it("marks pages with possible personal data as check before use and lists what was found", () => {
    assert.match(markdown, /\| `\/` Good morning, Avery \| .* \| \*\*check before use\*\*; still of the list/);
    assert.match(markdown, /## Check before use/);
    assert.match(markdown, /safety\.mask: real names, email addresses/);
    assert.match(markdown, /- `\/` \(01-home\.png\): .*"Good morning, Avery" \(name\)/);
  });

  it("says the app is look-only and never proposes typing", () => {
    assert.match(markdown, /look-only/);
    assert.doesNotMatch(markdown, /filled in/);
  });

  it("says so when nothing was found", () => {
    const clean = shotListMarkdown({ origin: "http://localhost:4173", pages: [book] });
    assert.doesNotMatch(clean, /## Check before use/);
    assert.match(clean, /No text that looks like a name/);
  });
});
