/**
 * 남은 시간 표시. 회차 목록의 오픈 카운트다운, 게이트의 오픈 카운트다운, 남은 입장 시간이 함께 쓴다.
 * 올림으로 계산한다 — 0.4초 남았을 때 00:00 을 보여주면 "열렸는데 왜 안 되지?"가 된다.
 */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  if (days > 0) return `${days}일 ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  if (total >= 3_600) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}
