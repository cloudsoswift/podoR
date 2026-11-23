#!/bin/sh
# 송출 시작: Spring 에 알려 출력 폴더(/media/hls/{eventId}/{sessionNo})를 받고, 원본 + 480p HLS 를 쓴다.
# env: MTX_PATH(live/{key}), SPRING_URL, STREAM_INTERNAL_TOKEN, STREAM_ENCODER(vaapi|x264),
#      STREAM_VAAPI_DEVICE(선택, 기본은 Intel 렌더 노드 자동 탐색),
#      STREAM_SRC_VIDEO_BITRATE(선택, 기본 10M. 원본 화질의 표시용 비트레이트)
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

# Intel GPU(i915) 렌더 노드를 찾는다. 다른 GPU(예: NVIDIA)가 함께 있으면 renderD128 이 Intel 이
# 아닐 수 있고, 번호는 부팅마다 바뀔 수 있다. STREAM_VAAPI_DEVICE 를 주면 그 값을 쓴다.
find_intel_render_node() {
  for node in /dev/dri/renderD*; do
    driver=$(basename "$(readlink -f "/sys/class/drm/$(basename "$node")/device/driver")" 2>/dev/null || true)
    if [ "$driver" = "i915" ] || [ "$driver" = "xe" ]; then
      echo "$node"
      return 0
    fi
  done
  return 1
}

# 480p 인코더. 원본(v:0)은 재인코딩 없이 그대로 복사한다.
# vaapi: 디코딩/화질 축소/인코딩을 모두 GPU에서 하도록 `-hwaccel` 옵션을 추가한다.
#        이렇게 하면, 디코딩한 프레임이 GPU 메모리에 그대로 남아(hwaccel_output_format vaapi)
#        기존처럼 CPU로 내려왔다 다시 올라가지 않는다.
# 480p는 30fps로 고정한다. 입력 프레임레이트와 관계없이, `-g:v:1 60`이 키프레임 2초 간격이 된다.
# 또한, fps를 축소보다 앞에 두어 버릴 프레임은 축소하지 않는다.
if [ "${STREAM_ENCODER:-vaapi}" = "vaapi" ]; then
  DEVICE="${STREAM_VAAPI_DEVICE:-$(find_intel_render_node || echo /dev/dri/renderD128)}"
  echo "on-available: VAAPI device $DEVICE" >&2
  HW="-hwaccel vaapi -hwaccel_device $DEVICE -hwaccel_output_format vaapi"
  V1="-filter:v:1 fps=30,scale_vaapi=w=-2:h=480 -c:v:1 h264_vaapi"
else
  HW=""
  V1="-filter:v:1 fps=30,scale=-2:480 -c:v:1 libx264 -preset veryfast"
fi

# 음성은 두 화질 모두 원본을 복사한다.
# 480p용으로 저음질 인코딩할 경우 스트림당 CPU 코어 약 0.125개 소모됐기 때문.
# 복사 스트림은 ffmpeg가 비트레이트를 몰라, master.m3u8 을 처음 쓸 때 `BANDWIDTH`를 구하지 못한 화질(원본)을
# 목록에서 빼 버린다("Bandwidth info not available"). 그래서 복사 스트림에도 -b 로 표시용 값을 준다.
# 재인코딩은 일어나지 않으며, 이 값은 hls.js 가 화질을 고르는 기준(BANDWIDTH)이 된다.
# 영상은 OBS 송출 비트레이트에 맞춘다. 음성은 OBS 기본값(160k) 기준.
# -hls_list_size 0 + event: 조각(.ts)을 지우지 않는다(처음부터 되감기 가능, 지우지 않은 조각들은 VOD 재료로 사용해야 함).
# shellcheck disable=SC2086
exec ffmpeg -hide_banner -loglevel warning $HW -i "$IN" \
  -map 0:v:0 -map 0:a:0 -map 0:v:0 -map 0:a:0 \
  -c:v:0 copy -c:a:0 copy -b:v:0 "${STREAM_SRC_VIDEO_BITRATE:-10M}" -b:a:0 160k \
  $V1 -b:v:1 1M -maxrate:v:1 1200k -bufsize:v:1 2M -g:v:1 60 \
  -c:a:1 copy -b:a:1 160k \
  -f hls -hls_time 2 -hls_list_size 0 -hls_playlist_type event -hls_flags independent_segments \
  -var_stream_map "v:0,a:0,name:src v:1,a:1,name:480p" \
  -master_pl_name master.m3u8 \
  -hls_segment_filename "$OUT/%v/%05d.ts" "$OUT/%v/index.m3u8"
