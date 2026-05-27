import EventCard, { Event } from "./EventCard";

export default function EventList({ events }: { events: Event[] }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">이 공연장의 공연</h2>

      {events.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-400 shadow-sm">
          예정된 공연이 없습니다.
        </div>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => (
            <li key={event.seq}>
              <EventCard event={event} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
