#!/usr/bin/env bash
# Kept for people who call the shell script: the work is done by contact-sheet.mjs, which needs no
# shell (`node export/contact-sheet.mjs [file.mp4] [out.png]`).
set -euo pipefail
[ -f "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh" ] && source "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh"
exec node "$(dirname "$0")/contact-sheet.mjs" "$@"
