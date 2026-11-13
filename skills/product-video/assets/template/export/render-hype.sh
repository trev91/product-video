#!/usr/bin/env bash
# Silent hype cut: render the Hype composition, then make the files to hand off.
#   <name>-render.mp4   Remotion's own output (full-range colour; keep for re-encodes)
#   <name>.mp4          master for an editor: Rec. 709 video range, crf 15
#   <name>-web.mp4      smaller preview copy, crf 20
# Remotion's JPEG frames come out full range; the conversion adds a light luma dither
# because a plain range conversion bands the dark glow of the stage.
# Usage: ./render-hype.sh <name>
set -euo pipefail
[ -f "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh" ] && source "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh"
NAME="${1:?output name, e.g. product-hype-60}"
cd "$(dirname "$0")/../edit"
npx remotion render src/index.ts Hype "../export/${NAME}-render.mp4" --codec=h264 --crf=16 --muted --log=error
cd ../export
REC709="noise=c0s=3:c0f=t+u,scale=in_range=full:in_color_matrix=bt601:out_range=tv:out_color_matrix=bt709,format=yuv420p"
TAGS=(-color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 -movflags +faststart)
ffmpeg -v error -y -i "${NAME}-render.mp4" -vf "$REC709" -c:v libx264 -preset slow -crf 15 "${TAGS[@]}" -an "${NAME}.mp4"
ffmpeg -v error -y -i "${NAME}-render.mp4" -vf "$REC709" -c:v libx264 -preset slow -crf 20 "${TAGS[@]}" -an "${NAME}-web.mp4"
for f in "${NAME}.mp4" "${NAME}-web.mp4"; do
  echo "$f: $(du -h "$f" | cut -f1)  $(ffprobe -v error -select_streams v:0 -show_entries format=duration:stream=width,height,r_frame_rate,pix_fmt,color_range -of csv=p=0 "$f" | tr '\n' ' ')"
done
