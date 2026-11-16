#!/usr/bin/env bash
# Kept for people who call the shell script: the work is done by convert-web.mjs, which needs no
# shell (`node harness/convert-web.mjs`).
set -euo pipefail
[ -f "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh" ] && source "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh"
exec node "$(dirname "$0")/convert-web.mjs" "$@"
