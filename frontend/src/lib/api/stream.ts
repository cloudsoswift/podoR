import apiClient from "@/lib/axios";
import { EventItem } from "./events";

export type StreamStatus = "SCHEDULED" | "LIVE" | "INTERRUPTED" | "ENDED";
export type VodStatus = "NONE" | "PROCESSING" | "READY" | "FAILED";

/** 관람 화면 상태. liveUrl 은 LIVE 일 때, vodUrl 은 VOD 가 준비됐을 때만 온다. */
export interface StreamView {
  status: StreamStatus;
  vodStatus: VodStatus;
  liveUrl: string | null;
  vodUrl: string | null;
}

export interface StreamKey {
  streamKey: string;
  rtmpUrl: string;
  status: StreamStatus;
}

// 응답과 함께 /media/ 전용 관람 쿠키가 구워진다(같은 오리진이라 자동 저장).
export async function getStreamView(eventId: string): Promise<StreamView> {
  const { data } = await apiClient.get<StreamView>(`/events/${eventId}/stream`);
  return data;
}

export async function getStreamKey(eventId: string): Promise<StreamKey> {
  const { data } = await apiClient.get<StreamKey>(`/events/${eventId}/stream-key`);
  return data;
}

export async function reissueStreamKey(eventId: string): Promise<StreamKey> {
  const { data } = await apiClient.post<StreamKey>(`/events/${eventId}/stream-key/reissue`);
  return data;
}

export async function endStream(eventId: string): Promise<void> {
  await apiClient.post(`/events/${eventId}/stream/end`);
}

/** 이 공연(series)에서 내가 관람할 수 있는(취소되지 않은 좌석이 있는) 회차 eventId 목록. */
export async function getWatchableEventIds(seriesId: string): Promise<string[]> {
  const { data } = await apiClient.get<string[]>(`/events/series/${seriesId}/watchable`);
  return data;
}

export async function listHostedEvents(): Promise<EventItem[]> {
  const { data } = await apiClient.get<EventItem[]>("/users/me/hosted-events");
  return data;
}
