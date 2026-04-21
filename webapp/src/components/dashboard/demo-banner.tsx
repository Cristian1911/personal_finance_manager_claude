"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Eye, UserPlus, X } from "lucide-react";
import { toggleDemoMode } from "@/actions/demo";
import { Button } from "@/components/ui/button";

interface DemoBannerProps {
  /** When true the current user is an anonymous demo visitor — swap "Salir" for "Crear cuenta". */
  isAnonymous?: boolean;
}

export function DemoBanner({ isAnonymous = false }: DemoBannerProps) {
  const [isPending, startTransition] = useTransition();

  function handleExit() {
    startTransition(async () => {
      await toggleDemoMode();
    });
  }

  const copy = isAnonymous
    ? "— Estás explorando sin cuenta"
    : "— Los datos mostrados son ficticios";

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-z-brass/20 bg-z-brass/8 px-4 py-2.5">
      <div className="flex items-center gap-2.5 text-sm">
        <Eye className="size-4 shrink-0 text-z-brass" />
        <span className="font-medium text-z-brass">Modo Demo</span>
        <span className="text-muted-foreground">{copy}</span>
      </div>
      {isAnonymous ? (
        <Button
          asChild
          size="sm"
          className="h-7 gap-1.5 bg-z-brass px-2.5 text-xs text-z-ink hover:bg-z-brass/90"
        >
          <Link href="/signup">
            <UserPlus className="size-3.5" />
            Crear cuenta
          </Link>
        </Button>
      ) : (
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
      )}
    </div>
  );
}
