import Link from "next/link";

export interface ConcertHall {
  seq: number;
  name: string;
  address: string;
  description: string | null;
  concertHallImage: string | null;
}

export default function ConcertHallCard({ hall }: { hall: ConcertHall }) {
  return (
    <Link
      href={`/concerthalls/${hall.seq}`}
      className="flex gap-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
    >
      <div className="w-36 shrink-0 bg-gray-100 flex items-center justify-center">
        {hall.concertHallImage ? (
          <img
            src={hall.concertHallImage}
            alt={hall.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <svg
            className="w-10 h-10 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
        )}
      </div>

      <div className="flex-1 min-w-0 py-4 pr-4 space-y-2">
        <p className="font-bold text-gray-900 text-lg">{hall.name}</p>
        <p className="flex items-start gap-1.5 text-sm text-gray-500">
          <svg
            className="w-4 h-4 shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          {hall.address}
        </p>
        {hall.description && (
          <p className="text-sm text-gray-400 line-clamp-2">{hall.description}</p>
        )}
      </div>
    </Link>
  );
}
