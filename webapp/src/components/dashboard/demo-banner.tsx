"use client";

import { useTransition } from "react";
import { Eye, X } from "lucide-react";
import { toggleDemoMode } from "@/actions/demo";
import { Button } from "@/components/ui/button";

export function DemoBanner() {
  const [isPending, startTransition] = useTransition();

  function handleExit() {
    startTransition(async () => {
      await toggleDemoMode();
    });
  }

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-z-brass/20 bg-z-brass/8 px-4 py-2.5">
      <div className="flex items-center gap-2.5 text-sm">
        <Eye className="size-4 shrink-0 text-z-brass" />
        <span className="font-medium text-z-brass">Modo Demo</span>
        <span className="text-muted-foreground">
          — Los datos mostrados son ficticios
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleExit}
        disabled={isPending}
        className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <X className="size-3.5" />
        Salir
      </Button>
    </div>
  );
}
