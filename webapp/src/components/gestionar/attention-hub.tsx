import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { AttentionSignal } from "@/types/attention";

interface AttentionHubProps {
  signals: AttentionSignal[];
}

export function AttentionHub({ signals }: AttentionHubProps) {
  const actionSignals = signals.filter((s) => s.priority === "action");
  const suggestionSignals = signals.filter((s) => s.priority === "suggestion");

  if (signals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <CheckCircle2 className="size-10 text-z-olive-deep" />
        <p className="text-base font-medium text-muted-foreground">Al día</p>
        <Link
          href="/dashboard"
          className="text-sm text-z-brass hover:text-z-brass/80"
        >
          Ir al dashboard &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {actionSignals.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Requiere acción
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {actionSignals.map((signal) => (
              <Link
                key={signal.key}
                href={signal.actionHref}
                className="rounded-2xl border border-z-brass/20 bg-z-surface-2/80 px-4 py-4 transition-colors hover:bg-white/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex items-center rounded-full bg-z-brass/15 px-2.5 py-0.5 text-xs font-semibold text-z-brass">
                    {signal.count}
                  </span>
                  <span className="text-sm font-medium text-z-brass">Resolver →</span>
                </div>
                <p className="mt-3 text-sm font-medium leading-snug">{signal.label}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {suggestionSignals.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Sugerencias
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {suggestionSignals.map((signal) => (
              <Link
                key={signal.key}
                href={signal.actionHref}
                className="rounded-2xl border border-white/6 bg-z-surface-2/80 px-4 py-4 transition-colors hover:bg-white/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex items-center rounded-full bg-white/8 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                    {signal.count}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">Ver →</span>
                </div>
                <p className="mt-3 text-sm font-medium leading-snug">{signal.label}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
