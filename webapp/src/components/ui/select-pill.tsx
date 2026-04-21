import { cn } from "@/lib/utils";

interface SelectPillProps {
  label: string;
  active: boolean;
  onClick: () => void;
  className?: string;
}

/**
 * Round pill picker used by chip-style radio groups (onboarding currency,
 * onboarding account type, etc.). Single source of truth for the brass-tinted
 * active fork + white/5 idle fork.
 */
export function SelectPill({ label, active, onClick, className }: SelectPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-z-brass/40 bg-z-brass/10 text-z-brass"
          : "border-white/8 bg-white/[0.02] text-z-sage-light hover:bg-white/[0.04]",
        className,
      )}
    >
      {label}
    </button>
  );
}
