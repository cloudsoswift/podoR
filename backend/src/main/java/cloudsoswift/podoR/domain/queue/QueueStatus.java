package cloudsoswift.podoR.domain.queue;

/** 대기열에서 본 사용자의 상태. */
public enum QueueStatus {
    /** 아직 티켓팅 오픈 전 — 줄도 설 수 없다. */
    NOT_OPEN,
    /** 줄 서 있음. */
    WAITING,
    /** 입장권 보유 — 예매 플로우 진입 가능. */
    ADMITTED
}
