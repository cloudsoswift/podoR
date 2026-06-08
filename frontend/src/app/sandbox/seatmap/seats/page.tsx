import SeatEditor from "@/components/seatmap/SeatEditor";

export default function SeatEditorSandboxPage() {
  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="shrink-0 border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">좌석맵 좌석 에디터</h1>
        <p className="text-xs text-gray-500">
          섹션 경계 안에 격자로 좌석을 자동 생성하고 개별 편집 — 데모 / 샌드박스.
          (오른쪽 패널에서 SectionEditor 의 Section JSON 을 경계로 불러올 수 있습니다.)
        </p>
      </header>
      <div className="min-h-0 flex-1">
        <SeatEditor />
      </div>
    </div>
  );
}
