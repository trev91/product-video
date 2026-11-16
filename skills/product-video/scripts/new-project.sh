#!/usr/bin/env bash
# Kept for people who call the shell script: the work is done by new-project.mjs, which needs no
# shell (`node scripts/new-project.mjs ...`). Same arguments:
#   new-project.sh <project-dir> <video-name> <profile.json>
#   new-project.sh <project-dir> <video-name> --from-urls <brand-url> <app-url>
#   new-project.sh <project-dir> <video-name> --from-media <brand-url>
set -euo pipefail
[ -f "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh" ] && source "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh"
command -v node >/dev/null 2>&1 || { echo "Node.js is missing: run scripts/setup.sh install first" >&2; exit 1; }
exec node "$(dirname "$0")/new-project.mjs" "$@"
