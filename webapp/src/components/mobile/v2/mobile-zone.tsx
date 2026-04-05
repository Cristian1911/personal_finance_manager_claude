import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface MobileZoneProps {
  eyebrow?: string;
  heading?: string;
  children: ReactNode;
  className?: string;
}

export function MobileZone({
  eyebrow,
  heading,
  children,
  className,
}: MobileZoneProps) {
  return (
    <section className={cn("space-y-2", className)}>
      {eyebrow && (
        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-z-sage-dark">
          {eyebrow}
        </p>
      )}
      {heading && (
        <h2 className="text-[15px] font-semibold tracking-tight">
          {heading}
        </h2>
      )}
      {children}
    </section>
  );
}
