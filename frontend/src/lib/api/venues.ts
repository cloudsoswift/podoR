import apiClient from "@/lib/axios";
import { Page, PageParams } from "./types";

export interface Venue {
  seq: number;
  name: string;
  address: string;
  description: string | null;
  venueImage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VenuePayload {
  name: string;
  address: string;
  description?: string | null;
  venueImage?: string | null;
}

export async function listVenues(params: PageParams): Promise<Page<Venue>> {
  const { data } = await apiClient.get<Page<Venue>>("/venues", { params });
  return data;
}

export async function getVenue(seq: number): Promise<Venue> {
  const { data } = await apiClient.get<Venue>(`/venues/${seq}`);
  return data;
}

export async function createVenue(payload: VenuePayload): Promise<Venue> {
  const { data } = await apiClient.post<Venue>("/venues", payload);
  return data;
}

export async function updateVenue(seq: number, payload: VenuePayload): Promise<Venue> {
  const { data } = await apiClient.put<Venue>(`/venues/${seq}`, payload);
  return data;
}

export async function deleteVenue(seq: number): Promise<void> {
  await apiClient.delete(`/venues/${seq}`);
}
