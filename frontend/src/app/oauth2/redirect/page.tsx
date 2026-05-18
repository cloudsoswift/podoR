"use client";

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const OAuth2RedirectHandler = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const access_token = searchParams.get('accessToken');

    if (access_token) {
      // 토큰을 로컬 스토리지에 저장
      localStorage.setItem('access_token', access_token);
      
      window.history.replaceState({}, '', '/');
      
      // 메인 페이지나 대시보드로 리다이렉트
      router.push('/');
    } else {
      console.error('Tokens are missing in the redirect URL');
      // 에러 발생 시 로그인 페이지로 다시 이동
      router.push('/login');
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-lg font-medium text-gray-700">로그인 처리 중입니다...</p>
      </div>
    </div>
  );
};

export default function OAuth2RedirectPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OAuth2RedirectHandler />
    </Suspense>
  );
}
