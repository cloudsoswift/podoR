package cloudsoswift.podoR.domain.stream.controller;

import cloudsoswift.podoR.domain.stream.media.MediaClaims;
import cloudsoswift.podoR.domain.stream.media.MediaCookieSigner;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * nginx auth_request 대상. 2xx 면 nginx 가 파일을 내주고, 401/403 이면 그대로 거부한다.
 * nginx 는 정규화된 경로($uri)를 넘기지만, 혹시 모를 '..' 도 여기서 한 번 더 막는다.
 */
@RestController
@RequiredArgsConstructor
public class MediaAuthController {

    // /media/hls/{eventId}/... 또는 /media/vod/{eventId}.mp4
    private static final Pattern MEDIA_PATH = Pattern.compile("^/media/(?:hls/([^/]+)/.+|vod/([^/]+)\\.mp4)$");

    private final MediaCookieSigner signer;

    @GetMapping("/internal/media/authorize")
    public ResponseEntity<Void> authorize(@CookieValue(name = StreamViewController.COOKIE, required = false) String token,
                                          @RequestHeader(name = "X-Original-URI", required = false) String uri) {
        Optional<MediaClaims> claims = signer.verify(token, Instant.now());
        if (claims.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        if (uri == null || uri.contains("..")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        Matcher m = MEDIA_PATH.matcher(uri);
        if (!m.matches()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        String eventId = m.group(1) != null ? m.group(1) : m.group(2);
        return eventId.equals(claims.get().eventId())
                ? ResponseEntity.noContent().build()
                : ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }
}
