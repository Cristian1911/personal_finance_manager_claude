import { cn } from "@/lib/utils";

/**
 * Grid-rows expand/collapse (0fr → 1fr). Content stays mounted during the
 * close animation so the box never clips empty (see AnimatedAccordion rule).
 */
export function Expand({
  open,
  children,
  className,
}: {
  open: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-out",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        className
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
