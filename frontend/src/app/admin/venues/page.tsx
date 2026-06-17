"use client";

import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import DataTable, { Column } from "@/components/admin/DataTable";
import Pagination from "@/components/admin/Pagination";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import VenueFormModal from "@/components/admin/VenueFormModal";
import {
  createVenue,
  deleteVenue,
  listVenues,
  updateVenue,
  Venue,
  VenuePayload,
} from "@/lib/api/venues";
import { formatDateTime } from "@/lib/format";

const PAGE_SIZE = 10;

export default function AdminVenuesPage() {
  const [rows, setRows] = useState<Venue[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Venue | null>(null);
  const [target, setTarget] = useState<Venue | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listVenues({ page, size: PAGE_SIZE, sort: "createdAt,desc" });
      setRows(data.content);
      setTotalPages(data.totalPages);
    } catch {
      setError("공연장 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (payload: VenuePayload) => {
    if (editing) {
      await updateVenue(editing.seq, payload);
    } else {
      await createVenue(payload);
    }
    setFormOpen(false);
    setEditing(null);
    await load();
  };

  const handleDelete = async () => {
    if (!target) return;
    setDeleting(true);
    setActionError(null);
    try {
      await deleteVenue(target.seq);
      setTarget(null);
      await load();
    } catch (e) {
      // 연결된 이벤트가 있으면 백엔드가 409 반환
      if (axios.isAxiosError(e) && e.response?.status === 409) {
        setActionError("연결된 이벤트가 있어 삭제할 수 없습니다. 이벤트를 먼저 정리해 주세요.");
      } else {
        setActionError("삭제에 실패했습니다.");
      }
      setTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<Venue>[] = [
    { key: "seq", header: "ID", className: "w-16" },
    { key: "name", header: "이름" },
    { key: "address", header: "주소" },
    { key: "createdAt", header: "등록일", render: (v) => formatDateTime(v.createdAt) },
    {
      key: "actions",
      header: "",
      className: "w-32 text-right",
      render: (v) => (
        <div className="flex justify-end gap-3">
          <button
            onClick={() => {
              setEditing(v);
              setFormOpen(true);
            }}
            className="text-sm font-medium text-indigo-600 hover:underline cursor-pointer"
          >
            수정
          </button>
          <button
            onClick={() => setTarget(v)}
            className="text-sm font-medium text-red-600 hover:underline cursor-pointer"
          >
            삭제
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">공연장 관리</h1>
        <button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 cursor-pointer"
        >
          + 공연장 추가
        </button>
      </div>

      {actionError && (
        <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{actionError}</div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(v) => v.seq}
        loading={loading}
        error={error}
        emptyMessage="등록된 공연장이 없습니다."
      />

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      <VenueFormModal
        open={formOpen}
        initial={editing}
        onSubmit={handleSubmit}
        onCancel={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={!!target}
        title="공연장 삭제"
        description={target ? `'${target.name}' 공연장을 삭제하시겠습니까?` : ""}
        confirmText="삭제"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}
