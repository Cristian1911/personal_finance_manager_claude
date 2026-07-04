import type { Verdict as VerdictData } from "@zeta/shared";
import { Verdict, type VerdictState } from "@/components/ui/verdict";
import { PANEL_INSET_CLASS, SECTION_EYEBROW_CLASS } from "@/lib/constants/styles";

export function VerdictHeader({ verdict }: { verdict: VerdictData }) {
  // Solo la ficha "Tasa de ahorro" puede traer tono negativo o valor faltante:
  // tasa a la baja o sin historial → atención; de resto, vas bien.
  const state: VerdictState = verdict.tiles.some(
    (t) => t.tone === "neg" || t.value === "—",
  )
    ? "atencion"
    : "vas-bien";

  return (
    <div className="mt-3">
      <div className={`${PANEL_INSET_CLASS} flex flex-col gap-1.5 p-3`}>
        <Verdict compact state={state} />
        <div>
          <p className="text-[13px] leading-normal text-z-sage-light">{verdict.headline}</p>
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
