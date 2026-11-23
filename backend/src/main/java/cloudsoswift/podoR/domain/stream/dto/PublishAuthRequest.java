package cloudsoswift.podoR.domain.stream.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * MediaMTX authHTTPAddress 가 보내는 본문. action 은 publish / read / playback 등,
 * path 는 RTMP 경로(OBS 서버 rtmp://host/live + 키 → "live/{key}").
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PublishAuthRequest(String user, String password, String ip, String action,
                                 String path, String protocol, String id, String query) {
}
