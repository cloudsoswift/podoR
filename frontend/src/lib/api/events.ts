import apiClient from "@/lib/axios";
import { Page, PageParams } from "./types";

export interface EventItem {
  seq: number;
  eventId: string;
  seriesId: string;
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

// 공연 시리즈 목록 카드 — 같은 series_id 의 Event 회차가 여러 개여도 1아이템.
export interface EventSeries {
  seriesId: string;
  representativeEventId: string;
  title: string;
  eventType: string;
  venueName: string;
  earliestEventDate: string;
  sessionCount: number;
}

export async function listEventSeries(params: PageParams): Promise<Page<EventSeries>> {
  const { data } = await apiClient.get<Page<EventSeries>>("/events/series-summary", { params });
  return data;
}

// 같은 공연(series)의 회차 목록(이른 순).
export async function listSessions(seriesId: string): Promise<EventItem[]> {
  const { data } = await apiClient.get<EventItem[]>(`/events/series/${seriesId}`);
  return data;
}
