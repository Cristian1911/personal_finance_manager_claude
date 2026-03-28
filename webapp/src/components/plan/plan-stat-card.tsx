import { cn } from "@/lib/utils";

interface PlanStatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  description?: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}

export function PlanStatCard({
  label,
  value,
  description,
  variant = "primary",
  className,
}: PlanStatCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/6 p-4",
        variant === "primary" ? "bg-z-surface-2/70" : "bg-z-surface-2/30",
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

/** Reusable class strings for the Obsidian & Brass button pair pattern */
export const BRASS_BUTTON_CLASS = "bg-z-brass text-z-ink hover:bg-z-brass/90";
export const GHOST_BUTTON_CLASS =
  "border-white/8 bg-black/10 text-z-sage-light hover:bg-white/5 hover:text-z-sage-light";
