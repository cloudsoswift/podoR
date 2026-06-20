"use client";

import { useCallback, useEffect, useState } from "react";
import DataTable, { Column } from "@/components/admin/DataTable";
import Pagination from "@/components/admin/Pagination";
import SearchBar from "@/components/admin/SearchBar";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import EventFormModal from "@/components/admin/EventFormModal";
import {
  createEvent,
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

  // 서버 검색 (제목 부분일치)
  const [keyword, setKeyword] = useState("");
  const [keywordInput, setKeywordInput] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EventItem | null>(null); // null + formOpen = 생성
  const [target, setTarget] = useState<EventItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listEvents({
        page,
        size: PAGE_SIZE,
        keyword: keyword || undefined,
        sort: "createdDate,desc",
      });
      setRows(data.content);
      setTotalPages(data.totalPages);
    } catch {
      setError("이벤트 목록을 불러오지 못했습니다.");
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

  const handleSubmit = async (payload: EventUpdatePayload) => {
    if (editing) {
      await updateEvent(editing.eventId, payload);
    } else {
      await createEvent(payload);
    }
    setFormOpen(false);
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
            onClick={() => {
              setEditing(e);
              setFormOpen(true);
            }}
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
        <div className="flex items-center gap-2">
          <SearchBar
            value={keywordInput}
            onChange={setKeywordInput}
            onSubmit={handleSearch}
            placeholder="제목 검색"
          />
          <button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 cursor-pointer"
          >
            + 이벤트 생성
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(e) => e.eventId}
        loading={loading}
        error={error}
        emptyMessage="이벤트가 없습니다."
      />

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      <EventFormModal
        open={formOpen}
        event={editing}
        onSubmit={handleSubmit}
        onCancel={() => {
          setFormOpen(false);
          setEditing(null);
        }}
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
