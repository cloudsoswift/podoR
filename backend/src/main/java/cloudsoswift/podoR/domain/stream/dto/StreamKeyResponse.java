package cloudsoswift.podoR.domain.stream.dto;

/** host 화면의 OBS 설정값. rtmpUrl 은 OBS "서버", streamKey 는 "스트림 키" 에 넣는다. */
public record StreamKeyResponse(String streamKey, String rtmpUrl, String status) {
}
