import apiClient from "@/lib/axios";

export interface SeatViewSeat {
  eventSeatSeq: number;
  section: string;
  rowNumber: string;
  seatNumber: number | null;
  grade: string;
  price: number;
  status: "AVAILABLE" | "SOLD";
  changeVersion: number;
}

export interface SeatViewSnapshot {
  eventId: string;
  cursor: number;
  layoutJson: string | null;
  seats: SeatViewSeat[];
}

export interface SeatViewChanges {
  cursor: number;
  seats: SeatViewSeat[];
}

export async function getSeatView(eventId: string): Promise<SeatViewSnapshot> {
  const { data } = await apiClient.get<SeatViewSnapshot>(`/events/${eventId}/seat-view`);
  return data;
}

export async function getSeatViewChanges(
  eventId: string,
  since: number,
  section?: string,
): Promise<SeatViewChanges> {
  const { data } = await apiClient.get<SeatViewChanges>(`/events/${eventId}/seat-view/changes`, {
    params: { since, section },
  });
  return data;
}
