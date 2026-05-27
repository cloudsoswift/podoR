import PerformanceCard, { Performance } from "./PerformanceCard";

export default function PerformanceList({ performances }: { performances: Performance[] }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">이 공연장의 공연</h2>

      {performances.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-400 shadow-sm">
          예정된 공연이 없습니다.
        </div>
      ) : (
        <ul className="space-y-3">
          {performances.map((perf) => (
            <li key={perf.seq}>
              <PerformanceCard performance={perf} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
