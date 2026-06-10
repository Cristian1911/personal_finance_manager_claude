import { cn } from "@/lib/utils";

const TONE_STROKE = {
  brass: "stroke-z-brass",
  income: "stroke-z-income",
  debt: "stroke-z-debt",
} as const;

const TONE_TEXT = {
  brass: "text-z-brass",
  income: "text-z-income",
  debt: "text-z-debt",
} as const;

/** 44px circular progress ring with centered content (deudas tiles/cards). */
export function ProgressRing({
  pct,
  tone = "brass",
  children,
}: {
  /** 0–100 */
  pct: number;
  tone?: keyof typeof TONE_STROKE;
  children: React.ReactNode;
}) {
  const r = 16;
  const circumference = 2 * Math.PI * r;
  // NaN (missing limit / division by zero upstream) renders as empty ring.
  const clamped = Number.isNaN(pct) ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <div className="relative shrink-0" style={{ width: 44, height: 44 }}>
      <svg width="44" height="44" viewBox="0 0 40 40" className="-rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" className="stroke-white/6" strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          className={TONE_STROKE[tone]}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          strokeLinecap="round"
        />
      </svg>
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center text-[10px] font-bold",
          TONE_TEXT[tone]
        )}
      >
        {children}
      </div>
    </div>
  );
}
