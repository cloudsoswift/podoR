import apiClient from "@/lib/axios";
import { Section } from "./types";
import { Seat } from "./seatTypes";
import { allSeatsForSave } from "./seatGeometry";

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
  // 사용 좌석 목록(섹션별로 행 압축·열 결번 규칙 적용) — Seat 테이블 평면 투영.
  seats: SeatmapSeatItem[];
}

export interface SeatmapRegisterResult {
  venueSeq: number;
  layoutSaved: boolean;
  seatCount: number;
}

// 에디터 작업 문서(전략 C): 섹션 배치 + 섹션별 좌석을 함께 보관해 100% 복원한다.
export interface SeatmapDoc {
  version: 1;
  sections: Section[];
  seatsBySection: Record<string, Seat[]>;
}

/**
 * SectionEditor 의 섹션 배치와 SeatEditor 의 섹션별 좌석을 하나의 등록 JSON 으로 합친다.
 * - layoutJson: 에디터 작업 문서(SeatmapDoc) 전체를 직렬화(섹션+좌석) → 재진입 시 복원용.
 * - seats: 사용 좌석만 평면화(섹션 이름 기준) → 티켓팅용 Seat 테이블 투영.
 * 이미 삭제된 섹션의 좌석은 seats 투영에서 제외한다.
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
    for (const r of allSeatsForSave(sectionSeats)) {
      seats.push({
        section: name,
        rowNumber: r.row,
        seatNumber: r.number,
        isAvailable: r.available, // 비가용 좌석도 isAvailable=false 로 저장
      });
    }
  }
  const doc: SeatmapDoc = { version: 1, sections, seatsBySection };
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
 * layoutJson 을 에디터 상태로 파싱한다.
 * - 새 포맷({ version, sections, seatsBySection }) → 섹션+좌석 복원.
 * - 레거시(바로 Section[] 배열) → 섹션만 복원, 좌석은 빈 값.
 * - null/파싱 실패 → 빈 에디터.
 */
export function parseSeatmapDoc(layoutJson: string | null): {
  sections: Section[];
  seatsBySection: Record<string, Seat[]>;
} {
  if (!layoutJson) return { sections: [], seatsBySection: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(layoutJson);
  } catch {
    return { sections: [], seatsBySection: {} };
  }
  if (Array.isArray(parsed)) {
    // 레거시: layoutJson 이 Section[] 배열이던 시절.
    return { sections: parsed as Section[], seatsBySection: {} };
  }
  if (parsed && typeof parsed === "object" && "sections" in parsed) {
    const doc = parsed as Partial<SeatmapDoc>;
    return {
      sections: doc.sections ?? [],
      seatsBySection: doc.seatsBySection ?? {},
    };
  }
  return { sections: [], seatsBySection: {} };
}
