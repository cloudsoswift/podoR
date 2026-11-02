# MediaMTX(RTMP 수신) + ffmpeg(HLS 변환). -ffmpeg 변형은 Alpine 기반이다.
# 추가 패키지:
#   curl, jq            — runOnReady/NotReady 스크립트가 Spring 내부 콜백을 부르고 응답을 읽는다
#   intel-media-driver  — Intel Quick Sync(VAAPI, iHD 드라이버). UHD 630 에서 480p 인코딩에 쓴다
# 베이스 배포판이 바뀌면(apk 없음) `docker run --rm --entrypoint sh <img> -c 'cat /etc/os-release'` 로 확인할 것.
FROM bluenviron/mediamtx:1.21.2-ffmpeg

RUN apk add --no-cache curl jq intel-media-driver

COPY on-ready.sh on-not-ready.sh /scripts/
RUN chmod +x /scripts/*.sh
