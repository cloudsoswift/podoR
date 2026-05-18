import Link from "next/link";

const MOCK_DEALS = Array.from({ length: 4 }, (_, i) => ({
  id: i + 1,
  title: `할인 공연 ${i + 1}`,
  discount: `${(i + 1) * 10}%`,
  price: `${(5 - i) * 10000}원`,
}));

export default function DealsSection() {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">지금 할인중!</h2>
        <Link href="#" className="text-sm text-gray-400 hover:text-indigo-600">전체보기 →</Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {MOCK_DEALS.map((item) => (
          <div key={item.id} className="bg-white rounded-xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow">
            <div className="w-full h-36 bg-gray-200 relative">
              <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {item.discount}
              </span>
            </div>
            <div className="p-3">
              <p className="text-sm font-semibold line-clamp-1">{item.title}</p>
              <p className="text-sm text-indigo-600 font-bold mt-1">{item.price}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
