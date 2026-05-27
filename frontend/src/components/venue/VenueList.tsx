import VenueCard, { Venue } from "./VenueCard";

export default function VenueList({ venues }: { venues: Venue[] }) {
  return (
    <div className="w-full md:w-3/4 mx-auto space-y-3">
      {venues.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-400 shadow-sm">
          등록된 공연장이 없습니다.
        </div>
      ) : (
        venues.map((venue) => <VenueCard key={venue.seq} venue={venue} />)
      )}
    </div>
  );
}
