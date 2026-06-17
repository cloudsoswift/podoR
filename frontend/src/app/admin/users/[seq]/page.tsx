"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { AdminUserDetail, deleteUser, getUser } from "@/lib/api/adminUsers";
import { formatDate, formatDateTime } from "@/lib/format";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex border-b border-gray-100 py-3">
      <dt className="w-32 shrink-0 text-sm font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-800">{value ?? "-"}</dd>
    </div>
  );
}

export default function AdminUserDetailPage({ params }: { params: Promise<{ seq: string }> }) {
  const { seq } = use(params);
  const router = useRouter();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const data = await getUser(Number(seq));
        if (active) setUser(data);
      } catch {
        if (active) setError("사용자 정보를 불러오지 못했습니다.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [seq]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteUser(Number(seq));
      router.push("/admin/users");
    } catch {
      setError("삭제에 실패했습니다.");
      setDeleting(false);
      setConfirming(false);
    }
  };

  if (loading) return <p className="text-gray-400">불러오는 중...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link href="/admin/users" className="text-sm text-gray-400 hover:underline">
            ← 사용자 목록
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{user.nickname}</h1>
        </div>
        <button
          onClick={() => setConfirming(true)}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 cursor-pointer"
        >
          삭제
        </button>
      </div>

      <dl className="rounded-2xl border border-gray-200 bg-white px-6 py-2 shadow-sm">
        <Row label="ID" value={user.seq} />
        <Row label="이메일" value={user.email} />
        <Row label="닉네임" value={user.nickname} />
        <Row label="권한" value={user.role} />
        <Row label="가입경로" value={user.provider} />
        <Row label="전화번호" value={user.phone} />
        <Row label="생년월일" value={formatDate(user.birthday)} />
        <Row label="가입일" value={formatDateTime(user.createdAt)} />
        <Row label="수정일" value={formatDateTime(user.updatedAt)} />
        <Row label="삭제일" value={user.deletedAt ? formatDateTime(user.deletedAt) : "-"} />
      </dl>

      <ConfirmDialog
        open={confirming}
        title="사용자 삭제"
        description={`'${user.nickname}'(${user.email}) 사용자를 삭제하시겠습니까?`}
        confirmText="삭제"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
