/** Compact stat tile for import summary "this period" rows. */
export function PeriodTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
}) {
  const valueClass =
    tone === "negative"
      ? "text-z-debt"
      : tone === "positive"
        ? "text-z-income"
        : "text-z-white";
  return (
    <div className="flex-1 rounded-xl border border-white/6 bg-z-surface-2/80 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
        {label}
      </p>
      <p className={`mt-1.5 text-xl font-bold tabular-nums tracking-tight ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}
