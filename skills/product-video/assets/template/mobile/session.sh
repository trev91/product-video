#!/usr/bin/env bash
# Start or end a mobile recording session.
#   ./session.sh start   boot the simulator and set a clean status bar
#   ./session.sh end     run every cleanup flow from the profile, then clear the status bar
set -euo pipefail
[ -f "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh" ] && source "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh"
source "$(dirname "$0")/device.sh"
case "${1:-}" in
  start)
    xcrun simctl boot "$UDID" 2>/dev/null || true
    xcrun simctl status_bar "$UDID" override --time "$STATUS_BAR_TIME" --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3
    echo "simulator $UDID ready, status bar $STATUS_BAR_TIME"
    ;;
  end)
    FAILED=0
    mkdir -p "$P/log"
    while IFS= read -r flow; do
      [ -n "$flow" ] || continue
      echo "cleanup: $flow"
      (cd "$P/mobile" && MAESTRO_OUT="$P/log" maestro --device "$UDID" test "$flow") >> "$P/log/cleanup.log" 2>&1 \
        || { echo "CLEANUP FAILED: $flow (see log/cleanup.log)"; FAILED=1; }
    done < <(PROFILE="$P/profile.json" node -e '
      const profile = JSON.parse(require("fs").readFileSync(process.env.PROFILE, "utf8"));
      for (const flow of profile.mobile.cleanupFlows ?? []) console.log(flow);')
    xcrun simctl status_bar "$UDID" clear
    echo "$(date '+%Y-%m-%d %H:%M')  mobile session ended, cleanup $([ "$FAILED" = 0 ] && echo ok || echo FAILED)" | tee -a "$P/log/recording-log.txt"
    exit "$FAILED"
    ;;
  *) echo "usage: session.sh start|end" >&2; exit 2 ;;
esac
