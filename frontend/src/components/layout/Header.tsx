"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import apiClient from "@/lib/axios";

const buttonClass =
  "text-sm font-medium px-4 py-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer";

export default function Header() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  // persist 상태는 클라이언트에서 마운트 후 복원되므로, SSR 결과와
  // 일치시키기 위해 마운트 전에는 로그아웃 상태로 렌더링
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isLoggedIn = mounted && !!accessToken;

  const handleLogout = async () => {
    try {
      // 서버에서 refresh_token 쿠키 만료 처리
      await apiClient.post("/oauth2/logout");
    } catch {
      // 서버 호출이 실패해도 클라이언트 인증 상태는 정리한다
    } finally {
      clearAuth();
      router.push("/");
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-2xl font-bold text-indigo-600">podoR</Link>
          <nav className="hidden md:flex gap-6 text-sm font-medium text-gray-600">
            <Link href="/" className="hover:text-indigo-600">홈</Link>
            <Link href="#" className="hover:text-indigo-600">장르별</Link>
            <Link href="#" className="hover:text-indigo-600">랭킹</Link>
            <Link href="#" className="hover:text-indigo-600">할인</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center bg-gray-100 rounded-full px-4 py-2 gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input className="bg-transparent text-sm outline-none w-40" placeholder="공연명, 아티스트 검색" />
          </div>
          {isLoggedIn && user && (
            <span className="text-sm font-medium text-gray-700">
              {user.nickname}님 환영합니다!
            </span>
          )}
          {isLoggedIn ? (
            <button onClick={handleLogout} className={buttonClass}>
              로그아웃
            </button>
          ) : (
            <Link href="/login" className={buttonClass}>
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
