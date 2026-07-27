import apiClient from "@/lib/axios";

export interface GradeItem {
  grade: string;
  price: number;
}

// 좌석 식별 키 — 백엔드 Seat 의 (section, rowNumber, seatNumber) 와 일치.
export interface SeatKey {
  section: string;
  rowNumber: string;
  seatNumber: number | null;
}

export interface SeatPlanResponse {
  grades: GradeItem[];
  sectionGrades: Record<string, string>;
  sellableSeats: SeatKey[]; // 현재 EventSeat 가 있는 좌석
}

export interface SeatPlanPayload {
  grades: GradeItem[];
  sectionGrades: Record<string, string>;
  excludedSeats: SeatKey[]; // 등급 섹션 내 이번 이벤트 미가용 좌석
}

export async function getSeatPlan(eventId: string): Promise<SeatPlanResponse> {
  const { data } = await apiClient.get<SeatPlanResponse>(`/events/${eventId}/seat-plan`);
  return data;
}

export async function saveSeatPlan(eventId: string, payload: SeatPlanPayload): Promise<void> {
  await apiClient.put(`/events/${eventId}/seat-plan`, payload);
}
