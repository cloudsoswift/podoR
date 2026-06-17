"use client";

import Link from "next/link";

interface StatCardProps {
  label: string;
  value: number | string;
  href?: string;
}

export default function StatCard({ label, value, href }: StatCardProps) {
  const card = (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );

  return href ? <Link href={href}>{card}</Link> : card;
}
