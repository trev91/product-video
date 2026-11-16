#!/usr/bin/env bash
# Kept for people who call the shell script: the work is done by make-cuts.mjs, which needs no
# shell (`node edit/make-cuts.mjs`; reads edit/cuts.txt, CUT_SCALE still sets the size).
set -euo pipefail
[ -f "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh" ] && source "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh"
exec node "$(dirname "$0")/make-cuts.mjs" "$@"
