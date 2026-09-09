import apiClient from "@/lib/axios";
import { AxiosError } from "axios";

/**
 * 서버가 보낸 실패 사유를 꺼낸다.
 * 백엔드는 RFC 7807(ProblemDetail)로 응답하므로 ResponseStatusException 의 사유가 `detail` 에 담긴다.
 * (예: "이 공연은 1인 최대 4석까지 예매할 수 있습니다.")
 */
export function errorDetail(error: unknown, fallback: string): string {
  const detail = (error as AxiosError<{ detail?: string }>)?.response?.data?.detail;
  return typeof detail === "string" && detail.trim() ? detail : fallback;
}

export interface HoldResponse {
  heldSeats: number[];
  expiresAt: string;
}

// 결제하기: 선택 좌석 일괄 선점. 409면 axios 가 throw → 호출부가 좌석 재조회.
export async function holdSeats(eventId: string, eventSeatSeqs: number[]): Promise<HoldResponse> {
  const { data } = await apiClient.post<HoldResponse>(`/events/${eventId}/holds`, { eventSeatSeqs });
  return data;
}

export async function releaseHolds(eventId: string, eventSeatSeqs: number[]): Promise<void> {
  await apiClient.delete(`/events/${eventId}/holds`, { data: { eventSeatSeqs } });
}

export interface SeatQuota {
  used: number;
  max: number;
}

export async function getMySeatQuota(eventId: string): Promise<SeatQuota> {
  const { data } = await apiClient.get<SeatQuota>(`/events/${eventId}/my-seat-quota`);
  return data;
}

export async function createOrder(
  eventId: string,
  eventSeatSeqs: number[],
): Promise<{ orderNumber: string }> {
  const { data } = await apiClient.post<{ orderNumber: string }>(`/events/${eventId}/order`, {
    eventSeatSeqs,
    paymentMethod: "MOCK",
  });
  return data;
}

export async function cancelOrder(eventId: string, orderNumber: string): Promise<void> {
  await apiClient.delete(`/events/${eventId}/order/${orderNumber}`);
}
