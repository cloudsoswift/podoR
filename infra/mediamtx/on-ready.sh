#!/bin/sh
# 송출 시작: Spring 에 알려 출력 폴더(/media/hls/{eventId}/{sessionNo})를 받고, 원본 + 480p HLS 를 쓴다.
# env: MTX_PATH(live/{key}), SPRING_URL, STREAM_INTERNAL_TOKEN, STREAM_ENCODER(vaapi|x264)
set -eu

KEY="${MTX_PATH#live/}"
RESP=$(curl -fsS --retry 10 --retry-delay 3 --retry-all-errors -X POST \
  -H "X-Internal-Token: ${STREAM_INTERNAL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"streamKey\":\"${KEY}\"}" \
  "${SPRING_URL}/api/internal/stream/started")
OUT=$(printf '%s' "$RESP" | jq -r .outputDir)
mkdir -p "$OUT/src" "$OUT/480p"

IN="rtmp://127.0.0.1:1935/${MTX_PATH}"

# 480p 인코더. 원본(v:0)은 재인코딩 없이 그대로 복사한다.
if [ "${STREAM_ENCODER:-vaapi}" = "vaapi" ]; then
  HW="-vaapi_device /dev/dri/renderD128"
  V1="-filter:v:1 format=nv12,hwupload,scale_vaapi=w=-2:h=480 -c:v:1 h264_vaapi"
else
  HW=""
  V1="-filter:v:1 scale=-2:480 -c:v:1 libx264 -preset veryfast"
fi

# -hls_list_size 0 + event: 조각을 지우지 않는다(처음부터 되감기 가능, VOD 재료).
# shellcheck disable=SC2086
exec ffmpeg -hide_banner -loglevel warning $HW -i "$IN" \
  -map 0:v:0 -map 0:a:0 -map 0:v:0 -map 0:a:0 \
  -c:v:0 copy -c:a:0 copy \
  $V1 -b:v:1 1M -maxrate:v:1 1200k -bufsize:v:1 2M -g:v:1 60 \
  -c:a:1 aac -b:a:1 96k \
  -f hls -hls_time 2 -hls_list_size 0 -hls_playlist_type event -hls_flags independent_segments \
  -var_stream_map "v:0,a:0,name:src v:1,a:1,name:480p" \
  -master_pl_name master.m3u8 \
  -hls_segment_filename "$OUT/%v/%05d.ts" "$OUT/%v/index.m3u8"
