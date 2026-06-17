"use client";

interface PaginationProps {
  page: number; // 0-based
  totalPages: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const btn =
    "px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer";

  return (
    <div className="flex items-center justify-center gap-2 pt-4">
      <button className={btn} onClick={() => onChange(page - 1)} disabled={page <= 0}>
        이전
      </button>
      <span className="text-sm text-gray-600">
        {page + 1} / {totalPages}
      </span>
      <button
        className={btn}
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages - 1}
      >
        다음
      </button>
    </div>
  );
}
