export default function MiniBannerCards() {
  return (
    <section>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex-shrink-0 w-[40%] md:flex-1 h-48 bg-gray-200 rounded-xl flex items-end p-3 cursor-pointer hover:scale-105 transition-transform">
            <span className="text-xs text-gray-500">공연 {i + 1}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
