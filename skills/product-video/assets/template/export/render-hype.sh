#!/usr/bin/env bash
# Kept for people who call the shell script: the work is done by render-hype.mjs, which needs no
# shell (`node export/render-hype.mjs <name> [--frames 0-149]`).
#   ./render-hype.sh <name>
set -euo pipefail
[ -f "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh" ] && source "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh"
exec node "$(dirname "$0")/render-hype.mjs" "$@"
