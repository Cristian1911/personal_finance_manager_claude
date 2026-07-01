import Link from "next/link";
import type { Modo } from "@/types/domain";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { PANEL_SURFACE_CLASS } from "@/lib/constants/styles";

export function ModoCard({ modo }: { modo: Modo }) {
  const range = `${formatDate(modo.date_from, "d MMM")} – ${formatDate(modo.date_to, "d MMM yyyy")}`;
  return (
    <Link
      href={`/modos/${modo.id}`}
      className={cn(PANEL_SURFACE_CLASS, "flex items-center gap-3 p-4 transition-colors hover:bg-z-surface-3")}
      style={modo.color ? { borderLeftColor: modo.color, borderLeftWidth: 4 } : undefined}
    >
      <span className="text-2xl">{modo.emoji ?? "📍"}</span>
      <div className="min-w-0">
        <p className="truncate font-medium">{modo.name}</p>
        <p className="text-sm text-muted-foreground">{range}</p>
      </div>
    </Link>
  );
}
