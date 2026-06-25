/** MoM delta pill. Spending UP (pct > 0) = expense tone; DOWN = income tone. */
export function DeltaChip({ pct }: { pct: number }) {
  const up = pct > 0;
  const down = pct < 0;
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
        up ? "bg-z-expense/12 text-z-expense" : down ? "bg-z-income/10 text-z-income" : "text-z-sage-dark"
      }`}
    >
      {up ? "▲" : down ? "▼" : "~"} {Math.abs(Math.round(pct))}%
    </span>
  );
}
