# The organization profile

One JSON file per organization, kept in that organization's own repo (suggested name
`video-profile.json`). Schema: `assets/template/lib/profile.schema.json`. A complete example:
`assets/template/profile.example.json`. `new-project.sh` copies it into each video project as
`profile.json`, where `lib/profile.mjs` validates it on every run.

## Drafting one from two URLs

`scripts/new-project.sh <dir> <name> --from-urls <brand-url> <app-url>` (or, in an existing
project, `node lib/draft-profile.mjs <brand-url> <app-url>`) writes `profile.json` and
`log/profile-draft.md`.

- **Brand** comes from the public website: the name (site-name tag, else the part of the title that
  matches the domain), a tagline (the main heading when short), the accent (the most-used saturated
  colour across buttons, links, brand CSS variables and the theme-colour tag), text and background
  colours, fonts and the logo. Fonts on Google Fonts load by name; any other is downloaded from the
  site into `gfx/fonts/` and listed in `brand.fontFiles`. The logo is saved with a transparent
  background (the original file, or the SVG redrawn on its own).
- **The app** is opened once without signing in. If it shows a password field or redirects to a
  login, `web.auth` becomes `storageState` and the person signs in with `node harness/sign-in.mjs`.
- **Environment** is `live` with `safety.readOnly: true` (or `local` for a localhost address).

With no app to record, `--from-media <brand-url>` (or `node lib/draft-profile.mjs <brand-url>
--media`) drafts the brand only: `environment.kind` is `supplied-media`, there is no `web` or
`mobile` section, and the recorders cannot open anything.

Go through `log/profile-draft.md` with the person: show them the logo file and the colours, read out
the notes, and ask its four "confirm before recording" questions. Common misses: a light logo meant
for a dark header, a display font used only in images, an accent that is really a secondary colour,
and a marketing headline too long to be a tagline. After any correction run `node lib/apply-profile.mjs`.
Then copy the confirmed `profile.json` into the organization's repo as `video-profile.json` (with
`gfx/logo.*` and `gfx/fonts/`) so the next video starts from it.

## Writing one with the person

Ask in this order; the first two sections are the ones that cannot be guessed.

1. **Environment** - "Where can I record without touching real customers?" One of:
   - `mock`: a fake backend with fictional data (safest; restart to reset).
   - `local`: the app running locally against seeded data.
   - `staging`: a shared test deployment. Ask who else uses it and how it is reset.
   - `demo-account`: a dedicated account in a live system. Ask exactly what that account can
     affect; anything it can send, charge or publish goes in `safety.neverDo`.
   - `live`: a real account on the real app. Only valid with `safety.readOnly: true`, which aborts
     every request that is not a read once the recorder has signed in.
   List every host the recorder may open in `allowedHosts` (with port), and the production hosts
   in `forbiddenHosts`. Put the commands that start the environment in `services`.
2. **Safety** - "What must never happen while I am recording?" (`neverDo`) and "What must never be
   readable in the video?" (`mask`). For each `neverDo` item that is a web request, add a
   `blockRequests` rule so the recorder aborts it even if a script slips.
3. **Apps** - `web` (base URL, how to sign in) and/or `mobile` (bundle id, simulator, screen size).
   At least one is required, unless `environment.kind` is `supplied-media` (nothing is recorded;
   `allowedHosts` is then an empty list).
4. **Brand** - three colours, two Google Fonts family names, and a logo file if there is one.
5. **Narration, music, delivery, decisions** - whatever is already settled. Add to `decisions`
   every time the person makes a call that should hold for future videos.

## Sign-in (`web.auth`)

| type | use when | secrets |
|------|----------|---------|
| `none` | the pages are public or the mock needs no login | none |
| `storageState` | SSO, MFA or any login a script should not perform | the person signs in once: `npx playwright codegen --save-storage=auth/state.json <url>`; `auth/` is git-ignored |
| `request` | there is a JSON login endpoint | body values written `env:NAME` are read from the environment |
| `form` | a plain username and password page | each field names its environment variable |

Never write a credential into the profile, a script or the log. If the variables are not set, ask
the person to export them in the shell; do not ask them to paste values into the conversation.

## What each section drives

- `brand` -> `edit/src/profile.json` and the generated `edit/src/fonts.ts` (run
  `node lib/apply-profile.mjs`); also the recorder's cursor colour.
- `web` -> the Playwright recorder, the probe and the 2x capture (`harness/`).
- `mobile` -> `mobile/device.sh`, which every simulator script sources.
- `environment` + `safety` -> the host check and request blocking in `lib/profile.mjs`, the
  pre-flight in `lib/check-env.mjs`, and what you may script.
- `narration` -> `vo/gen-vo.mjs`. `music.bpm` -> the hype cut's beat grid.
- `delivery` -> loudness, size check and who gets the file.
- `decisions` -> read by you, applied without re-asking.

## Limits to state honestly

- Layouts are designed for 1920x1080 at 30 fps.
- Mobile capture is the iOS Simulator only.
- Fonts are Google Fonts families by name, or files listed in `brand.fontFiles`; the organization
  must hold the licence for any font file used in video.
- Read-only mode covers HTTP requests, not WebSocket messages, and an app that reads data with
  POST requests shows empty pages until those reads are added to `safety.readOnlyAllow`.
- `safety.neverDo` on a mobile app is not enforced by code; only your scripts keep it.
