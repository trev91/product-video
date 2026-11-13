#!/bin/bash
# Bakes the trims and speed changes for the hype cut into constant 30 fps clips in raw/cuts/
# (simulator recordings are variable frame rate, so the edit plays every cut at 1x from frame 0).
# Each clip ends on a 4 s frozen tail: check what that last frame is before relying on it.
#   ./make-cuts.sh            # reads edit/cuts.txt
# cuts.txt, one clip per line (paths relative to the project root):
#   <name> <file>:<start>:<duration>:<speed> [<file>:<start>:<duration>:<speed> ...]
#   <name>.png <file>:<time>                 a single frame
# CUT_SCALE sets the output size (default -2:1748, two thirds of a 2622 px phone recording).
set -euo pipefail
[ -f "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh" ] && source "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh"
cd "$(dirname "$0")/.."
OUT=raw/cuts
SCALE="${CUT_SCALE:--2:1748}"
mkdir -p "$OUT"

cut() {
  local name=$1; shift
  local inputs=() filter="" labels="" i=0
  for seg in "$@"; do
    IFS=: read -r file start dur speed <<<"$seg"
    inputs+=(-ss "$start" -t "$dur" -i "$file")
    filter+="[$i:v]setpts=(PTS-STARTPTS)/$speed,fps=30,scale=$SCALE:flags=lanczos[v$i];"
    labels+="[v$i]"
    i=$((i + 1))
  done
  filter+="${labels}concat=n=$i:v=1:a=0,tpad=stop_mode=clone:stop_duration=4[out]"
  ffmpeg -v error -y "${inputs[@]}" -filter_complex "$filter" -map "[out]" -an \
    -c:v libx264 -crf 15 -preset slow -pix_fmt yuv420p -g 15 -r 30 "$OUT/$name.mp4" </dev/null
  echo "$name $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/$name.mp4")"
}

while read -r name rest; do
  case "$name" in ""|\#*) continue ;; esac
  if [[ "$name" == *.png ]]; then
    IFS=: read -r file at <<<"$rest"
    ffmpeg -v error -y -ss "$at" -i "$file" -frames:v 1 "$OUT/$name" </dev/null
    echo "$name"
  else
    # shellcheck disable=SC2086
    cut "$name" $rest
  fi
done < edit/cuts.txt
