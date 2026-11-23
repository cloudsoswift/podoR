package cloudsoswift.podoR.domain.stream.entity;

/** 회차 방송 상태. INTERRUPTED 는 송출이 끊겨 재접속을 기다리는 유예 상태다. */
public enum StreamStatus {
    SCHEDULED, LIVE, INTERRUPTED, ENDED
}
