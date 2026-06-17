"use client";

import { FormEvent } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
}

export default function SearchBar({ value, onChange, onSubmit, placeholder }: SearchBarProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "검색"}
        className="w-64 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
      />
      <button
        type="submit"
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 cursor-pointer"
      >
        검색
      </button>
    </form>
  );
}
