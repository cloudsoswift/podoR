package cloudsoswift.podoR.domain.stream.dto;

/**
 * 관람 화면 상태. liveUrl 은 LIVE 일 때 현재 세션의 master 재생목록, vodUrl 은 VOD 가 준비됐을 때만 채운다.
 */
public record StreamViewResponse(String status, String vodStatus, String liveUrl, String vodUrl) {
}
