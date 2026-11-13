#!/usr/bin/env bash
# Sourced by the mobile scripts: reads the simulator and app from profile.json and exports
#   P (project root), UDID, MAESTRO_APP_ID, MAESTRO_READY_ID, MAESTRO_READY_TEXT, STATUS_BAR_TIME
[ -f "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh" ] && source "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh"
P="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# field <dotted.path>: one value from the profile's mobile section, empty when absent.
field() {
  PROFILE="$P/profile.json" node -e '
    const mobile = JSON.parse(require("fs").readFileSync(process.env.PROFILE, "utf8")).mobile ?? {};
    const value = process.argv[1].split(".").reduce((node, key) => (node == null ? node : node[key]), mobile);
    process.stdout.write(value == null ? "" : String(value));' "$1"
}
DEVICE="$(field device)"
[ -n "$DEVICE" ] || { echo "profile.json has no mobile section" >&2; exit 1; }
if [[ "$DEVICE" =~ ^[0-9A-F-]{36}$ ]]; then
  UDID="$DEVICE"
else
  UDID="$(xcrun simctl list devices available | grep -F "$DEVICE (" | head -1 | grep -oE '[0-9A-F-]{36}' || true)"
  [ -n "$UDID" ] || { echo "no available simulator named \"$DEVICE\"" >&2; exit 1; }
fi
MAESTRO_APP_ID="$(field appId)"
MAESTRO_READY_ID="$(field readyWhen.id)"
MAESTRO_READY_TEXT="$(field readyWhen.text)"
STATUS_BAR_TIME="$(field statusBarTime)"
STATUS_BAR_TIME="${STATUS_BAR_TIME:-9:41}"
export P UDID MAESTRO_APP_ID MAESTRO_READY_ID MAESTRO_READY_TEXT STATUS_BAR_TIME
