interface Props {
  x: number;
  y: number;
  r: number;
  fill: string;
  fillOpacity?: number;
  stroke: string;
  strokeWidth: number;
  // 있으면 툴팁(<title>)과 접근 가능한 이름이 된다.
  label?: string;
  // 없으면 포인터를 받지 않는다(에디터는 캔버스에서 히트 테스트).
  onClick?: () => void;
  disabled?: boolean;
}

/** 좌석 하나(원). 에디터·예매 화면이 같은 모양으로 그리도록 공유한다. */
export default function SeatDot({
  x,
  y,
  r,
  fill,
  fillOpacity,
  stroke,
  strokeWidth,
  label,
  onClick,
  disabled = false,
}: Props) {
  const interactive = !!onClick;
  return (
    <circle
      cx={x}
      cy={y}
      r={r}
      fill={fill}
      fillOpacity={fillOpacity}
      stroke={stroke}
      strokeWidth={strokeWidth}
      role={interactive ? "button" : undefined}
      aria-label={interactive ? label : undefined}
      aria-disabled={interactive && disabled ? true : undefined}
      tabIndex={interactive ? (disabled ? -1 : 0) : undefined}
      onClick={interactive && !disabled ? onClick : undefined}
      onKeyDown={
        interactive && !disabled
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        pointerEvents: interactive ? "auto" : "none",
        cursor: interactive ? (disabled ? "not-allowed" : "pointer") : undefined,
      }}
    >
      {label && <title>{label}</title>}
    </circle>
  );
}
