import apiClient from "@/lib/axios";
import { Section } from "./types";
import { SeatRow } from "./seatTypes";
import { rowSeats } from "./rowGeometry";

// 백엔드 좌석 1건. (Seat 엔티티: section/row_number/seat_number/is_available)
export interface SeatmapSeatItem {
  section: string;
  rowNumber: string;
  seatNumber: number;
  isAvailable: boolean;
}

// 섹션 배치 + 좌석을 합친 단일 등록 페이로드.
export interface SeatmapPayload {
  // 에디터 작업 문서(SeatmapDoc) 직렬화 문자열 — VenueLayout 에 그대로 저장된다.
  layoutJson: string;
  // 번호가 있는 좌석 목록(줄에서 계산) — Seat 테이블 평면 투영.
  seats: SeatmapSeatItem[];
}

export interface SeatmapRegisterResult {
  venueSeq: number;
  layoutSaved: boolean;
  seatCount: number;
}

// 에디터 작업 문서: 섹션 배치 + 섹션별 줄을 함께 보관해 그대로 복원한다.
// 좌석 좌표·번호는 저장하지 않고 줄에서 계산한다(rowGeometry).
export interface SeatmapDoc {
  version: 1;
  sections: Section[];
  rowsBySection: Record<string, SeatRow[]>;
}

/**
 * 같은 이름을 가진 섹션 이름 목록(중복분만).
 * 좌석은 섹션 '이름'으로 저장되므로(seat.section), 서로 다른 섹션이 같은 이름이면
 * 좌석 키(section,row,seat)가 충돌해 백엔드 seat_unique 제약을 위반한다. 저장 전 차단용.
 */
export function findDuplicateSectionNames(sections: Section[]): string[] {
  const counts = new Map<string, number>();
  for (const s of sections) counts.set(s.name, (counts.get(s.name) ?? 0) + 1);
  return [...counts.entries()].filter(([, n]) => n > 1).map(([name]) => name);
}

/**
 * SectionEditor 의 섹션 배치와 줄 에디터의 섹션별 줄을 하나의 등록 JSON 으로 합친다.
 * - layoutJson: 에디터 작업 문서(SeatmapDoc) → 재진입·예매 화면 복원용.
 * - seats: 줄에서 계산한 좌석 중 번호가 있는 것(섹션 이름·줄 이름·번호) → Seat 테이블 투영.
 *   번호 있는 사용 안 함 좌석은 isAvailable=false, 번호 없는 좌석(건너뛰기)은 보내지 않는다.
 * 이미 삭제된 섹션의 줄은 둘 다에서 뺀다.
 */
export function buildSeatmapPayload(
  sections: Section[],
  rowsBySection: Record<string, SeatRow[]>,
): SeatmapPayload {
  const seats: SeatmapSeatItem[] = [];
  const kept: Record<string, SeatRow[]> = {};
  for (const sec of sections) {
    const rows = rowsBySection[sec.id];
    if (!rows) continue;
    kept[sec.id] = rows;
    for (const row of rows) {
      for (const s of rowSeats(row)) {
        if (s.number === null) continue;
        seats.push({ section: sec.name, rowNumber: row.name.trim(), seatNumber: s.number, isAvailable: s.available });
      }
    }
  }
  const doc: SeatmapDoc = { version: 1, sections, rowsBySection: kept };
  return { layoutJson: JSON.stringify(doc), seats };
}

/** 합친 좌석맵을 백엔드에 등록(upsert)한다. */
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

// 기존 GET /venues/{seq}/layout 응답(미등록 venue 는 layoutJson=null).
interface VenueLayoutResponse {
  seq: number | null;
  venueSeq: number;
  layoutJson: string | null;
}

/** 저장된 layoutJson 을 불러온다(없으면 null). */
export async function getVenueLayout(venueSeq: number): Promise<string | null> {
  const { data } = await apiClient.get<VenueLayoutResponse>(
    `/venues/${venueSeq}/layout`,
  );
  return data.layoutJson ?? null;
}

/**
 * layoutJson 을 섹션 + 섹션별 줄로 읽는다.
 * sections 가 있는 객체만 문서로 보고, 그 외(null·파싱 실패 등)는 빈 값. 줄이 없으면 {}.
 */
export function parseSeatmapDoc(layoutJson: string | null): Omit<SeatmapDoc, "version"> {
  const empty = { sections: [], rowsBySection: {} };
  if (!layoutJson) return empty;
  let parsed: unknown;
  try {
    parsed = JSON.parse(layoutJson);
  } catch {
    return empty;
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "sections" in parsed) {
    const doc = parsed as Partial<SeatmapDoc>;
    return { sections: doc.sections ?? [], rowsBySection: doc.rowsBySection ?? {} };
  }
  return empty;
}
