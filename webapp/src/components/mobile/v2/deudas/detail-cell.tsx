import { cn } from "@/lib/utils";

/** Tier-2 stat cell used inside expanded card details (label + bold value). */
export function DetailCell({
  label,
  tone,
  children,
}: {
  label: string;
  tone?: "debt" | "income";
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/6 bg-[#111] px-3 py-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <div
        className={cn(
          "mt-0.5 text-sm font-bold tabular-nums",
          tone === "debt" && "text-z-debt",
          tone === "income" && "text-z-income"
        )}
      >
        {children}
      </div>
    </div>
  );
}
