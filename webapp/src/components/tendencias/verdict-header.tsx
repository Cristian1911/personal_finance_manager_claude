import type { Verdict } from "@zeta/shared";

export function VerdictHeader({ verdict }: { verdict: Verdict }) {
  return (
    <div className="mt-3">
      <div className="flex items-center gap-3 rounded-2xl border border-z-brass/25 bg-z-brass/8 p-3">
        <span className="text-lg">📈</span>
        <div>
          <p className="text-sm font-semibold">{verdict.headline}</p>
          {verdict.sub && <p className="text-xs text-z-sage-dark">{verdict.sub}</p>}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {verdict.tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-white/6 bg-black/10 p-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-z-sage-dark">{t.label}</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{t.value}</p>
            {t.deltaLabel && (
              <p
                className={`mt-0.5 text-[10px] font-semibold ${
                  t.tone === "pos" ? "text-z-income" : t.tone === "neg" ? "text-z-expense" : "text-z-sage-dark"
                }`}
              >
                {t.deltaLabel}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
