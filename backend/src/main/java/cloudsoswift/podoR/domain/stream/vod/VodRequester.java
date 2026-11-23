package cloudsoswift.podoR.domain.stream.vod;

/** 방송이 끝난 회차의 VOD 만들기를 요청한다. 중복 요청은 구현이 무시한다. */
public interface VodRequester {
    void requestBuild(Long eventSeq);
}
