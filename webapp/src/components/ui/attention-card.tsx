import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AttentionSignal } from "@/types/attention";

interface AttentionCardProps {
  signals: AttentionSignal[];
  className?: string;
}

export function AttentionCard({ signals, className }: AttentionCardProps) {
  const hasSignals = signals.length > 0;

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        hasSignals
          ? "border-z-brass/20 bg-z-surface-2/80"
          : "border-z-olive-deep/25 bg-z-surface-2/80",
        className
      )}
    >
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.18em]",
          hasSignals ? "text-z-brass" : "text-z-olive-deep"
        )}
      >
        {hasSignals ? "Necesita atención" : "Estado"}
      </p>

      {hasSignals ? (
        <div className="mt-3 space-y-2">
          {signals.map((signal) => (
            <div
              key={signal.key}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-black/10 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-z-brass/15 text-[10px] font-bold text-z-brass">
                  {signal.count}
                </span>
                <span className="truncate text-sm">{signal.label}</span>
              </div>
              <Link
                href={signal.actionHref}
                className="flex-shrink-0 text-xs font-medium text-z-brass hover:text-z-brass/80"
              >
                Resolver &rarr;
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <Link href="/dashboard" className="mt-3 flex items-center gap-2 group">
          <CheckCircle2 className="size-4 text-z-olive-deep" />
          <span className="text-sm font-medium text-z-olive-deep group-hover:text-z-olive-deep/80">
            Al día
          </span>
        </Link>
      )}
    </div>
  );
}
