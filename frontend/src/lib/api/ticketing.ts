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

export interface PreparedOrder {
  orderNumber: string;
  /** 서버가 계산한 결제 금액(원). 위젯 setAmount 와 확정 요청에 그대로 쓴다. */
  amount: number;
  orderName: string;
}

// 결제 준비: PENDING 주문을 만들고(같은 좌석이면 기존 주문을 그대로) 금액·주문명을 받는다. 입장권 검사 대상.
export async function prepareOrder(eventId: string, eventSeatSeqs: number[]): Promise<PreparedOrder> {
  const { data } = await apiClient.post<PreparedOrder>(`/events/${eventId}/order`, { eventSeatSeqs });
  return data;
}

// 결제 승인: 토스 successUrl 로 돌아온 paymentKey·amount 로 확정한다(모의 결제는 paymentKey "mock-…").
export async function confirmPayment(
  eventId: string,
  orderNumber: string,
  body: { paymentKey: string; amount: number },
): Promise<{ orderNumber: string }> {
  const { data } = await apiClient.post<{ orderNumber: string }>(
    `/events/${eventId}/order/${orderNumber}/confirm`,
    body,
  );
  return data;
}

// 결제 실패 기록: 토스 failUrl 의 code·message 를 남기고 서버가 선점을 해제한다.
export async function failPayment(
  eventId: string,
  orderNumber: string,
  body: { code: string; message: string },
): Promise<void> {
  await apiClient.post(`/events/${eventId}/order/${orderNumber}/fail`, body);
}

// 남은 좌석 전부 취소
export async function cancelOrder(eventId: string, orderNumber: string): Promise<void> {
  await apiClient.delete(`/events/${eventId}/order/${orderNumber}`);
}

// 부분 취소: 고른 좌석(주문 항목)만 취소
export async function cancelOrderItems(eventId: string, orderNumber: string, ticketingItemSeqs: number[]): Promise<void> {
  await apiClient.post(`/events/${eventId}/order/${orderNumber}/cancel`, { ticketingItemSeqs });
}
