import SectionEditor from "@/components/seatmap/SectionEditor";

export default function SeatMapSandboxPage() {
  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="shrink-0 border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">좌석맵 섹션 에디터</h1>
        <p className="text-xs text-gray-500">
          SVG 기반 섹션 도형 편집 (베지에 곡선 지원) — 데모 / 샌드박스
        </p>
      </header>
      <div className="min-h-0 flex-1">
        <SectionEditor />
      </div>
    </div>
  );
}
