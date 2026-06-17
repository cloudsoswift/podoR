"use client";

import { FormEvent, useEffect, useState } from "react";
import { Venue, VenuePayload } from "@/lib/api/venues";

interface VenueFormModalProps {
  open: boolean;
  initial?: Venue | null; // null/undefined 면 생성 모드
  onSubmit: (payload: VenuePayload) => Promise<void>;
  onCancel: () => void;
}

const emptyForm: VenuePayload = {
  name: "",
  address: "",
  description: "",
  venueImage: "",
};

export default function VenueFormModal({ open, initial, onSubmit, onCancel }: VenueFormModalProps) {
  const [form, setForm] = useState<VenuePayload>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? {
              name: initial.name,
              address: initial.address,
              description: initial.description ?? "",
              venueImage: initial.venueImage ?? "",
            }
          : emptyForm
      );
      setError(null);
    }
  }, [open, initial]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.address.trim()) {
      setError("이름과 주소는 필수입니다.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        name: form.name.trim(),
        address: form.address.trim(),
        description: form.description?.trim() || null,
        venueImage: form.venueImage?.trim() || null,
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
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-gray-900">
          {initial ? "공연장 수정" : "공연장 추가"}
        </h3>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">이름 *</label>
            <input
              className={field}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">주소 *</label>
            <input
              className={field}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">설명</label>
            <textarea
              className={`${field} h-24 resize-none`}
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">이미지 URL</label>
            <input
              className={field}
              value={form.venueImage ?? ""}
              onChange={(e) => setForm({ ...form, venueImage: e.target.value })}
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
