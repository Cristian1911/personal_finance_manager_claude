import Link from "next/link";
import { cn } from "@/lib/utils";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import type { AttentionSignal } from "@/types/attention";

interface InicioFocusProps {
  signals: AttentionSignal[];
}

export function InicioFocus({ signals }: InicioFocusProps) {
  const top = signals[0];
  if (!top) return null;

  return (
    <Link
      href={top.actionHref}
      className={cn(
        PANEL_INSET_CLASS,
        "flex items-center justify-between gap-3 px-3.5 py-3 transition-colors active:bg-white/[0.03]"
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-tight text-foreground">
          {top.label}
        </p>
        <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
          {top.count} {top.count === 1 ? "pendiente" : "pendientes"}
        </p>
      </div>

      <span className="shrink-0 text-[13px] font-semibold text-z-brass">
        Ver →
      </span>
    </Link>
  );
}
