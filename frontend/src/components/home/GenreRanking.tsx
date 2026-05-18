"use client";

import { useState } from "react";

const GENRES = ["뮤지컬", "콘서트", "연극", "전시/행사", "스포츠"];

const MOCK_RANKINGS = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  title: `공연 제목 ${i + 1}`,
  venue: "공연장명",
  period: "2026.06.01 ~ 2026.08.31",
}));

export default function GenreRanking() {
  const [activeGenre, setActiveGenre] = useState(0);

  return (
    <section>
      <h2 className="text-xl font-bold mb-4">장르별 랭킹</h2>
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {GENRES.map((genre, i) => (
          <button
            key={i}
            onClick={() => setActiveGenre(i)}
            className={`pb-3 px-1 text-sm font-medium transition-colors ${
              activeGenre === i
                ? "border-b-2 border-indigo-600 text-indigo-600"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {genre}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {MOCK_RANKINGS.map((item, i) => (
          <div key={item.id} className="flex gap-3 items-start cursor-pointer group">
            <span className="text-2xl font-bold text-gray-300 w-7 shrink-0">{i + 1}</span>
            <div className="flex gap-3 flex-1">
              <div className="w-16 h-20 bg-gray-200 rounded-lg shrink-0 group-hover:opacity-80 transition-opacity" />
              <div className="flex flex-col justify-center gap-1">
                <p className="text-sm font-semibold leading-tight line-clamp-2">{item.title}</p>
                <p className="text-xs text-gray-400">{item.venue}</p>
                <p className="text-xs text-gray-400">{item.period}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
