package cloudsoswift.podoR.domain.stream.media;

import java.time.Instant;

/** 미디어 쿠키에 담는 내용: 누가, 어느 회차를, 언제까지 볼 수 있는지. */
public record MediaClaims(Long userSeq, String eventId, Instant exp) {
}
