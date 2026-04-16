"use client";

import { useState } from "react";
import { ArrowRight, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { PurchaseRecommenderDrawer } from "./purchase-recommender-drawer";
import type { CurrencyCode } from "@/types/domain";

interface InicioToolRowProps {
  currency: CurrencyCode;
}

export function InicioToolRow({ currency }: InicioToolRowProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center gap-3.5 rounded-2xl border border-white/6 bg-white/[0.02] px-3.5 py-3 text-left transition-colors active:bg-white/[0.04]"
        )}
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-z-brass/12">
          <Lightbulb className="size-5 text-z-brass" />
        </span>
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-[13px] font-bold text-foreground">¿Puedo comprarlo?</span>
          <span className="text-[11px] text-muted-foreground">
            Evalúa tu próxima compra contra el plan
          </span>
        </span>
        <ArrowRight className="size-5 text-z-brass" aria-hidden="true" />
      </button>

      <PurchaseRecommenderDrawer
        open={open}
        onOpenChange={setOpen}
        currency={currency}
      />
    </>
  );
}
