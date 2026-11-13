#!/usr/bin/env bash
# Create a video project from the template, with a profile that is either supplied or drafted.
#   new-project.sh <project-dir> <video-name> <profile.json>
#   new-project.sh <project-dir> <video-name> --from-urls <brand-url> <app-url>
#   new-project.sh <project-dir> <video-name> --from-media <brand-url>
#   e.g. new-project.sh ./videos/onboarding-tour onboarding-tour ./video-profile.json
#        new-project.sh ./videos/launch launch-hype --from-urls https://example.com https://app.example.com
# A supplied profile is copied into the project (with its logo and fonts), validated and applied.
# --from-urls drafts the profile: brand from the first URL, the app to record from the second,
# with read-only mode on. --from-media drafts a profile with the brand only, for a video made
# from supplied screenshots and videos (lib/import-media.mjs) with no app recorded.
# Confirm the draft (log/profile-draft.md) with the person before recording or editing.
set -euo pipefail
[ -f "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh" ] && source "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh"
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${1:?project directory}"
NAME="${2:?video name, e.g. onboarding-tour}"
PROFILE="${3:?a profile.json path, --from-urls <brand-url> <app-url>, or --from-media <brand-url>}"
BRAND_URL=""; APP_URL=""
if [ "$PROFILE" = "--from-urls" ]; then
  BRAND_URL="${4:?brand URL}"; APP_URL="${5:?app URL}"; PROFILE=""
elif [ "$PROFILE" = "--from-media" ]; then
  BRAND_URL="${4:?brand URL}"; APP_URL="--media"; PROFILE=""
else
  [ -f "$PROFILE" ] || { echo "profile not found: $PROFILE" >&2; exit 1; }
fi
[ -e "$DIR/profile.json" ] && { echo "$DIR already holds a project" >&2; exit 1; }
case "$DIR" in *" "*) echo "the project path must not contain spaces: $DIR" >&2; exit 1 ;; esac
command -v node >/dev/null 2>&1 || { echo "Node.js is missing: run scripts/setup.sh install first" >&2; exit 1; }

mkdir -p "$DIR"/{raw/web,raw/mobile,raw/cuts,raw/media,music,gfx,log,captions,auth}
cp -R "$SKILL/assets/template/." "$DIR/"
rm "$DIR/profile.example.json"
DIR="$(cd "$DIR" && pwd)"

# A supplied profile, with its logo and font files copied beside it so the project is self-contained.
PROFILE="$PROFILE" DIR="$DIR" NAME="$NAME" node -e '
  const fs = require("fs"), path = require("path");
  const { PROFILE, DIR, NAME } = process.env;
  const videoPath = path.join(DIR, "edit/video.json");
  const video = JSON.parse(fs.readFileSync(videoPath, "utf8"));
  video.name = NAME;
  fs.writeFileSync(videoPath, JSON.stringify(video, null, 2) + "\n");
  if (!PROFILE) process.exit(0);
  const profile = JSON.parse(fs.readFileSync(PROFILE, "utf8"));
  const bring = (relative, folder, name) => {
    const source = path.resolve(path.dirname(PROFILE), relative);
    const target = `${folder}/${name ?? path.basename(source)}`;
    fs.mkdirSync(path.join(DIR, folder), { recursive: true });
    fs.copyFileSync(source, path.join(DIR, target));
    return target;
  };
  profile.$schema = "./lib/profile.schema.json";
  if (profile.brand?.logo) profile.brand.logo = bring(profile.brand.logo, "gfx", `logo${path.extname(profile.brand.logo)}`);
  for (const file of profile.brand?.fontFiles ?? []) file.path = bring(file.path, "gfx/fonts");
  fs.writeFileSync(path.join(DIR, "profile.json"), JSON.stringify(profile, null, 2) + "\n");'

echo "installing dependencies (a few minutes the first time)..."
(cd "$DIR" && npm install --no-audit --no-fund >/dev/null 2>&1) || { echo "npm install failed in $DIR" >&2; exit 1; }
(cd "$DIR/edit" && npm install --no-audit --no-fund >/dev/null 2>&1) || { echo "npm install failed in $DIR/edit" >&2; exit 1; }
# Without Google Chrome, the recorder uses Playwright's own Chromium.
if [ ! -d "/Applications/Google Chrome.app" ] && [ ! -d "$HOME/Applications/Google Chrome.app" ]; then
  echo "Google Chrome not found: downloading a private copy of Chromium..."
  (cd "$DIR" && npx playwright install chromium >/dev/null 2>&1) || { echo "could not download Chromium" >&2; exit 1; }
fi
# Remotion serves media from edit/public: link the project folders into it.
(cd "$DIR/edit" && mkdir -p public && cd public && for d in raw vo music gfx; do ln -sfn "../../$d" "$d"; done)
if [ -n "$BRAND_URL" ]; then
  (cd "$DIR" && node lib/draft-profile.mjs "$BRAND_URL" "$APP_URL" > /dev/null)
  echo "profile drafted from $BRAND_URL: read $DIR/log/profile-draft.md and confirm it with the person"
fi
(cd "$DIR" && node lib/apply-profile.mjs)

cat > "$DIR/log/recording-log.txt" <<LOG
Video "$NAME" - recording log
Started $(date '+%Y-%m-%d %H:%M'). Project: $DIR

Session log (shot, take, time, anything created or deleted)
LOG
echo "project ready: $DIR"
echo "next: node lib/check-env.mjs, then follow the skill's workflow"
