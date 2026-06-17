"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DataTable, { Column } from "@/components/admin/DataTable";
import Pagination from "@/components/admin/Pagination";
import SearchBar from "@/components/admin/SearchBar";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import EventEditModal from "@/components/admin/EventEditModal";
import {
  deleteEvent,
  EventItem,
  EventUpdatePayload,
  listEvents,
  updateEvent,
} from "@/lib/api/events";
import { formatDateTime } from "@/lib/format";

const PAGE_SIZE = 10;

export default function AdminEventsPage() {
  const [rows, setRows] = useState<EventItem[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 클라이언트 측 제목 필터 (현재 페이지 한정)
  const [keyword, setKeyword] = useState("");
  const [keywordInput, setKeywordInput] = useState("");

  const [editing, setEditing] = useState<EventItem | null>(null);
  const [target, setTarget] = useState<EventItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listEvents({ page, size: PAGE_SIZE, sort: "createdDate,desc" });
      setRows(data.content);
      setTotalPages(data.totalPages);
    } catch {
      setError("이벤트 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = useMemo(() => {
    if (!keyword) return rows;
    const kw = keyword.toLowerCase();
    return rows.filter((e) => e.title.toLowerCase().includes(kw));
  }, [rows, keyword]);

  const handleSubmit = async (payload: EventUpdatePayload) => {
    if (!editing) return;
    await updateEvent(editing.eventId, payload);
    setEditing(null);
    await load();
  };

  const handleDelete = async () => {
    if (!target) return;
    setDeleting(true);
    try {
      await deleteEvent(target.eventId);
      setTarget(null);
      await load();
    } catch {
      setError("삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<EventItem>[] = [
    { key: "title", header: "제목" },
    { key: "eventType", header: "유형" },
    { key: "venueName", header: "공연장" },
    { key: "hostNickname", header: "주최자" },
    { key: "eventDate", header: "공연일시", render: (e) => formatDateTime(e.eventDate) },
    {
      key: "streamStatus",
      header: "상태",
      render: (e) => e.streamStatus ?? "-",
    },
    {
      key: "actions",
      header: "",
      className: "w-32 text-right",
      render: (e) => (
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setEditing(e)}
            className="text-sm font-medium text-indigo-600 hover:underline cursor-pointer"
          >
            수정
          </button>
          <button
            onClick={() => setTarget(e)}
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
        <h1 className="text-2xl font-bold text-gray-900">이벤트 관리</h1>
        <SearchBar
          value={keywordInput}
          onChange={setKeywordInput}
          onSubmit={() => setKeyword(keywordInput.trim())}
          placeholder="제목 검색 (현재 페이지)"
        />
      </div>

      <DataTable
        columns={columns}
        rows={filteredRows}
        rowKey={(e) => e.eventId}
        loading={loading}
        error={error}
        emptyMessage="이벤트가 없습니다."
      />

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      <EventEditModal
        open={!!editing}
        event={editing}
        onSubmit={handleSubmit}
        onCancel={() => setEditing(null)}
      />

      <ConfirmDialog
        open={!!target}
        title="이벤트 삭제"
        description={target ? `'${target.title}' 이벤트를 삭제하시겠습니까?` : ""}
        confirmText="삭제"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}
