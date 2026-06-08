import SeatmapStudio from "@/components/seatmap/SeatmapStudio";

export default function SeatMapSandboxPage() {
  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="shrink-0 border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">좌석맵 에디터</h1>
        <p className="text-xs text-gray-500">
          섹션 도형을 그리고, 섹션을 선택해 &lsquo;좌석 편집&rsquo;으로 들어가면 좌석맵을
          편집합니다 — 데모 / 샌드박스
        </p>
      </header>
      <div className="min-h-0 flex-1">
        <SeatmapStudio />
      </div>
    </div>
  );
}
