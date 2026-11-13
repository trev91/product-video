# product-video

A Claude Code plugin that makes product videos from real screen captures of your own apps:

- a **narrated tour** (title card, scenes with zooms and callouts, burned-in captions, end card), or
- a **silent hype cut** (type and product on a dark stage, cut on a beat grid, music added later).

Everything specific to an organization lives in one profile file: brand, the apps to record, the
environment where recording is safe, and the creative decisions that are already settled.

## Install

The plugin lives in its own marketplace, so installing is two steps: add the marketplace, then
install the plugin from it.

**Claude desktop app:** open Settings, then Customize, then Plugins. Use **Add** to add the
marketplace `trev91/product-video`, then install **product-video** from it.

**Terminal:**

```
claude plugin marketplace add trev91/product-video
claude plugin install product-video@product-video
```

Start a new session afterwards so the plugin loads.

## Requirements

macOS. Ask Claude to "set up video making" (or run `/product-video:setup`): it checks the Mac and, with
your OK, installs what is missing into a folder in your home directory, with no administrator password.

- Node 20 or newer and ffmpeg with libx264 (installed for you if missing). Google Chrome is used when
  present; otherwise a private Chromium is downloaded.
- For mobile capture: macOS with Xcode's iOS Simulator and Maestro. Web-only use needs neither.
- **Remotion licence:** the edit is built with Remotion, which is free for individuals and for
  companies of up to three people; larger organizations need a paid company licence.

## First use

1. Give Claude two URLs: your public website (for the brand) and your web app (to record). It
   drafts a profile from them, with read-only mode on, and goes through the draft with you. If the
   app needs a login, you sign in once in a browser window it opens; it never handles a password.
   Or write the profile yourself from `skills/product-video/assets/template/profile.example.json`.
   The `environment` and `safety` sections decide where recording is allowed and what must never
   happen; check them carefully.
2. Ask for a video: "make a 60 second hype video of the new dashboard" or "make a narrated tour of
   onboarding".

## What it will not do

- Record on a host the profile does not list as allowed, or send a request the profile blocks.
- Change anything in a live app: it is recorded in read-only mode, where every request that is
  not a read is aborted. (WebSocket messages are not covered.)
- Read or store credentials: the profile names environment variables.
- Upload, post or commit a video unless you ask.

## Status

Version 0.1.0: the engine, the profile schema, and a start from two URLs. The template renders and the web recorder runs
end to end against a test page. It has not yet been run on a second organization's product, the
mobile scripts are untested outside the product they came from, and mobile capture is iOS Simulator only.

## Licence

MIT. See [LICENSE](LICENSE). Remotion, which the edit depends on, has its own licence (see Requirements).
