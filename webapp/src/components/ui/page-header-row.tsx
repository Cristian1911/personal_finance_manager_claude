import { cn } from "@/lib/utils";

interface PageHeaderRowProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Desktop-only page title row (h1 + actions).
 *
 * Contract: on mobile the page title comes from `MobileHeader`, so this
 * component renders `hidden lg:flex` by default — consumers don't need their
 * own `hidden lg:*` gate around it. Any action that must stay reachable on
 * mobile belongs in the page's `MobileHeader` `action` slot or an inline
 * mobile affordance.
 */
export function PageHeaderRow({
  title,
  subtitle,
  actions,
  className,
}: PageHeaderRowProps) {
  return (
    <div
      className={cn(
        "hidden lg:flex flex-wrap items-end justify-between gap-3",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-3">
          {actions}
        </div>
      )}
    </div>
  );
}
