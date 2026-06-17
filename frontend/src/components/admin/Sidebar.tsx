"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin", label: "개요", exact: true },
  { href: "/admin/users", label: "사용자 관리" },
  { href: "/admin/venues", label: "공연장 관리" },
  { href: "/admin/events", label: "이벤트 관리" },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="px-6 py-5">
        <Link href="/admin" className="text-xl font-bold text-indigo-600">
          podoR Admin
        </Link>
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive(item.href, item.exact)
                ? "bg-indigo-50 text-indigo-700"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto px-3 py-4">
        <Link
          href="/"
          className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:bg-gray-50"
        >
          ← 서비스로 돌아가기
        </Link>
      </div>
    </aside>
  );
}
