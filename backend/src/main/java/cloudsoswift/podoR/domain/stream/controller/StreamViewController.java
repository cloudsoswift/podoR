package cloudsoswift.podoR.domain.stream.controller;

import cloudsoswift.podoR.domain.stream.dto.StreamViewResponse;
import cloudsoswift.podoR.domain.stream.media.MediaCookieSigner;
import cloudsoswift.podoR.domain.stream.service.StreamViewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * 관람 화면. 응답과 함께 /media/ 전용 서명 쿠키를 굽고, nginx 가 HLS 조각·VOD 요청마다 이 쿠키를 검사한다.
 * 화면은 5초마다 이 API 를 다시 불러 상태를 갱신하므로 쿠키(10분)도 함께 연장된다.
 */
@RestController
@RequiredArgsConstructor
public class StreamViewController {

    static final String COOKIE = "podor_media";
    private static final Duration COOKIE_TTL = Duration.ofMinutes(10);

    private final StreamViewService viewService;
    private final MediaCookieSigner signer;

    @GetMapping("/events/{eventId}/stream")
    public ResponseEntity<StreamViewResponse> view(@PathVariable String eventId, Authentication authentication) {
        Long userSeq = (Long) authentication.getPrincipal();
        StreamViewResponse body = viewService.view(userSeq, eventId);
        ResponseCookie cookie = ResponseCookie.from(COOKIE, signer.sign(userSeq, eventId, Instant.now().plus(COOKIE_TTL)))
                .path("/media/").httpOnly(true).secure(true).sameSite("Strict").maxAge(COOKIE_TTL).build();
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie.toString()).body(body);
    }

    @GetMapping("/events/series/{seriesId}/watchable")
    public ResponseEntity<List<String>> watchable(@PathVariable String seriesId, Authentication authentication) {
        return ResponseEntity.ok(viewService.watchableEventIds((Long) authentication.getPrincipal(), seriesId));
    }
}
