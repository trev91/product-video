#!/bin/bash
# Checks this Mac (or Linux machine, for web videos) for what the video pipeline needs and, when
# asked, installs what is missing into the person's home folder. No administrator password,
# nothing system-wide.
#   setup.sh check      report only; changes nothing
#   setup.sh install    install whatever "check" reported missing, then report again
# The work is done by setup.mjs (`node scripts/setup.mjs check|install` needs no shell). This
# wrapper only exists for a machine with no Node.js at all: it installs Node into
# ~/.product-video/tools first (checksum-verified, from nodejs.org), then hands over.
set -uo pipefail
MODE="${1:-check}"
HOME_DIR="${PRODUCT_VIDEO_HOME:-$HOME/.product-video}"
TOOLS="$HOME_DIR/tools"
NODE_LINE=22
OS="$(uname -s)"
HERE="$(cd "$(dirname "$0")" && pwd)"
[ -f "$HOME_DIR/env.sh" ] && source "$HOME_DIR/env.sh"

say_line() { printf '%-13s %s\n' "$1" "$2"; }
# setup.mjs needs Node 18 or newer to run (it reports anything older than 20 as missing and replaces it).
can_run_setup() { command -v node >/dev/null 2>&1 && [ "$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)" -ge 18 ]; }
sha256_of() { if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1"; else sha256sum "$1"; fi | cut -d' ' -f1; }

install_node() {
  local arch platform base file sum node_bin=""
  case "$(uname -m)" in arm64|aarch64) arch=arm64 ;; x86_64) arch=x64 ;; *) say_line MISSING "Node.js: unsupported processor $(uname -m)"; return 1 ;; esac
  case "$OS" in Darwin) platform=darwin ;; *) platform=linux ;; esac
  base="https://nodejs.org/dist/latest-v${NODE_LINE}.x"
  mkdir -p "$TOOLS" && cd "$TOOLS" || return 1
  curl -fsSL "$base/SHASUMS256.txt" -o SHASUMS256.txt || { say_line MISSING "Node.js: could not reach nodejs.org"; return 1; }
  file="$(grep -oE "node-v[0-9.]+-${platform}-${arch}\.tar\.gz" SHASUMS256.txt | head -1)"
  [ -n "$file" ] || { say_line MISSING "Node.js: no build listed for this computer"; return 1; }
  curl -fSL --progress-bar "$base/$file" -o "$file" || { say_line MISSING "Node.js: download failed"; return 1; }
  sum="$(sha256_of "$file")"
  if ! grep -q "^$sum  $file\$" SHASUMS256.txt; then
    rm -f "$file"
    say_line MISSING "Node.js: the download did not match its published checksum and was discarded"
    return 1
  fi
  tar -xzf "$file" && rm -f "$file" SHASUMS256.txt
  for dir in "$TOOLS"/node-*/bin; do [ -x "$dir/node" ] && node_bin="$dir"; done
  export PATH="$node_bin:$PATH"
  say_line INSTALLED "Node.js $(node --version)"
}

case "$OS" in Darwin|Linux) ;; *) say_line MISSING "This setup supports macOS and Linux only."; exit 1 ;; esac
case "$MODE" in
  check|install) ;;
  *) echo "usage: setup.sh check|install" >&2; exit 2 ;;
esac
if ! can_run_setup; then
  if [ "$MODE" = check ]; then
    say_line MISSING "Node.js (runs the recorder and the editor; the other checks need it, so install adds it first)"
    say_line RESULT "not ready"
    exit 1
  fi
  install_node || { say_line RESULT "not ready"; exit 1; }
fi
exec node "$HERE/setup.mjs" "$MODE"
