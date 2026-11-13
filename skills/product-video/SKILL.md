---
name: product-video
description: Make product videos from real screen captures of an organization's own web and mobile apps, or from screenshots and videos the person supplies - a narrated feature tour, or a short silent "Apple ad" style hype cut on a beat grid. Use when asked to create, re-cut or update a product demo, onboarding, walkthrough, launch, promo or hype video; to record an app for a video; to turn screenshots or screen recordings into a video; or to set up an organization's video profile (brand, apps, safe recording environment).
---

# Product video

Record the organization's own apps in an environment that is safe to record, or take the
screenshots and videos the person supplies, edit them in Remotion with the organization's brand,
and hand over an MP4. The three sources mix freely in one video: recorded shots, supplied
screenshots and supplied videos. Everything organization-specific
lives in one **profile** file; the engine in `assets/template/` is the same for everyone.

## Before anything else

1. **Find the profile.** Look for `video-profile.json` in the organization's repo (or ask where it
   is). If there is none, either write one with the person or, when they give you a website and an
   app URL, draft it from those: [references/profile.md](references/profile.md). A draft is never
   final: confirm it, and never guess the `environment` and `safety` sections.
2. **Read its `safety` and `decisions`.** `safety.neverDo` and `safety.mask` bind every shot you
   script. `decisions` are settled: apply them without asking again.
3. **Check the machine:** `scripts/setup.sh check`. If anything is MISSING, explain what
   `scripts/setup.sh install` will add and get a yes before running it (see below). Web-only
   organizations do not need Xcode or Maestro.
4. **Load the tools in every shell command.** Shell state does not persist between commands, so
   start each one that runs `node`, `npx` or `ffmpeg` directly with
   `source ~/.product-video/env.sh 2>/dev/null;`. The project's `.sh` scripts load it themselves.

## Setup on a new machine

`scripts/setup.sh install` adds only what `check` reported missing, into `~/.product-video`, with no
administrator password: Node.js from nodejs.org (checksum-verified, about 50 MB) and ffmpeg and
ffprobe from the npm packages `ffmpeg-static` and `@ffprobe-installer/ffprobe` (about 65 MB). Without Google
Chrome, the first project downloads a private Chromium (about 150 MB). Before installing, tell the
person what will be added, where, how big, and that deleting `~/.product-video` undoes it; install
only on their yes. The first project then takes several minutes and about 1 GB for its own
dependencies, and the first render downloads a headless browser (about 100 MB): say so up front.

## Working with a non-technical person

Assume this unless the person shows otherwise.

- **Plain words.** Say "the recorder", "the editor", "a test copy of your app". Never show a
  command, a file path, JSON or an error dump unless asked; say what happened and what you will do.
- **Never ask them to type a command or set a variable.** Run everything yourself. Where a
  credential is needed, use the sign-in window (`web.auth.type: "storageState"`) so they sign in
  the way they always do; do not ask for a password in the conversation.
- **Start from two URLs.** Ask for their website and their app's address, draft the profile with
  `--from-urls`, and put projects in `~/Documents/product-videos/<name>` (no spaces in the path).
- **Or from their own media.** If they cannot give access to the app, or already have screenshots
  or screen recordings, ask them to attach the files or name the folder, and use `--from-media`
  with just their website. Say plainly that a screenshot shows no clicking or typing.
- **Show, then ask.** Send the logo, the colours and the contact sheet of explored pages as images,
  then ask one question at a time with a recommended answer: "I'd use this green and this logo. OK?"
- **Say what recording will and will not touch.** Before opening their app: it only looks, it cannot
  save or send anything, and you will show them the planned shots first.
- **Say how long things take** before a wait of more than a minute (setup, first project, a render).
- **End with the video.** Send the file, say in two sentences what it is and what is unfinished,
  and offer the one most useful change.

## Workflow

Mechanics, file formats and gotchas: [references/pipeline.md](references/pipeline.md).

1. **Brief.** Agree the kind of video, the scenes and the words.
   - Narrated tour: one scene per feature, one or two shots per scene, a title card first and an
     end card last. Write `vo/lines.json` and `edit/video.json`.
   - Hype cut: 30 to 60 seconds, silent, on a beat grid. See [references/hype-cut.md](references/hype-cut.md).
2. **Project.** `scripts/new-project.sh <dir> <name> <profile.json>` copies the template, installs
   dependencies and applies the profile. With only URLs:
   `scripts/new-project.sh <dir> <name> --from-urls <brand-url> <app-url>` drafts the profile
   (read-only mode on) and writes `log/profile-draft.md` to go through with the person. With no
   app to record: `scripts/new-project.sh <dir> <name> --from-media <brand-url>` drafts the brand
   only. After any later change to `profile.json`, run `node lib/apply-profile.mjs` in the project.
3. **Environment.** `node lib/check-env.mjs` prints the environment, the rules and which services
   are down. Start the profile's `environment.services` from background shell commands. The
   recorder refuses any host outside `environment.allowedHosts`; do not work around it.
4. **Explore, agree, then script.** If the app needs a login, the person signs in once with
   `node harness/sign-in.mjs` (a visible window; you never see the password). `node harness/explore.mjs`
   follows the app's links, snapshots each page and drafts `log/explore/shot-list.md`; look at
   `log/explore/sheet.jpg`, then agree the shot list with the person before recording anything.
   Write shots against the exact control names in the `.aria.txt` snapshots, never from memory.
   `node harness/probe-web.mjs <path>` re-snapshots a single page.
5. **Supplied media** (instead of, or as well as, recording). `node lib/import-media.mjs <files or
   folder>` copies screenshots and re-encodes videos into `raw/media/`, and writes
   `log/media/sheet.jpg`. Look at every item (read the image files themselves, not only the sheet)
   for anything in `safety.mask`, agree which item backs which line, then skip to the voice step if
   nothing is recorded. Details: the "Supplied media" section of the pipeline reference.
6. **Record.** Web: entries in `harness/shots-web.mjs`, then `node record.mjs <ids>` and
   `./convert-web.sh`. Mobile: one `mobile/shot-<id>.yaml` per shot, `./session.sh start`, then
   `SHOTS="..." ./record-batch.sh`. Look at a contact sheet of every take before moving on.
7. **Voice** (narrated only): `node vo/gen-vo.mjs`, driven by the profile's `narration`.
8. **Edit.** Narrated: fill `edit/shots.json`, run `node build-edl.mjs`. Hype: write the scenes in
   `edit/src/hype/`. Review single frames (`node stills.mjs <Video|Hype> <outDir> <frame>...`)
   before any full render.
9. **Render and check.** Narrated: `export/make-deliverables.sh`, then `export/qc.sh` and
   `export/contact-sheet.sh`. Hype: `export/render-hype.sh <name>`. Read the contact sheet for
   anything in `safety.mask`.
10. **Hand off and clean up.** Deliver as the profile's `delivery.handoff` says, and say plainly
   what is unfinished. Run `mobile/session.sh end` (it runs the profile's cleanup flows), stop the
   services you started, and finish `log/recording-log.txt`.

## Rules that hold for every organization

- **Stop one step short.** Show a form filled in, never submitted; a draft, never approved; a
  checkout, never confirmed, unless the profile's environment description says that action is
  harmless there. Read-only mode and `safety.blockRequests` are backstops, not permission.
- **A live app is recorded read-only.** `environment.kind: "live"` is only valid with
  `safety.readOnly: true`. Add to `safety.readOnlyAllow` only a request you have checked is a pure
  read, and tell the person which one and why. Read-only mode does not cover WebSocket messages, so
  on a live app do not type into chat, comment or collaborative fields at all.
- **Credentials stay in the environment.** The profile names environment variables; never read,
  print or write their values, and never put a password in a file.
- **Nothing readable that `safety.mask` lists.** Prefer fictional seed data; otherwise cover it
  with `patches` in `edit/shots.json`. Supplied screenshots and videos usually show real data:
  check each one, and ask before using media that shows other people's details.
- **Supplied media is used as given.** Never invent a screen, and never present a mock-up or an
  edited screenshot as the real product.
- **Nothing is uploaded, posted or committed** unless the person asks. A finished video goes only
  where `delivery.handoff` says.
- **Keep the recording log**: takes, decisions, anything created or deleted, open items.
