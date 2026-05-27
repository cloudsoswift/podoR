import ConcertHallCard, { ConcertHall } from "./ConcertHallCard";

export default function ConcertHallList({ halls }: { halls: ConcertHall[] }) {
  return (
    <div className="w-full md:w-3/4 mx-auto space-y-3">
      {halls.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-400 shadow-sm">
          등록된 공연장이 없습니다.
        </div>
      ) : (
        halls.map((hall) => <ConcertHallCard key={hall.seq} hall={hall} />)
      )}
    </div>
  );
}
