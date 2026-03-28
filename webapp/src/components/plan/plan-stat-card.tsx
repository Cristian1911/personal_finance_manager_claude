import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";

export { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";

interface PlanStatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  description?: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}

/** Plan-specific stat card with surface variant backgrounds. */
export function PlanStatCard({
  variant = "primary",
  className,
  ...rest
}: PlanStatCardProps) {
  return (
    <StatCard
      className={cn(
        variant === "primary" ? "bg-z-surface-2/70" : "bg-z-surface-2/30",
        className
      )}
      {...rest}
    />
  );
}
