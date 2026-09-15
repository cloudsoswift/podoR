/**
 * 입장권을 잃었음(게이트 대상 API 의 403)을 대기열 게이트에 알린다.
 *
 * 좌석 스냅샷/변경분, quota, 선점, 주문 5군데의 호출부를 각각 고치지 않고
 * axios 응답 인터셉터 한 곳에서 감지해 window 이벤트로 발행한다. QueueGate 가 이를 받아 다시 줄을 선다.
 */

export const QUEUE_PASS_LOST_EVENT = "podor:queue-pass-lost";

export interface QueuePassLostDetail {
  eventId: string;
}

// BE WebMvcConfig 의 게이트 경로와 같아야 한다. /order/{orderNumber}(주문 취소)는 대상이 아니다.
const GATED = /^\/events\/([^/?#]+)\/(?:seat-view(?:\/changes)?|my-seat-quota|holds|order)(?:[?#]|$)/;

export function gatedEventId(url: string | undefined): string | null {
  if (!url) return null;
  const match = GATED.exec(url);
  return match ? match[1] : null;
}

export function notifyQueuePassLost(eventId: string): void {
  window.dispatchEvent(
    new CustomEvent<QueuePassLostDetail>(QUEUE_PASS_LOST_EVENT, { detail: { eventId } }),
  );
}
