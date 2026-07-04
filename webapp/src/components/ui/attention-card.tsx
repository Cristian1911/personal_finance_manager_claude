import Link from "next/link";
import { cn } from "@/lib/utils";
import { Verdict } from "@/components/ui/verdict";
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
          ? "border-z-alert/20 bg-z-surface-2/80"
          : "border-z-olive-deep/25 bg-z-surface-2/80",
        className
      )}
    >
      <Verdict compact state={hasSignals ? "atencion" : "vas-bien"} />

      {hasSignals ? (
        <div className="mt-3 space-y-2">
          {signals.map((signal) => (
            <div
              key={signal.key}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-black/10 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-z-alert/15 text-[10px] font-bold text-z-alert">
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
        <Link
          href="/dashboard"
          className="mt-3 block text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Sin pendientes por resolver
        </Link>
      )}
    </div>
  );
}
