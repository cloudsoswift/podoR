package cloudsoswift.podoR.domain.stream.dto;

/**
 * host 화면의 OBS 설정값. rtmpUrl 은 OBS "서버", streamKey 는 "스트림 키" 에 넣는다.
 * vodStatus 는 방송 종료 후 녹화본(VOD) 준비 상태(NONE, PROCESSING, READY, FAILED).
 */
public record StreamKeyResponse(String streamKey, String rtmpUrl, String status, String vodStatus) {
}
