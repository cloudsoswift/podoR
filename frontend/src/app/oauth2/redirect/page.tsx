"use client";

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import apiClient from '@/lib/axios';
import { safeRedirectPath } from '@/lib/redirect';

const OAuth2RedirectHandler = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAccessToken, setUser } = useAuthStore();

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');

    if (!accessToken) {
      console.error('Tokens are missing in the redirect URL');
      router.push('/login');
      return;
    }

    // 로그인 전에 있던 페이지. BE 가 검증해 보냈더라도 이 URL 은 누구나 조립할 수 있으므로 다시 검증한다.
    const redirect = safeRedirectPath(searchParams.get('redirect')) ?? '/';

    setAccessToken(accessToken);

    apiClient.get('/users/me')
      .then((res) => {
        setUser(res.data);
        // replace: 토큰이 담긴 이 주소를 방문 기록에 남기지 않는다.
        router.replace(redirect);
      })
      .catch(() => {
        router.push('/login');
      });
  }, [searchParams, router, setAccessToken, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
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
