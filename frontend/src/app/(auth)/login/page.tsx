"use client";

import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function LoginPage() {
  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE_URL}/oauth2/authorization/google`;
  };

  const handleKakaoLogin = () => {
    window.location.href = `${API_BASE_URL}/oauth2/authorization/kakao`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">

      {/* 로고 */}
      <Link href="/" className="text-3xl font-bold text-indigo-600 mb-8">
        podoR
      </Link>

      {/* 카드 */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-4">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-gray-800">로그인</h1>
          <p className="text-sm text-gray-400 mt-1">소셜 계정으로 간편하게 시작하세요</p>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-all active:scale-[0.98] cursor-pointer"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          구글로 계속하기
        </button>

        <button
          onClick={handleKakaoLogin}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#FEE500] text-[#191919] rounded-xl text-sm font-semibold hover:bg-[#FADA0A] transition-all active:scale-[0.98] cursor-pointer"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3c-4.97 0-9 3.185-9 7.115 0 2.553 1.706 4.8 4.27 6.054l-1.085 3.98c-.06.222.082.445.303.483.072.012.145.004.21-.023l4.653-3.125c.212.024.428.036.649.036 4.97 0 9-3.185 9-7.115S16.97 3 12 3z" />
          </svg>
          카카오로 계속하기
        </button>
      </div>

      <p className="mt-6 text-xs text-gray-400">
        로그인 시{" "}
        <Link href="#" className="underline hover:text-gray-600">이용약관</Link>
        {" "}및{" "}
        <Link href="#" className="underline hover:text-gray-600">개인정보처리방침</Link>
        에 동의하는 것으로 간주합니다.
      </p>

    </div>
  );
}
