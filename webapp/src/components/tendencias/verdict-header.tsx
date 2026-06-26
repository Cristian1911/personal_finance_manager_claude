import { TrendingUp } from "lucide-react";
import type { Verdict } from "@zeta/shared";
import { PANEL_INSET_CLASS, SECTION_EYEBROW_CLASS } from "@/lib/constants/styles";

export function VerdictHeader({ verdict }: { verdict: Verdict }) {
  return (
    <div className="mt-3">
      {/* Brass accent callout — intentionally not a Tier-1/2/3 card (highlighted verdict surface). */}
      <div className="flex items-center gap-3 rounded-2xl border border-z-brass/25 bg-z-brass/8 p-3">
        <TrendingUp className="size-4 shrink-0 text-z-brass" />
        <div>
          <p className="text-sm font-semibold">{verdict.headline}</p>
          {verdict.sub && <p className="text-xs text-z-sage-dark">{verdict.sub}</p>}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {verdict.tiles.map((t) => (
          <div key={t.label} className={`${PANEL_INSET_CLASS} min-w-0 p-3`}>
            <p className={`${SECTION_EYEBROW_CLASS} break-words`}>{t.label}</p>
            <p className="mt-1 min-w-0 text-base font-bold tabular-nums sm:text-lg">{t.value}</p>
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
