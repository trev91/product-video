#!/bin/bash
# Checks this Mac for what the video pipeline needs and, when asked, installs what is missing
# into the person's home folder. No administrator password, nothing system-wide.
#   setup.sh check      report only; changes nothing
#   setup.sh install    install whatever "check" reported missing, then report again
# Everything it installs lives in ~/.product-video (delete that folder to undo it):
#   tools/node-*   Node.js from nodejs.org, checksum-verified   (about 50 MB download, 190 MB on disk)
#   tools/ffmpeg   ffmpeg and ffprobe builds from the npm packages ffmpeg-static and @ffprobe-installer/ffprobe (about 65 MB)
#   bin/, env.sh   links to those tools, and the PATH line every pipeline script loads
# Output lines start with READY, MISSING, INSTALLED, OPTIONAL or NEEDS-PERSON so they are easy to relay.
set -uo pipefail
MODE="${1:-check}"
HOME_DIR="${PRODUCT_VIDEO_HOME:-$HOME/.product-video}"
BIN="$HOME_DIR/bin"
TOOLS="$HOME_DIR/tools"
ENV_FILE="$HOME_DIR/env.sh"
NODE_LINE=22
[ -f "$ENV_FILE" ] && source "$ENV_FILE"

say_line() { printf '%-13s %s\n' "$1" "$2"; }
node_ok() { command -v node >/dev/null 2>&1 && [ "$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)" -ge 20 ] && command -v npm >/dev/null 2>&1; }
# A tool built for the other processor only runs where Rosetta happens to be installed, so it does not count.
native() { file -L "$(command -v "$1")" 2>/dev/null | grep -q "$(uname -m)"; }
ffmpeg_ok() { command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1 && native ffmpeg && native ffprobe && ffmpeg -hide_banner -encoders 2>/dev/null | grep -q libx264; }
chrome_ok() { [ -d "/Applications/Google Chrome.app" ] || [ -d "$HOME/Applications/Google Chrome.app" ]; }

write_env() {
  mkdir -p "$BIN"
  local node_bin=""
  for dir in "$TOOLS"/node-*/bin; do [ -x "$dir/node" ] && node_bin="$dir"; done
  {
    echo "# Written by product-video setup.sh. Loaded by every pipeline script."
    echo "export PATH=\"$BIN${node_bin:+:$node_bin}:\$PATH\""
  } > "$ENV_FILE"
  source "$ENV_FILE"
}

install_node() {
  local arch base file sum
  case "$(uname -m)" in arm64) arch=arm64 ;; x86_64) arch=x64 ;; *) say_line MISSING "Node.js: unsupported processor $(uname -m)"; return 1 ;; esac
  base="https://nodejs.org/dist/latest-v${NODE_LINE}.x"
  mkdir -p "$TOOLS" && cd "$TOOLS" || return 1
  curl -fsSL "$base/SHASUMS256.txt" -o SHASUMS256.txt || { say_line MISSING "Node.js: could not reach nodejs.org"; return 1; }
  file="$(grep -oE "node-v[0-9.]+-darwin-${arch}\.tar\.gz" SHASUMS256.txt | head -1)"
  [ -n "$file" ] || { say_line MISSING "Node.js: no build listed for this Mac"; return 1; }
  curl -fSL --progress-bar "$base/$file" -o "$file" || { say_line MISSING "Node.js: download failed"; return 1; }
  sum="$(shasum -a 256 "$file" | cut -d' ' -f1)"
  if ! grep -q "^$sum  $file\$" SHASUMS256.txt; then
    rm -f "$file"
    say_line MISSING "Node.js: the download did not match its published checksum and was discarded"
    return 1
  fi
  tar -xzf "$file" && rm -f "$file" SHASUMS256.txt
  write_env
  node_ok && say_line INSTALLED "Node.js $(node --version)"
}

install_ffmpeg() {
  mkdir -p "$TOOLS/ffmpeg" "$BIN"
  (cd "$TOOLS/ffmpeg" && rm -f "$BIN/ffmpeg" "$BIN/ffprobe" && npm install --prefix . --no-audit --no-fund ffmpeg-static @ffprobe-installer/ffprobe >/dev/null 2>&1) \
    || { say_line MISSING "ffmpeg: the download failed"; return 1; }
  local ffmpeg_path ffprobe_path
  ffmpeg_path="$(cd "$TOOLS/ffmpeg" && node -p "require('ffmpeg-static')")"
  ffprobe_path="$(cd "$TOOLS/ffmpeg" && node -p "require('@ffprobe-installer/ffprobe').path")"
  [ -x "$ffmpeg_path" ] && [ -x "$ffprobe_path" ] || { say_line MISSING "ffmpeg: no build for this Mac in the packages"; return 1; }
  ln -sf "$ffmpeg_path" "$BIN/ffmpeg"
  ln -sf "$ffprobe_path" "$BIN/ffprobe"
  write_env
  if ffmpeg_ok; then say_line INSTALLED "ffmpeg $(ffmpeg -version | head -1 | cut -d' ' -f3)"; else say_line MISSING "ffmpeg: the packaged build does not run natively on this Mac"; return 1; fi
}

report() {
  local ready=1
  if [ "$(uname -s)" != Darwin ]; then say_line MISSING "This setup supports macOS only."; return 1; fi
  if node_ok; then say_line READY "Node.js $(node --version)"; else say_line MISSING "Node.js (runs the recorder and the editor)"; ready=0; fi
  if ffmpeg_ok; then say_line READY "ffmpeg $(ffmpeg -version | head -1 | cut -d' ' -f3)"; else say_line MISSING "ffmpeg (converts and exports video)"; ready=0; fi
  if chrome_ok; then say_line READY "Google Chrome"; else say_line OPTIONAL "Google Chrome is not installed: a private copy of Chromium (about 150 MB) is downloaded with the first project instead"; fi
  if command -v xcrun >/dev/null 2>&1 && xcrun simctl help >/dev/null 2>&1 && command -v maestro >/dev/null 2>&1; then
    say_line READY "Phone-app recording (iOS Simulator and Maestro)"
  else
    say_line OPTIONAL "Phone-app recording is not set up (needs Xcode and Maestro). Web recording does not need it."
  fi
  local free_gb
  free_gb="$(df -g "$HOME" | awk 'NR==2 {print $4}')"
  if [ "${free_gb:-0}" -lt 3 ]; then say_line NEEDS-PERSON "Only ${free_gb} GB of disk is free; a video project needs about 2 GB."; ready=0; fi
  [ "$ready" = 1 ] && say_line RESULT "ready to make videos" || say_line RESULT "not ready"
  [ "$ready" = 1 ]
}

case "$MODE" in
  check) report ;;
  install)
    [ "$(uname -s)" = Darwin ] || { say_line MISSING "This setup supports macOS only."; exit 1; }
    mkdir -p "$HOME_DIR"
    node_ok || install_node
    if node_ok; then ffmpeg_ok || install_ffmpeg; fi
    write_env
    report
    ;;
  *) echo "usage: setup.sh check|install" >&2; exit 2 ;;
esac
