/**
 * The judgement calls explore.mjs makes about each page, kept free of the browser so they can be
 * tested: what shot to suggest, and which text on screen may be a person's details.
 */

/** A live app, or one in read-only mode, is only looked at: nothing is typed into it. */
export function isLookOnly(profile) {
  return profile.environment?.kind === "live" || profile.safety?.readOnly === true;
}

/** The suggested shot for a page; on a look-only app a form is shown empty and never typed into. */
export function suggestion(page, { lookOnly = false } = {}) {
  if (page.hasPassword) return "skip (sign-in page)";
  if (page.charts) return "hero still with a camera push on the chart";
  if (page.tables) return "still of the list, then a slow scroll";
  if (page.inputs >= 3) {
    return lookOnly
      ? "still of the empty form (look-only: never type into a form on this app)"
      : "show the form filled in; stop before submitting";
  }
  if (page.height > 1800) return "slow scroll";
  return "short still, or skip";
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// North American numbers, and international numbers that start with +.
const PHONE = /(?:\+\d{1,3}[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b|\+\d{1,3}(?:[\s.-]?\d{2,4}){3,5}\b/g;
// A greeting or "signed in as" followed by one or two capitalised words: "Good morning, Jordan".
const GREETING = /\b(?:[Hh]i|[Hh]ello|[Hh]ey|[Gg]ood (?:morning|afternoon|evening)|[Ww]elcome(?: back)?|[Tt]hanks|[Ss]igned in as|[Ll]ogged in as)[,!]?\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b/g;
// A whole text value that is two or three capitalised words, such as "Avery Quinn" or "Fairway Pines".
const TITLE_WORDS = /^[A-Z][a-z]+(?:[ '-][A-Z][a-z]+){1,2}$/;
/** Words that make a capitalised phrase an interface label rather than a name. */
const UI_WORDS = new Set(`
  About Account Accounts Activity Add Address All Email First Last Name Phone Analytics App Apply Back Billing Book Booking Bookings Calendar Cancel
  Card Cart Chart Check Clear Close Contact Continue Create Dashboard Data Date Delete Details Done Download Edit
  Event Events Export Features File Filter Get Go Help Home Import Inbox Integration Integrations Invite Learn Less
  List Load Log Login Manage Members Menu Message Messages More My New Next Notifications Open Order Orders Overview
  Page Payment Payments Plan Plans Preview Previous Pricing Privacy Profile Read Recent Reports Reset Results Save
  Schedule Search See Select Send Settings Share Show Sign Start Started Status Submit Summary Support Team Teams
  Terms Today Tools Total Update Upload User Users View Week Your
`.trim().split(/\s+/));

/**
 * The text values in an aria snapshot, from lines such as
 *   - heading "Good morning, Avery" [level=2]
 *   - text: Fairway Pines
 *   - cell "Avery Quinn"
 */
function snapshotTexts(aria) {
  const texts = [];
  for (const line of aria.split("\n")) {
    const match = line.match(/^\s*- ([a-z]+)(?: "((?:[^"\\]|\\.)*)")?[^:"]*?(?::\s*(.*))?$/);
    if (!match) continue;
    const [, role, name, value] = match;
    if (name) texts.push({ role, text: name });
    if (value) texts.push({ role, text: value.replace(/^"|"$/g, "") });
  }
  return texts.map(({ role, text }) => ({ role, text: text.trim() })).filter(({ text }) => text);
}

/** Roles whose labels are nearly always navigation or actions, not people. */
const CONTROL_ROLES = new Set(["link", "button", "tab", "menuitem", "option", "combobox", "checkbox", "radio"]);

/**
 * Text in a page's aria snapshot that looks like a person's name, an email address or a phone
 * number. A heuristic for a person to check, not a guarantee: it misses names written in
 * other ways and flags some place and product names.
 * Returns [{ kind: "name" | "email" | "phone", text }], each text once.
 */
export function findPersonalData(aria) {
  const found = new Map();
  const add = (kind, text) => {
    const key = `${kind}:${text}`;
    if (!found.has(key)) found.set(key, { kind, text });
  };
  for (const match of aria.matchAll(EMAIL)) add("email", match[0]);
  for (const match of aria.matchAll(PHONE)) {
    if (match[0].replace(/\D/g, "").length >= 10) add("phone", match[0].trim());
  }
  for (const match of aria.matchAll(GREETING)) add("name", match[0].trim());
  for (const { role, text } of snapshotTexts(aria)) {
    if (CONTROL_ROLES.has(role) || !TITLE_WORDS.test(text)) continue;
    if (!text.split(/[ '-]/).some((word) => UI_WORDS.has(word))) add("name", text);
  }
  return [...found.values()];
}

/** "Good morning, Avery" (name), "a@b.co" (email): the flags for one page, for the shot list. */
function describeFlags(personalData) {
  return personalData.slice(0, 6).map(({ kind, text }) => `"${text}" (${kind})`).join(", ") + (personalData.length > 6 ? `, and ${personalData.length - 6} more` : "");
}

/** log/explore/shot-list.md: the proposed shots, strongest first, with pages to check before use. */
export function shotListMarkdown({ origin, pages, blocked = [], notVisited = 0, lookOnly = false, mask = [] }) {
  const ranked = [...pages].sort((a, b) => b.score - a.score);
  const contents = (item) => [item.charts && `${item.charts} chart(s)`, item.tables && `${item.tables} table(s)`, item.cards && `${item.cards} card(s)`, item.inputs && `${item.inputs} input(s)`].filter(Boolean).join(", ") || "text";
  const shot = (item) => (item.personalData?.length ? `**check before use**; ${item.suggestion}` : item.suggestion);
  const flagged = ranked.filter((item) => item.personalData?.length);
  const checks = flagged.length
    ? `## Check before use

These pages show text that looks like a person's name, an email address or a phone number
(safety.mask: ${mask.length ? mask.join(", ") : "not set"}). It may be real data, or a mock-up that
still reads as real. Look at the screenshot, then mask it, use fictional data, or skip the page.
The check is a heuristic: it also flags some place and product names, and can miss names.

${flagged.map((item) => `- \`${item.path}\` (${item.name}.png): ${describeFlags(item.personalData)}`).join("\n")}
`
    : "No text that looks like a name, an email address or a phone number was found. Still read every frame for anything in safety.mask.\n";
  return `# Proposed shots (draft)

${pages.length} page(s) of ${origin} visited by following links only. Nothing was clicked or submitted.
Strongest candidates first. Refine this with the person: the crawl shows what exists, not what matters.
${lookOnly ? "\nThis app is look-only (environment.kind live, or safety.readOnly): never type into a form here. Show a form as a still of the empty form.\n" : ""}
| # | Page | What is on it | Suggested shot | Reached via |
|---|------|---------------|----------------|-------------|
${ranked.map((item, index) => `| ${index + 1} | \`${item.path}\` ${item.heading || item.title} | ${contents(item)} | ${shot(item)} | ${item.via} |`).join("\n")}

${checks}
Buttons seen (never pressed): ${[...new Set(pages.flatMap((item) => item.buttons ?? []))].slice(0, 30).join(" · ") || "none"}

${blocked.length ? `Requests the guard blocked while exploring:\n${[...new Set(blocked)].map((line) => `- ${line}`).join("\n")}\nIf a page looks empty, one of these may be a read: see safety.readOnlyAllow.` : "No request was blocked."}
${notVisited ? `\nNot visited (limit reached): ${notVisited} link(s); raise --max or --depth.` : ""}
`;
}
