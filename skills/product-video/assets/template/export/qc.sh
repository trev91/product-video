#!/usr/bin/env bash
# QC numbers for a delivery file: size against the profile's delivery.maxSizeMb, codecs, loudness.
#   ./qc.sh            # <name>.mp4 from edit/video.json
#   ./qc.sh other.mp4
set -euo pipefail
[ -f "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh" ] && source "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh"
cd "$(dirname "$0")"
F="${1:-$(node -p "require('../edit/video.json').name").mp4}"
LIMIT="$(node -p "require('../profile.json').delivery?.maxSizeMb ?? ''")"
BYTES="$(wc -c < "$F" | tr -d ' ')"
echo "file:      $F ($(du -h "$F" | cut -f1), $BYTES bytes${LIMIT:+; limit $LIMIT MB})"
if [ -n "$LIMIT" ] && [ "$BYTES" -gt "$(node -p "Math.round($LIMIT * 1048576)")" ]; then echo "OVER the size limit"; fi
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate,bit_rate,sample_rate,channels -of default=nw=1 "$F" | sort -u
if ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$F" | grep -q .; then
  echo "loudness:"
  ffmpeg -nostats -i "$F" -af "loudnorm=I=-16:TP=-1:LRA=11:print_format=summary" -f null - 2>&1 | grep -E "Input Integrated|Input True Peak|Input LRA"
else
  echo "loudness:  no audio stream"
fi
