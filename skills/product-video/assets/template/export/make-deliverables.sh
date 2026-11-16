#!/usr/bin/env bash
# Kept for people who call the shell script: the work is done by make-deliverables.mjs, which
# needs no shell (`node export/make-deliverables.mjs`). VIDEO_KBPS still sets the bitrate.
set -euo pipefail
[ -f "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh" ] && source "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh"
exec node "$(dirname "$0")/make-deliverables.mjs" "$@"
