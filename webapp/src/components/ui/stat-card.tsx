import { cn } from "@/lib/utils";

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
