#!/bin/sh
# 송출 끊김: Spring 에 알린다. LIVE → INTERRUPTED, 유예 시간 안에 재송출하면 새 세션으로 이어진다.
# Spring 재기동 중이어도 알림이 유실되지 않게 재시도한다(유실되면 LIVE 로 남는다).
set -eu

KEY="${MTX_PATH#live/}"
curl -fsS --retry 10 --retry-delay 3 --retry-all-errors -X POST \
  -H "X-Internal-Token: ${STREAM_INTERNAL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"streamKey\":\"${KEY}\"}" \
  "${SPRING_URL}/api/internal/stream/stopped"
