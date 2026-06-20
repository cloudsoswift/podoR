import apiClient from "@/lib/axios";
import { Page, PageParams } from "./types";

export interface EventItem {
  seq: number;
  eventId: string;
  title: string;
  content: string | null;
  eventType: string;
  eventDate: string;
  ticketingDate: string;
  streamStatus: string | null;
  createdDate: string;
  venueSeq: number;
  venueName: string;
  hostSeq: number;
  hostNickname: string;
}

export interface EventUpdatePayload {
  title: string;
  content?: string | null;
  eventType: string;
  eventDate: string;
  ticketingDate: string;
  venueSeq: number;
}

// 생성 요청은 수정과 동일한 필드 (host 는 서버에서 인증 주체로 설정)
export type EventCreatePayload = EventUpdatePayload;

export interface ListEventsParams extends PageParams {
  keyword?: string;
}

export async function listEvents(params: ListEventsParams): Promise<Page<EventItem>> {
  const { data } = await apiClient.get<Page<EventItem>>("/events", { params });
  return data;
}

export async function createEvent(payload: EventCreatePayload): Promise<EventItem> {
  const { data } = await apiClient.post<EventItem>("/events", payload);
  return data;
}

export async function getEvent(eventId: string): Promise<EventItem> {
  const { data } = await apiClient.get<EventItem>(`/events/${eventId}`);
  return data;
}

export async function updateEvent(eventId: string, payload: EventUpdatePayload): Promise<EventItem> {
  const { data } = await apiClient.put<EventItem>(`/events/${eventId}`, payload);
  return data;
}

export async function deleteEvent(eventId: string): Promise<void> {
  await apiClient.delete(`/events/${eventId}`);
}
