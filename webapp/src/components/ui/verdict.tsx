import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  ArrowUpRight,
  Check,
  CircleX,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { VerdictState } from "@zeta/shared";

import { cn } from "@/lib/utils";

/**
 * Canonical verdict chip — the ONE component allowed to speak at full volume
 * about status (T1, unification layer). One vocabulary, one slot per screen:
 * eyebrow → number → verdict → detail → meta.
 *
 * - `vas-bien`   — within plan / debt falling / all paid (income token)
 * - `cerca`      — 75–99% of a limit, or pace projects crossing (alert token)
 * - `te-pasaste` — ≥100% or balance grew this month (debt token, the only red)
 * - `atencion`   — user action needed: payment due, sin categoría, data gap (alert token)
 *
 * `cerca` and `atencion` deliberately share the alert token — color carries
 * severity, word + icon carry the reason. Brass never carries a verdict.
 *
 * `VerdictState` is imported from `@zeta/shared` (defined in `utils/ritmo.ts`)
 * rather than redeclared here — one closed vocabulary, shared by webapp and
 * mobile, so the four states can never drift per platform.
 *
 * Full form renders the pill (+ optional delta and detail line). `compact`
 * renders the row form for lists — icon + word only, no pill, no delta/detail.
 */

/** Closed vocabulary — no synonyms, no uppercase. */
const VERDICT_WORDS: Record<VerdictState, string> = {
  "vas-bien": "Vas bien",
  cerca: "Cerca del límite",
  "te-pasaste": "Te pasaste",
  atencion: "Atención",
};

/** One fixed icon per state — meaning never rides color alone. */
const VERDICT_ICONS: Record<VerdictState, LucideIcon> = {
  "vas-bien": Check,
  cerca: ArrowUpRight,
  "te-pasaste": CircleX,
  atencion: TriangleAlert,
};

const verdictVariants = cva("", {
  variants: {
    compact: {
      false:
        "inline-flex h-6 items-center gap-1.5 rounded-full border pl-2 pr-2.5 text-xs leading-none font-semibold whitespace-nowrap",
      true: "inline-flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap",
    },
    state: {
      "vas-bien": "",
      cerca: "",
      "te-pasaste": "",
      atencion: "",
    },
  },
  compoundVariants: [
    { compact: false, state: "vas-bien", className: "surface-income" },
    { compact: false, state: "cerca", className: "surface-alert" },
    { compact: false, state: "te-pasaste", className: "surface-debt" },
    { compact: false, state: "atencion", className: "surface-alert" },
    { compact: true, state: "vas-bien", className: "text-z-income" },
    { compact: true, state: "cerca", className: "text-z-alert" },
    { compact: true, state: "te-pasaste", className: "text-z-debt" },
    { compact: true, state: "atencion", className: "text-z-alert" },
  ],
  defaultVariants: {
    compact: false,
  },
});

interface VerdictProps extends VariantProps<typeof verdictVariants> {
  state: VerdictState;
  /**
   * The one number that justifies the word (e.g. "−$850.000", "79%").
   * Rendered after a "·" separator; callers pass just the value.
   */
  delta?: string;
  /** One sentence answering *why*, rendered under the chip. */
  detail?: React.ReactNode;
  /** Row form for lists — icon + word only. Ignores `delta` and `detail`. */
  compact?: boolean;
  className?: string;
}

function Verdict({
  state,
  delta,
  detail,
  compact = false,
  className,
}: VerdictProps) {
  const word = VERDICT_WORDS[state];
  const Icon = VERDICT_ICONS[state];
  const showDelta = !compact && delta != null;
  const showDetail = !compact && detail != null;

  const chip = (
    <span
      data-slot="verdict"
      data-state={state}
      role="status"
      aria-label={showDelta ? `${word} · ${delta}` : word}
      className={cn(
        verdictVariants({ state, compact }),
        showDetail ? undefined : className,
      )}
    >
      <Icon aria-hidden="true" className="size-3 shrink-0" strokeWidth={2.5} />
      {word}
      {showDelta ? (
        <span className="tabular-nums opacity-85">· {delta}</span>
      ) : null}
    </span>
  );

  if (!showDetail) return chip;

  return (
    <div
      data-slot="verdict-block"
      className={cn("flex flex-col items-start gap-1.5", className)}
    >
      {chip}
      <p className="text-[13px] leading-normal text-z-sage-light">{detail}</p>
    </div>
  );
}

export { Verdict, verdictVariants, VERDICT_WORDS, type VerdictState };
