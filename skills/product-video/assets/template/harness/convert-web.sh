#!/usr/bin/env bash
# Convert Playwright's VP8 webm recordings to constant 30 fps H.264 mp4 for the edit.
set -euo pipefail
[ -f "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh" ] && source "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh"
cd "$(dirname "$0")/../raw/web"
for f in shot-*.webm; do
  out="${f%.webm}.mp4"
  [ -f "$out" ] && [ "$out" -nt "$f" ] && continue
  ffmpeg -v error -y -i "$f" -vf "fps=30" -c:v libx264 -crf 17 -preset medium -pix_fmt yuv420p -an "$out"
  echo "$f -> $out ($(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out")s)"
done
