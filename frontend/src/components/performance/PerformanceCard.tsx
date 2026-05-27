import Link from "next/link";

export interface Performance {
  seq: number;
  performanceId: string;
  title: string;
  performerNickname: string;
  performDate: string;
  performanceType: string;
  streamStatus: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const streamStatusStyle: Record<string, string> = {
  LIVE: "bg-red-100 text-red-600",
  ENDED: "bg-gray-100 text-gray-500",
  SCHEDULED: "bg-green-100 text-green-600",
};

const streamStatusLabel: Record<string, string> = {
  LIVE: "LIVE",
  ENDED: "종료",
  SCHEDULED: "예정",
};

export default function PerformanceCard({ performance }: { performance: Performance }) {
  return (
    <Link
      href={`/performances/${performance.performanceId}`}
      className="flex gap-4 bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="w-14 h-20 bg-gray-100 rounded-lg shrink-0 flex items-center justify-center">
        <svg
          className="w-6 h-6 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        <span className="inline-block text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
          {performance.performanceType}
        </span>
        <p className="font-semibold text-gray-900 truncate">{performance.title}</p>
        <p className="text-sm text-gray-500">{performance.performerNickname}</p>
        <p className="text-sm text-gray-400">{formatDate(performance.performDate)}</p>
      </div>

      <div className="shrink-0 self-center">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${streamStatusStyle[performance.streamStatus] ?? "bg-gray-100 text-gray-500"}`}>
          {streamStatusLabel[performance.streamStatus] ?? performance.streamStatus}
        </span>
      </div>
    </Link>
  );
}
