"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DataTable, { Column } from "@/components/admin/DataTable";
import Pagination from "@/components/admin/Pagination";
import SearchBar from "@/components/admin/SearchBar";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { AdminUserListItem, deleteUser, listUsers } from "@/lib/api/adminUsers";
import { formatDateTime } from "@/lib/format";

const PAGE_SIZE = 10;

export default function AdminUsersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<AdminUserListItem[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [target, setTarget] = useState<AdminUserListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listUsers({
        page,
        size: PAGE_SIZE,
        keyword: keyword || undefined,
        sort: "createdAt,desc",
      });
      setRows(data.content);
      setTotalPages(data.totalPages);
    } catch {
      setError("사용자 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [page, keyword]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = () => {
    setPage(0);
    setKeyword(keywordInput.trim());
  };

  const handleDelete = async () => {
    if (!target) return;
    setDeleting(true);
    try {
      await deleteUser(target.seq);
      setTarget(null);
      await load();
    } catch {
      setError("삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<AdminUserListItem>[] = [
    { key: "seq", header: "ID", className: "w-16" },
    { key: "email", header: "이메일" },
    { key: "nickname", header: "닉네임" },
    {
      key: "role",
      header: "권한",
      render: (u) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            u.role === "ADMIN" ? "bg-indigo-50 text-indigo-700" : "bg-gray-100 text-gray-600"
          }`}
        >
          {u.role}
        </span>
      ),
    },
    { key: "provider", header: "가입경로" },
    { key: "createdAt", header: "가입일", render: (u) => formatDateTime(u.createdAt) },
    {
      key: "actions",
      header: "",
      className: "w-20 text-right",
      render: (u) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setTarget(u);
          }}
          className="text-sm font-medium text-red-600 hover:underline cursor-pointer"
        >
          삭제
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">사용자 관리</h1>
        <SearchBar
          value={keywordInput}
          onChange={setKeywordInput}
          onSubmit={handleSearch}
          placeholder="이메일 / 닉네임 검색"
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(u) => u.seq}
        loading={loading}
        error={error}
        emptyMessage="사용자가 없습니다."
        onRowClick={(u) => router.push(`/admin/users/${u.seq}`)}
      />

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      <ConfirmDialog
        open={!!target}
        title="사용자 삭제"
        description={target ? `'${target.nickname}'(${target.email}) 사용자를 삭제하시겠습니까?` : ""}
        confirmText="삭제"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}
