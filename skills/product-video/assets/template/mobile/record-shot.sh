#!/usr/bin/env bash
# Record one mobile shot: start the simulator screen recorder, wait the handle,
# run the Maestro flow, wait again, stop the recorder.
# Usage: record-shot.sh <shot-id e.g. 02-1> <flow.yaml> [take]
set -euo pipefail
[ -f "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh" ] && source "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh"
SHOT="$1"; FLOW="$2"; TAKE="${3:-1}"
source "$(dirname "$0")/device.sh"
OUT="$P/raw/mobile/shot-${SHOT}-take${TAKE}.mp4"
LOG="$P/log/mobile-shot-${SHOT}-take${TAKE}.log"
mkdir -p "$P/raw/mobile" "$P/log"
rm -f "$OUT"
xcrun simctl io "$UDID" recordVideo --codec=h264 --mask=ignored --force "$OUT" > "$LOG.rec" 2>&1 &
REC=$!
sleep 2.5
STATUS=0
MAESTRO_OUT="$P/log" maestro --device "$UDID" test "$FLOW" > "$LOG" 2>&1 || STATUS=$?
sleep 2.5
kill -INT "$REC"
wait "$REC" || true
sleep 1
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT" 2>/dev/null || echo "?")
echo "$(date '+%Y-%m-%d %H:%M')  mobile shot ${SHOT} take ${TAKE}: maestro exit ${STATUS}, ${DUR}s -> $(basename "$OUT")" | tee -a "$P/log/recording-log.txt"
exit "$STATUS"
