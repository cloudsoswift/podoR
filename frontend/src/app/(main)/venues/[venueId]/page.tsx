"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import apiClient from "@/lib/axios";
import { Venue } from "@/components/venue/VenueCard";
import VenueInfo from "@/components/venue/VenueInfo";
import { Event } from "@/components/event/EventCard";
import EventList from "@/components/event/EventList";

export default function VenueDetailPage() {
  const { venueId } = useParams<{ venueId: string }>();

  const [venue, setVenue] = useState<Venue | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [venueRes, eventsRes] = await Promise.all([
          apiClient.get(`/venues/${venueId}`),
          apiClient.get(`/venues/${venueId}/events`),
        ]);
        setVenue(venueRes.data);
        setEvents(eventsRes.data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [venueId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-60 text-gray-400">
        불러오는 중...
      </div>
    );
  }

  if (error || !venue) {
    return (
      <div className="flex justify-center items-center h-60 text-gray-400">
        공연장 정보를 불러올 수 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <VenueInfo venue={venue} />
      <EventList events={events} />
    </div>
  );
}
