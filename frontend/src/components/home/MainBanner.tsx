export default function MainBanner() {
  return (
    <section className="relative w-full h-72 md:h-96 bg-gray-200 rounded-2xl overflow-hidden flex items-center justify-center">
      <span className="text-gray-400 text-lg">메인 배너 슬라이더</span>
      <div className="absolute bottom-4 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`w-2 h-2 rounded-full ${i === 0 ? "bg-white" : "bg-white/40"}`} />
        ))}
      </div>
    </section>
  );
}
