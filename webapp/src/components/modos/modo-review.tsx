"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Inbox } from "lucide-react";
import { toast } from "sonner";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { WizardActionBar } from "@/components/import/wizard-action-bar";
import { ModoCandidateList } from "@/components/modos/modo-candidate-list";
import { reviewModoCandidates, type ModoCandidateRow } from "@/actions/modos";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import type { Modo } from "@/types/domain";

/**
 * "¿Fueron del viaje?" — the tray for rows in the trip's dates that carry none
 * of its tags (imports, untagged manual captures). Tick → tagged; the rest can
 * be discarded so they never come back.
 */
export function ModoReview({ modo, candidates }: { modo: Modo; candidates: ModoCandidateRow[] }) {
  const router = useRouter();
  const backHref = `/modos/${modo.id}`;
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(candidates.filter((r) => r.candidate.foreignCurrency).map((r) => r.id)),
  );
  const [pending, startTransition] = useTransition();

  function submit(discardRest: boolean) {
    const include = [...selected];
    const exclude = discardRest ? candidates.filter((r) => !selected.has(r.id)).map((r) => r.id) : [];
    if (include.length === 0 && exclude.length === 0) return;
    startTransition(async () => {
      const res = await reviewModoCandidates(modo.id, { include, exclude });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      const parts: string[] = [];
      if (res.data.included > 0) parts.push(`${res.data.included} ${res.data.included === 1 ? "agregado" : "agregados"}`);
      if (res.data.excluded > 0) parts.push(`${res.data.excluded} ${res.data.excluded === 1 ? "descartado" : "descartados"}`);
      toast.success(parts.join(" · ") || "Listo");
      router.push(backHref);
      router.refresh();
    });
  }

  return (
    <div className="pb-28 lg:pb-0">
      <MobileHeader variant="sub" title="Por revisar" backHref={backHref} />
      <div className="mx-auto w-full max-w-2xl space-y-5 px-4 pt-4 lg:pt-0">
        <div>
          <SectionEyebrow>
            {modo.emoji ?? "📍"} {modo.name}
          </SectionEyebrow>
          <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">¿Fueron del viaje?</h1>
          <p className="text-sm text-muted-foreground">
            Movimientos entre {formatDate(modo.date_from, "d MMM")} y {formatDate(modo.date_to, "d MMM")} que aún
            no llevan la etiqueta del viaje. Recurrentes, transferencias y deudas ya quedaron fuera.
          </p>
        </div>

        {candidates.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-6" strokeWidth={1.5} />}
            title="Nada por revisar"
            description="Todo lo de estas fechas ya está decidido. Lo que importes después aparecerá aquí."
            primary={{ label: "Volver al viaje", href: backHref }}
          />
        ) : (
          <ModoCandidateList
            rows={candidates}
            selected={selected}
            onToggle={(id) =>
              setSelected((cur) => {
                const n = new Set(cur);
                if (n.has(id)) n.delete(id);
                else n.add(id);
                return n;
              })
            }
            onToggleAll={(next) => setSelected(next ? new Set(candidates.map((r) => r.id)) : new Set())}
          />
        )}
      </div>

      {candidates.length > 0 && (
        <WizardActionBar className="lg:mx-auto lg:max-w-2xl lg:px-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => submit(true)}
            disabled={pending}
            className={GHOST_BUTTON_CLASS}
          >
            {selected.size > 0 ? "Agregar y descartar el resto" : "Descartar todos"}
          </Button>
          <Button
            type="button"
            onClick={() => submit(false)}
            disabled={pending || selected.size === 0}
            className={cn(BRASS_BUTTON_CLASS, "disabled:opacity-60")}
          >
            <Check className="size-4" />
            Agregar {selected.size > 0 ? selected.size : ""} al viaje
          </Button>
        </WizardActionBar>
      )}
    </div>
  );
}
