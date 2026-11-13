#!/usr/bin/env bash
# One frame every 12 s of the delivery file, tiled, for a quick visual review.
#   ./contact-sheet.sh [file.mp4] [out.png]
set -euo pipefail
[ -f "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh" ] && source "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh"
cd "$(dirname "$0")"
F="${1:-$(node -p "require('../edit/video.json').name").mp4}"
OUT="${2:-../log/sheets/$(basename "$F" .mp4)-sheet.png}"
mkdir -p "$(dirname "$OUT")"
ffmpeg -v error -y -i "$F" -vf "fps=1/12,scale=384:-1,tile=6x4" -frames:v 1 "$OUT" && echo "$OUT"
