# product-video

A Claude Code plugin that makes product videos from real screen captures of your own apps:

- a **narrated tour** (title card, scenes with zooms and callouts, burned-in captions, end card), or
- a **silent hype cut** (type and product on a dark stage, cut on a beat grid, music added later).

Everything specific to an organization lives in one profile file: brand, the apps to record, the
environment where recording is safe, and the creative decisions that are already settled.

## Install

### In the Claude desktop app (no terminal needed)

You need the Claude desktop app on a Mac, signed in.

1. Open Claude and click the **Code** tab.
2. Start a new session in any folder (your Documents folder is fine).
3. Paste this message and send it:

   ```text
   Please install the product-video plugin for me. Run these two commands:
   claude plugin marketplace add trev91/product-video
   claude plugin install product-video@product-video
   If "claude" is not found, use the newest claude program inside
   ~/Library/Application Support/Claude/claude-code instead.
   Tell me when it is installed.
   ```

4. If Claude asks permission to run a command, click **Allow**.
5. When Claude says it is installed, start a **new session**.
6. Type `set up video making` and send it. Claude checks your Mac and installs anything missing,
   asking first. This takes a few minutes and about 250 MB.
7. When it says you are ready, ask for a video in one of two ways:
   - **From your live app:** give your website and your app's address. Claude records the app in
     look-only mode.

     ```text
     Make a product video. Brand from https://example.com, app at https://app.example.com
     ```

   - **From your own screenshots or screen recordings:** give your website, then attach the files
     or name the folder they are in. Nothing is recorded and Claude never opens your app.

     ```text
     Make a product video from my screenshots. Brand from https://example.com. The files are in my Downloads folder, in "video screenshots".
     ```

   You can also combine them: record what Claude can reach and supply screenshots for the rest.

If a pop-up offers to install "command line developer tools" during step 3, click **Install**,
wait for it to finish, then send the message again.

**Tips for screenshots**

- Capture just the app, without the browser's address bar or your desktop around it.
- Check that no real names, emails or phone numbers are showing, or tell Claude what to cover.
- A screenshot shows no clicking or typing, so send a short screen recording for any step where
  the motion matters.

### In a terminal

```
claude plugin marketplace add trev91/product-video
claude plugin install product-video@product-video
```

Start a new session afterwards so the plugin loads. To update later:
`claude plugin marketplace update product-video`, then `claude plugin update product-video@product-video`.

## Requirements

macOS. Ask Claude to "set up video making" (or run `/product-video:setup`): it checks the Mac and, with
your OK, installs what is missing into a folder in your home directory, with no administrator password.

Linux (tried on Debian 13, x86-64) works for web videos: the profile draft, the web recorder and the
hype-cut render. Mobile capture and the `system` voice (macOS `say`) do not; use
`narration.mode` `command`, `recorded` or `silent` there.

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
   No access to the app, or you already have screenshots or screen recordings? Give Claude your
   website and the files instead. It builds the video from them and records nothing. You can mix
   all three in one video: recorded shots, screenshots and uploaded videos.
2. Ask for a video: "make a 60 second hype video of the new dashboard" or "make a narrated tour of
   onboarding".

## What it will not do

- Record on a host the profile does not list as allowed, or send a request the profile blocks.
- Change anything in a live app: it is recorded in read-only mode, where every request that is
  not a read is aborted. (WebSocket messages are not covered.)
- Read or store credentials: the profile names environment variables.
- Upload, post or commit a video unless you ask.

## Status

Version 0.2.0: the engine, the profile schema, a start from two URLs, and videos made from supplied screenshots and videos. The template renders and the web recorder runs
end to end against a test page. It has not yet been run on a second organization's product, the
mobile scripts are untested outside the product they came from, and mobile capture is iOS Simulator only.

## Licence

MIT. See [LICENSE](LICENSE). Remotion, which the edit depends on, has its own licence (see Requirements).
