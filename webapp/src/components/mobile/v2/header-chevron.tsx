import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Rotating chevron for expandable card headers — pairs with <Expand>. */
export function HeaderChevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <ChevronDown
      className={cn(
        "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
        open && "rotate-180",
        className
      )}
    />
  );
}
