package cloudsoswift.podoR.domain.stream;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.time.Duration;

/**
 * 스트리밍 설정. 비밀값(internalToken, mediaCookieSecret)은 podoR-config / .env 에만 둔다.
 *
 * @param maxConcurrent  동시에 송출(LIVE·INTERRUPTED)할 수 있는 회차 수
 * @param interruptGrace 송출이 끊긴 뒤 방송 종료로 확정하기까지 기다리는 시간
 * @param mediaRoot      컨테이너 안의 media 볼륨 경로(hls/, vod/ 의 부모)
 */
@ConfigurationProperties("stream")
public record StreamProperties(
        String rtmpUrl,
        @DefaultValue("1") int maxConcurrent,
        @DefaultValue("3m") Duration interruptGrace,
        String internalToken,
        String mediaCookieSecret,
        @DefaultValue("/media") String mediaRoot) {
}
