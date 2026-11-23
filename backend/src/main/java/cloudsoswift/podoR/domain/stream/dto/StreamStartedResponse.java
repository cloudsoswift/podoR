package cloudsoswift.podoR.domain.stream.dto;

/** MediaMTX 의 runOnReady 스크립트가 outputDir 에 HLS 를 쓴다. */
public record StreamStartedResponse(String eventId, int sessionNo, String outputDir) {
}
