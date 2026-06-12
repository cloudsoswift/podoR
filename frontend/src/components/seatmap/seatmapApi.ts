import apiClient from "@/lib/axios";
import { Section } from "./types";
import { Seat } from "./seatTypes";
import { compactUsedSeats } from "./seatGeometry";

// 백엔드 좌석 1건. (Seat 엔티티: section/row_number/seat_number/is_available)
export interface SeatmapSeatItem {
  section: string;
  rowNumber: string;
  seatNumber: number;
  isAvailable: boolean;
}

// 섹션 배치 + 좌석을 합친 단일 등록 페이로드.
export interface SeatmapPayload {
  // 섹션 배치(Section[]) 전체를 문자열로 — VenueLayout 에 그대로 저장된다.
  layoutJson: string;
  // 사용 좌석 목록(섹션별로 행 압축·열 결번 규칙 적용).
  seats: SeatmapSeatItem[];
}

export interface SeatmapRegisterResult {
  venueSeq: number;
  layoutSaved: boolean;
  seatCount: number;
}

/**
 * SectionEditor 의 섹션 배치와 SeatEditor 의 섹션별 좌석을 하나의 등록 JSON 으로 합친다.
 * 좌석은 섹션 id 로 보관돼 있으므로, 현재 섹션 목록에서 이름을 찾아 매핑한다.
 * 이미 삭제된 섹션의 좌석은 제외한다.
 */
export function buildSeatmapPayload(
  sections: Section[],
  seatsBySection: Record<string, Seat[]>,
): SeatmapPayload {
  const nameById = new Map(sections.map((s) => [s.id, s.name]));
  const seats: SeatmapSeatItem[] = [];
  for (const [sectionId, sectionSeats] of Object.entries(seatsBySection)) {
    const name = nameById.get(sectionId);
    if (!name) continue; // 삭제된 섹션은 건너뛴다.
    for (const r of compactUsedSeats(sectionSeats)) {
      seats.push({
        section: name,
        rowNumber: r.row,
        seatNumber: r.number,
        isAvailable: true,
      });
    }
  }
  return { layoutJson: JSON.stringify(sections), seats };
}

/** 합친 좌석맵을 백엔드에 등록한다. */
export async function registerSeatmap(
  venueSeq: number,
  payload: SeatmapPayload,
): Promise<SeatmapRegisterResult> {
  const { data } = await apiClient.post<SeatmapRegisterResult>(
    `/venues/${venueSeq}/seatmap`,
    payload,
  );
  return data;
}
