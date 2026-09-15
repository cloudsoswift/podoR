import apiClient from "@/lib/axios";
import { useAuthStore } from "@/store/authStore";

export type QueueStatus = "NOT_OPEN" | "WAITING" | "ADMITTED";

/** 상태에 따라 유효한 필드가 다르다. 무관한 필드는 null 이거나 없다. */
export interface QueueStatusResponse {
  status: QueueStatus;
  /** WAITING: 1부터 시작하는 내 순번 */
  position?: number | null;
  /** WAITING: 내 앞 인원 */
  ahead?: number | null;
  /** ADMITTED: 입장권 만료 시각 */
  passExpiresAt?: string | null;
  /** 항상 유효 */
  opensAt: string;
}

/** 등록 + 하트비트 + 승격 시도 + 상태 조회(멱등). 대기 중에는 이게 폴링이자 하트비트다. */
export async function enterQueue(eventId: string): Promise<QueueStatusResponse> {
  const { data } = await apiClient.post<QueueStatusResponse>(`/events/${eventId}/queue`);
  return data;
}

/** 이탈 — 대기 취소 또는 입장권 반납. */
export async function leaveQueue(eventId: string): Promise<void> {
  await apiClient.delete(`/events/${eventId}/queue`);
}

/**
 * 탭 닫기/새로고침(pagehide) 전용 이탈.
 * axios(XHR)는 keepalive 를 쓸 수 없고 sendBeacon 은 Authorization 헤더를 못 붙이므로 fetch 를 쓴다.
 * 유실되어도(모바일, 교차 출처 preflight 제한 등) 입장권 TTL 이 최종 안전망이다.
 */
export function leaveQueueKeepalive(eventId: string): void {
  const token = useAuthStore.getState().accessToken;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
  fetch(`${baseUrl}/events/${eventId}/queue`, {
    method: "DELETE",
    keepalive: true,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  }).catch(() => {});
}
