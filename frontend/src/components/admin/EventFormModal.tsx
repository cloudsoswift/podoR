"use client";

import { FormEvent, useEffect, useState } from "react";
import { EventItem, EventUpdatePayload } from "@/lib/api/events";
import { listVenues, Venue } from "@/lib/api/venues";

interface EventFormModalProps {
  open: boolean;
  event: EventItem | null; // null = 생성 모드
  onSubmit: (payload: EventUpdatePayload) => Promise<void>;
  onCancel: () => void;
}

// ISO -> datetime-local 입력값("YYYY-MM-DDTHH:mm")
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventFormModal({ open, event, onSubmit, onCancel }: EventFormModalProps) {
  const isEdit = !!event;
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [eventType, setEventType] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [ticketingDate, setTicketingDate] = useState("");
  const [venueSeq, setVenueSeq] = useState<number | "">("");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // 수정이면 기존 값으로, 생성이면 빈 폼으로 초기화
    setTitle(event?.title ?? "");
    setContent(event?.content ?? "");
    setEventType(event?.eventType ?? "");
    setEventDate(event ? toLocalInput(event.eventDate) : "");
    setTicketingDate(event ? toLocalInput(event.ticketingDate) : "");
    setVenueSeq(event?.venueSeq ?? "");
    setError(null);
    listVenues({ page: 0, size: 200 })
      .then((d) => setVenues(d.content))
      .catch(() => setVenues([]));
  }, [open, event]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !eventType.trim() || !eventDate || !ticketingDate || venueSeq === "") {
      setError("제목, 유형, 일시, 공연장은 필수입니다.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        content: content.trim() || null,
        eventType: eventType.trim(),
        eventDate,
        ticketingDate,
        venueSeq: Number(venueSeq),
      });
    } catch {
      setError("저장에 실패했습니다.");
      setSubmitting(false);
    }
  };

  const field = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-gray-900">{isEdit ? "이벤트 수정" : "이벤트 생성"}</h3>
        {isEdit && (
          <p className="mt-1 text-xs text-gray-400">
            주최자: {event.hostNickname} · 상태: {event.streamStatus ?? "-"}
          </p>
        )}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">제목 *</label>
            <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">유형 *</label>
            <input className={field} value={eventType} onChange={(e) => setEventType(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">공연장 *</label>
            <select
              className={field}
              value={venueSeq}
              onChange={(e) => setVenueSeq(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">선택하세요</option>
              {venues.map((v) => (
                <option key={v.seq} value={v.seq}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">공연 일시 *</label>
              <input
                type="datetime-local"
                className={field}
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">티켓팅 일시 *</label>
              <input
                type="datetime-local"
                className={field}
                value={ticketingDate}
                onChange={(e) => setTicketingDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">내용</label>
            <textarea
              className={`${field} h-28 resize-none`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
