import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * Canonical inline pill used across transaction surfaces (inline action rows,
 * detail header, pickers). One shape, four states — the single source of truth
 * so chip styling stops drifting per call-site.
 *
 * - `neutral`  — no value yet / secondary action (e.g. "Categoría", "Más")
 * - `active`   — has a value (e.g. an assigned category/destinatario)
 * - `primary`  — the single brass CTA (e.g. "Categorizar")
 * - `danger`   — destructive (e.g. "Quitar")
 *
 * Render as a button/link via `asChild`. Icons (lucide) auto-size to 13px.
 */
const chipVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-z-brass/50 disabled:opacity-50 disabled:pointer-events-none [&>svg]:shrink-0 [&>svg]:pointer-events-none [&>svg]:size-[13px]",
  {
    variants: {
      variant: {
        neutral:
          "border-white/6 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06]",
        active:
          "border-z-brass/30 bg-z-brass/10 text-z-brass hover:bg-z-brass/15",
        primary:
          "border-z-brass bg-z-brass text-z-ink font-semibold hover:bg-z-brass/90",
        danger:
          "border-z-expense/25 bg-z-expense/5 text-z-expense hover:bg-z-expense/10",
      },
      size: {
        sm: "px-2.5 py-1 text-[11px]",
        md: "px-3 py-1.5 text-xs",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "sm",
    },
  },
);

function Chip({
  className,
  variant = "neutral",
  size = "sm",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof chipVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="chip"
      data-variant={variant}
      className={cn(chipVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Chip, chipVariants };
