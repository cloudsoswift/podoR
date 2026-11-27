/**
 * "토스 결제창으로 이동 중" 표시.
 *
 * 결제 페이지는 이탈 시 선점을, QueueGate 는 pagehide·언마운트 시 입장권을 반납한다.
 * 토스 결제창(requestPayment)으로 넘어가는 것도 페이지 이탈이라 그대로 두면 선점이 풀려 확정이 항상 실패한다.
 * 그래서 이동 직전에 이 표시를 세워 두 정리 동작을 건너뛴다(정리는 서버가 맡는다).
 * 성공·실패 페이지(또는 결제 페이지 재진입)에서 지운다.
 *
 * sessionStorage 는 사생활 보호 모드 등에서 throw 할 수 있으므로 모두 try/catch 로 감싼다.
 * 못 쓰면 "이동 중 아님"으로 본다 — 기존 정리 동작이 그대로 돈다.
 */
const key = (eventId: string) => `payment-redirect:${eventId}`;

export function markPaymentRedirect(eventId: string): void {
  try {
    sessionStorage.setItem(key(eventId), String(Date.now()));
  } catch {
    // 저장소를 못 쓰면 표시 없이 진행한다.
  }
}

export function isPaymentRedirect(eventId: string): boolean {
  try {
    return sessionStorage.getItem(key(eventId)) !== null;
  } catch {
    return false;
  }
}

export function clearPaymentRedirect(eventId: string): void {
  try {
    sessionStorage.removeItem(key(eventId));
  } catch {
    // 무시
  }
}
