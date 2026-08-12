import apiClient from "@/lib/axios";

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
