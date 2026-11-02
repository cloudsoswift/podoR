"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import apiClient from "@/lib/axios";

type Status = "checking" | "allowed" | "denied";

interface MeResponse {
  email: string;
  nickname: string;
  profileImage: string | null;
  role: string;
}

/** 역할로 막는 페이지. 클라이언트 store 가 아니라 서버(/users/me)의 role 로 판정한다. */
export default function RoleGuard({ roles, children }: { roles: string[]; children: ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const [status, setStatus] = useState<Status>("checking");
  const rolesKey = roles.join(",");

  useEffect(() => {
    let active = true;

    async function check() {
      if (!accessToken) {
        router.replace("/login");
        return;
      }
      try {
        // 항상 서버 기준 role 로 검증 (클라이언트 store 는 UX 용)
        const { data } = await apiClient.get<MeResponse>("/users/me");
        if (!active) return;
        setUser(data);
        setStatus(rolesKey.split(",").includes(data.role) ? "allowed" : "denied");
      } catch {
        if (active) setStatus("denied");
      }
    }

    check();
    return () => {
      active = false;
    };
    // accessToken 변경 시에만 재검증
  }, [accessToken, router, setUser, rolesKey]);

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400">
        권한 확인 중...
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-lg font-semibold text-gray-900">접근 권한이 없습니다.</p>
        <p className="text-sm text-gray-500">{roles.join("·")}만 이용할 수 있는 페이지입니다.</p>
        <Link
          href="/"
          className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          홈으로
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
