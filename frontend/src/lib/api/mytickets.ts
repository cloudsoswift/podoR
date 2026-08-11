import apiClient from "@/lib/axios";

export type DateBasis = "BOOKED" | "WATCHED";

export interface TicketSummary {
  eventId: string;
  orderNumber: string;
  eventTitle: string;
  venueName: string;
  eventDate: string;
  orderedAt: string;
  status: string;
  totalPrice: number;
  seatCount: number;
}

export interface TicketSeat {
  section: string;
  rowNumber: string;
  seatNumber: number | null;
  grade: string;
  price: number;
}

export interface TicketDetail {
  eventId: string;
  orderNumber: string;
  orderedAt: string;
  status: string;
  cancelledAt: string | null;
  totalPrice: number;
  eventTitle: string;
  venueName: string;
  eventDate: string;
  seats: TicketSeat[];
}

export async function listMyTickets(params: {
  dateBasis: DateBasis;
  year: number;
  month: number;
}): Promise<TicketSummary[]> {
  const { data } = await apiClient.get<TicketSummary[]>("/users/mytickets", { params });
  return data;
}

export async function getMyTicket(ticketId: string): Promise<TicketDetail> {
  const { data } = await apiClient.get<TicketDetail>(`/users/mytickets/${ticketId}`);
  return data;
}
