"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { RecurringFormDialog } from "@/components/recurring/recurring-form-dialog";
import { MOBILE_EYEBROW_CLASS, PANEL_INSET_CLASS } from "@/lib/constants/styles";
import type {
  Account,
  CategoryWithChildren,
  CurrencyCode,
  RecurringTemplateWithRelations,
} from "@/types/domain";

interface TemplatesStripProps {
  templates: RecurringTemplateWithRelations[];
  accounts: Account[];
  categories: CategoryWithChildren[];
  currency: CurrencyCode;
  onMutate: () => Promise<void>;
}

export function MobileRecurrentesTemplatesStrip({
  templates,
  accounts,
  categories,
  currency,
  onMutate,
}: TemplatesStripProps) {
  const [expanded, setExpanded] = useState(false);

  let activeCount = 0;
  let pausedCount = 0;
  for (const t of templates) {
    if (t.is_active) activeCount++;
    else pausedCount++;
  }

  return (
    <div className="rounded-2xl border border-z-brass/18 bg-gradient-to-br from-z-brass/10 to-z-brass/[0.02] px-3.5 py-3">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={expanded}
      >
        <div>
          <p className={cn(MOBILE_EYEBROW_CLASS, "text-z-brass")}>Mis plantillas</p>
          <p className="mt-0.5 text-sm font-semibold">
            {activeCount} activa{activeCount !== 1 ? "s" : ""}
            {pausedCount > 0 && ` · ${pausedCount} pausada${pausedCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        <span className="text-[11px] font-medium text-z-brass">
          {expanded ? "Ocultar ↑" : "Ver ↓"}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {templates.length > 0 ? (
            <div className={cn(PANEL_INSET_CLASS, "divide-y divide-white/5")}>
              {templates.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5",
                    !t.is_active && "opacity-50",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{t.merchant_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {t.account?.name ?? "—"} · {t.frequency ?? "mensual"}
                      {!t.is_active && " · Pausada"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold tabular-nums">
                    {formatCurrency(Number(t.amount), currency)}
                  </span>
                  <RecurringFormDialog
                    template={t}
                    accounts={accounts}
                    categories={categories}
                    onClose={onMutate}
                    trigger={
                      <button
                        type="button"
                        className="shrink-0 rounded-md px-2 py-0.5 text-[10px] text-z-brass active:bg-white/5"
                      >
                        Editar
                      </button>
                    }
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Aún no tienes plantillas
            </p>
          )}

          <RecurringFormDialog
            accounts={accounts}
            categories={categories}
            onClose={onMutate}
            trigger={
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-z-brass/20 py-2.5 text-xs font-semibold text-z-brass active:bg-z-brass/5"
              >
                <Plus className="size-3.5" />
                Nueva plantilla
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}
