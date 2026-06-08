import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  /** Wrap the bar in a <form>. Pass the formAction in. */
  formAction?: (formData: FormData) => void;
  /** Hidden form fields, rendered inside the <form>. */
  formExtras?: React.ReactNode;
  className?: string;
};

/**
 * Sticky action bar that sits pinned to the bottom of the viewport on mobile
 * (with safe-area clearance) and becomes inline on desktop.
 *
 * Assumes the surrounding flow has hidden the bottom tab bar via
 * `useHideTabBar()` — the import wizard does this for steps review →
 * reconcile → results. If you reuse this bar outside that flow, hide the tab
 * bar yourself or the buttons will sit too low.
 *
 * Pair every step that uses this with a `.pb-28 lg:pb-0` (or similar) on the
 * scroll container so the last content row isn't trapped behind the bar.
 */
export function WizardActionBar({
  children,
  formAction,
  formExtras,
  className,
}: Props) {
  const inner = (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        "fixed inset-x-0 bottom-0 z-[var(--z-layer-nav)] border-t border-white/6 bg-z-ink/90 px-4 pt-3 backdrop-blur-md",
        "pb-[calc(env(safe-area-inset-bottom)_+_0.75rem)]",
        "lg:static lg:bg-transparent lg:px-0 lg:pb-4 lg:pt-4 lg:backdrop-blur-none",
        className,
      )}
    >
      {children}
    </div>
  );

  if (formAction) {
    return (
      <form action={formAction} className="contents">
        {formExtras}
        {inner}
      </form>
    );
  }
  return inner;
}
