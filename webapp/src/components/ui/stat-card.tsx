import { cn } from "@/lib/utils";

// ── New compact metric box (action-first redesign) ──────────────────────────

interface CompactMetricBoxProps {
  label: string;
  value: React.ReactNode;
  /** Short data context line, e.g. "4 fuentes", "21% del ingreso" */
  context?: string;
  className?: string;
}

export function CompactMetricBox({
  label,
  value,
  context,
  className,
}: CompactMetricBoxProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/6 bg-black/10 p-4",
        className
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-olive-deep">
        {label}
      </p>
      <p className="mt-2 text-[22px] font-semibold leading-tight">{value}</p>
      {context && (
        <p className="mt-1 text-xs text-muted-foreground">{context}</p>
      )}
    </div>
  );
}

// ── Legacy StatCard (kept for pages not yet migrated) ───────────────────────

interface StatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}

export function StatCard({
  label,
  value,
  description,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/6 bg-black/10 p-4",
        className
      )}
    >
      {typeof label === "string" ? (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          {label}
        </p>
      ) : (
        label
      )}
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
