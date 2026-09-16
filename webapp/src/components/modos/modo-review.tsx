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
  // Explicit "No fue del viaje" per row — saved as exclusions even when the
  // user does not discard the rest.
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  function accept(id: string) {
    setRejected((cur) => {
      const n = new Set(cur);
      n.delete(id);
      return n;
    });
    setSelected((cur) => new Set(cur).add(id));
  }
  function reject(id: string) {
    setSelected((cur) => {
      const n = new Set(cur);
      n.delete(id);
      return n;
    });
    setRejected((cur) => new Set(cur).add(id));
  }
  function toggle(id: string) {
    if (selected.has(id)) {
      setSelected((cur) => {
        const n = new Set(cur);
        n.delete(id);
        return n;
      });
    } else {
      accept(id);
    }
  }

  const includeIds = [...selected].filter((id) => !rejected.has(id));
  const includeCount = includeIds.length;
  const rejectedCount = rejected.size;

  function submit(discardRest: boolean) {
    const include = includeIds;
    const excludeSet = new Set(rejected);
    if (discardRest) for (const r of candidates) if (!selected.has(r.id)) excludeSet.add(r.id);
    const exclude = [...excludeSet].filter((id) => !include.includes(id));
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
            Del {formatDate(modo.date_from, "d MMM")} al {formatDate(modo.date_to, "d MMM")}, sin la etiqueta del
            viaje. Toca una fila para ver el detalle.
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
            rejected={rejected}
            onToggle={toggle}
            onAccept={accept}
            onReject={reject}
            onToggleAll={(next) => {
              if (next) {
                setRejected(new Set());
                setSelected(new Set(candidates.map((r) => r.id)));
              } else {
                setSelected(new Set());
              }
            }}
          />
        )}
      </div>

      {candidates.length > 0 && (
        <WizardActionBar className="flex-col items-stretch gap-2 lg:mx-auto lg:max-w-2xl lg:flex-row lg:items-center lg:px-4">
          <p className="text-center text-xs text-muted-foreground lg:mr-auto lg:text-left">
            {includeCount} {includeCount === 1 ? "marcado" : "marcados"}
            {rejectedCount > 0 ? ` · ${rejectedCount} no` : ""} · de {candidates.length}
          </p>
          <div className="flex w-full gap-2 lg:w-auto">
            <Button
              type="button"
              variant="ghost"
              onClick={() => submit(true)}
              disabled={pending}
              className={cn(GHOST_BUTTON_CLASS, "min-w-0 flex-1 whitespace-nowrap lg:flex-none")}
            >
              {includeCount > 0 ? "Descartar el resto" : "Descartar todos"}
            </Button>
            <Button
              type="button"
              onClick={() => submit(false)}
              disabled={pending || (includeCount === 0 && rejectedCount === 0)}
              className={cn(BRASS_BUTTON_CLASS, "min-w-0 flex-1 whitespace-nowrap disabled:opacity-60 lg:flex-none")}
            >
              <Check className="size-4" />
              {includeCount > 0 ? `Agregar ${includeCount}` : rejectedCount > 0 ? `Guardar ${rejectedCount}` : "Agregar"}
            </Button>
          </div>
        </WizardActionBar>
      )}
    </div>
  );
}
