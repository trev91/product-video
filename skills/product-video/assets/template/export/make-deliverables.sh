#!/usr/bin/env bash
# Narrated video: render the master from Remotion, then a compact two-pass delivery file
# (H.264 1920x1080 30 fps, AAC 192 kbps 48 kHz stereo, loudness from the profile's
# delivery.loudnessLufs with true peak at -1 dB).
# VIDEO_KBPS sets the delivery bitrate (default 420, about 3.4 MB a minute; screen recordings compress well).
# Output names come from edit/video.json ("name"): <name>-master.mp4, <name>.mp4
set -euo pipefail
[ -f "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh" ] && source "${PRODUCT_VIDEO_HOME:-$HOME/.product-video}/env.sh"
cd "$(dirname "$0")/../edit"
NAME="$(node -p "require('./video.json').name")"
LUFS="$(node -p "require('../profile.json').delivery?.loudnessLufs ?? -16")"
KBPS="${VIDEO_KBPS:-420}"
npx remotion render src/index.ts Video "../export/${NAME}-master.mp4" --codec h264 --crf 18 --audio-codec aac --audio-bitrate 256k --log=error
cd ../export
RATE=(-b:v "${KBPS}k" -maxrate "$((KBPS * 5 / 4))k" -bufsize "$((KBPS * 5 / 2))k")
ffmpeg -v error -y -i "${NAME}-master.mp4" -c:v libx264 "${RATE[@]}" -preset slow -pix_fmt yuv420p -r 30 -pass 1 -passlogfile x264pass -an -f mp4 /dev/null
ffmpeg -v error -y -i "${NAME}-master.mp4" -c:v libx264 "${RATE[@]}" -preset slow -pix_fmt yuv420p -r 30 -pass 2 -passlogfile x264pass \
  -af "loudnorm=I=${LUFS}:TP=-1:LRA=11" -c:a aac -b:a 192k -ar 48000 -ac 2 -movflags +faststart "${NAME}.mp4"
rm -f x264pass-0.log x264pass-0.log.mbtree
echo "master:   $(du -h "${NAME}-master.mp4" | cut -f1)  $(ffprobe -v error -show_entries format=duration -of csv=p=0 "${NAME}-master.mp4")s"
echo "delivery: $(du -h "${NAME}.mp4" | cut -f1)  $(ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate,sample_rate,channels -of csv=p=0 "${NAME}.mp4" | tr '\n' ' ')"
