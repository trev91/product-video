#!/usr/bin/env bash
# Record mobile shots one after another, each with its own flow file:
#   SHOTS="01-2 03-2" TAKE=1 ./record-batch.sh
# Flow variables (MAESTRO_*) pass through from the environment.
set -uo pipefail
[ -f "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh" ] && source "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh"
cd "$(dirname "$0")"
: "${SHOTS:?set SHOTS to the shot ids to record, e.g. SHOTS=\"01-2 03-2\"}"
TAKE="${TAKE:-1}"
for shot in $SHOTS; do
  echo "=== shot $shot ==="
  ./record-shot.sh "$shot" "shot-$shot.yaml" "$TAKE" || echo "shot $shot: maestro reported a failure (see log/mobile-shot-$shot-take$TAKE.log)"
done
