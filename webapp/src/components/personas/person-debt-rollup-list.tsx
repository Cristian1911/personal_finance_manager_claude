"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { PANEL_INSET_CLASS, SECTION_EYEBROW_CLASS } from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
import { HeaderChevron } from "@/components/mobile/v2/header-chevron";
import { Expand } from "@/components/mobile/v2/expand";
import { PersonAvatar } from "./person-avatar";
import {
  BALANCE_TONE_CLASS,
  personDebtsHref,
  type PersonRollup,
} from "@/lib/personal-debts/person-rollup";
import type { CurrencyCode } from "@/types/domain";

interface PersonDebtRollupListProps {
  people: PersonRollup[];
  /** Show at most this many people; the rest go behind "Ver N más". */
  limit?: number;
}

function metaLine(p: PersonRollup): string {
  const trips = p.children.filter((c) => c.kind === "viaje").length;
  const loose = p.children.find((c) => c.kind === "sueltas")?.count ?? 0;
  const parts: string[] = [];
  if (trips > 0) parts.push(`${trips} ${trips === 1 ? "viaje" : "viajes"}`);
  if (loose > 0) parts.push(`${loose} ${loose === 1 ? "suelta" : "sueltas"}`);
  if (p.overdueCount > 0) parts.push(`${p.overdueCount} vencida${p.overdueCount === 1 ? "" : "s"}`);
  if (p.otherCurrencies.length > 0) parts.push(`+${p.otherCurrencies.join(", ")}`);
  return parts.join(" · ");
}

/**
 * Deudas con personas, summarized: one row per person (never one per debt),
 * and inside each person their open viajes and loose debts. Every child links
 * to that person's card on /deudas-personales, where the expenses live.
 */
export function PersonDebtRollupList({ people, limit }: PersonDebtRollupListProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const visible = limit ? people.slice(0, limit) : people;
  const hidden = people.length - visible.length;

  return (
    <div className="space-y-1.5">
      {visible.map((p) => {
        const open = openId === p.destinatario_id;
        const code = p.currency_code as CurrencyCode;
        return (
          <div key={p.destinatario_id} className={cn(PANEL_INSET_CLASS, "overflow-hidden")}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : p.destinatario_id)}
              aria-expanded={open}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
            >
              <PersonAvatar name={p.name} className="size-7 text-xs" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-z-sage-light">{p.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{metaLine(p)}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className={cn(SECTION_EYEBROW_CLASS, "block", BALANCE_TONE_CLASS[p.headline.tone])}>
                  {p.headline.label}
                </span>
                <span
                  className={cn(
                    "block text-sm font-semibold tabular-nums",
                    BALANCE_TONE_CLASS[p.headline.tone],
                  )}
                >
                  {p.headline.tone === "even" ? "—" : formatCurrency(p.headline.amount, code)}
                </span>
              </span>
              <HeaderChevron open={open} />
            </button>
            <Expand open={open}>
              <div className="divide-y divide-white/6 border-t border-white/6">
                {p.children.map((c) => (
                  <Link
                    key={c.key}
                    href={personDebtsHref(p.destinatario_id)}
                    className="flex items-center gap-2.5 py-2 pl-5 pr-3 transition-colors hover:bg-white/[0.02]"
                  >
                    <span
                      aria-hidden
                      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-xs"
                    >
                      {c.kind === "viaje" ? (
                        c.emoji ?? <MapPin className="size-3 text-z-brass" />
                      ) : (
                        <span className="size-1.5 rounded-full bg-muted-foreground" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs text-z-sage-light">{c.label}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        {c.count} {c.count === 1 ? "deuda" : "deudas"}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-xs font-semibold tabular-nums",
                        BALANCE_TONE_CLASS[c.tone],
                      )}
                    >
                      {c.tone === "even" ? "—" : formatCurrency(c.amount, code)}
                    </span>
                  </Link>
                ))}
                <Link
                  href={personDebtsHref(p.destinatario_id)}
                  className="flex items-center justify-center gap-1 py-2 text-xs font-medium text-z-brass hover:underline"
                >
                  Ver todo con {p.name}
                  <ChevronRight className="size-3.5" />
                </Link>
              </div>
            </Expand>
          </div>
        );
      })}
      {hidden > 0 && (
        <Link
          href="/deudas-personales"
          className="block py-1 text-center text-xs text-muted-foreground hover:text-z-brass"
        >
          y {hidden} {hidden === 1 ? "persona más" : "personas más"}
        </Link>
      )}
    </div>
  );
}
