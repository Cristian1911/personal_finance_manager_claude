"use client";

import Link from "next/link";
import { FileUp } from "lucide-react";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";

interface InicioImportStripProps {
  daysSinceImport: number;
}

export function InicioImportStrip({ daysSinceImport }: InicioImportStripProps) {
  if (daysSinceImport <= 15) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-z-brass/20 p-3",
        "bg-[linear-gradient(135deg,rgba(var(--z-brass-rgb,183,165,122),0.06),transparent_50%)]"
      )}
    >
      {/* Icon box */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-z-brass/20 bg-z-brass/10">
        <FileUp className="h-4 w-4 text-z-brass" />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground">
          {daysSinceImport} días sin importar
        </p>
        <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
          Actualiza para que las métricas reflejen tu posición real.
        </p>
      </div>

      {/* CTA */}
      <Link
        href="/import"
        className={cn(
          BRASS_BUTTON_CLASS,
          "shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold"
        )}
      >
        Importar
      </Link>
    </div>
  );
}
