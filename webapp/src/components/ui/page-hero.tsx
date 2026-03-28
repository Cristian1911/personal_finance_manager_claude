import { cn } from "@/lib/utils";

const GRADIENTS = {
  sage: "bg-[radial-gradient(circle_at_top_left,rgba(63,70,50,0.26),transparent_42%),linear-gradient(180deg,rgba(27,30,27,0.96),rgba(18,20,18,0.98))]",
  brass:
    "bg-[radial-gradient(circle_at_top_left,rgba(147,120,68,0.16),transparent_40%),linear-gradient(180deg,rgba(30,30,26,0.96),rgba(18,20,18,0.98))]",
} as const;

interface PageHeroProps {
  variant?: keyof typeof GRADIENTS;
  pills?: React.ReactNode;
  title: string;
  description: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function PageHero({
  variant = "sage",
  pills,
  title,
  description,
  actions,
  children,
  className,
}: PageHeroProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[28px] border border-white/6 px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] lg:px-7",
        GRADIENTS[variant],
        className
      )}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            {pills && (
              <div className="flex flex-wrap items-center gap-2">{pills}</div>
            )}
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-z-white lg:text-3xl">
                {title}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </div>
          </div>

          {actions && (
            <div className="flex flex-wrap gap-3">{actions}</div>
          )}
        </div>

        {children}
      </div>
    </section>
  );
}

export function HeroPill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full border border-white/6 bg-black/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-z-sage-light",
        className
      )}
    >
      {children}
    </span>
  );
}

export function HeroAccentPill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full border border-z-brass/30 bg-z-brass/10 px-3 py-1 text-[11px] font-medium text-z-brass",
        className
      )}
    >
      {children}
    </span>
  );
}
