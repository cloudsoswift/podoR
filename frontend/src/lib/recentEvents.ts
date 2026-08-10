// 최근 조회한 공연 id 를 localStorage 에만 보관(서버 저장 없음).
const KEY = "recent-events";
const MAX = 10;

export function pushRecentEvent(eventId: string): void {
  if (typeof window === "undefined") return;
  try {
    const prev = getRecentEventIds().filter((id) => id !== eventId);
    const next = [eventId, ...prev].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // localStorage 접근 실패는 무시
  }
}

export function getRecentEventIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}
