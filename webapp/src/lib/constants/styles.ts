/** Obsidian & Brass design token: primary action button */
export const BRASS_BUTTON_CLASS = "bg-z-brass text-z-ink hover:bg-z-brass/90";

/** Obsidian & Brass design token: secondary/ghost button */
export const GHOST_BUTTON_CLASS =
  "border-white/8 bg-black/10 text-z-sage-light hover:bg-white/5 hover:text-z-sage-light";

/** Obsidian & Brass design token: accent ghost button (brass tint) */
export const BRASS_GHOST_BUTTON_CLASS =
  "border-z-brass/20 bg-z-brass/8 text-z-brass hover:bg-z-brass/12";

/** Shared page shell spacing */
export const PAGE_STACK_CLASS = "space-y-6 lg:space-y-8";

/** Shared eyebrow label for page/section headers */
export const SECTION_EYEBROW_CLASS =
  "text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark";

/** Standard elevated panel used by page summaries and hero-adjacent surfaces */
export const PANEL_SURFACE_CLASS =
  "rounded-2xl border border-white/6 bg-z-surface-2/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";

/** Lighter elevated panel used inside hero sections and stacked layouts */
export const PANEL_SURFACE_SUBTLE_CLASS =
  "rounded-2xl border border-white/6 bg-z-surface-2/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";

/** Hero card gradient for mobile dashboard cards */
export const HERO_CARD_GRADIENT_CLASS =
  "bg-[radial-gradient(circle_at_top_left,rgba(63,70,50,0.22),transparent_42%),linear-gradient(180deg,rgba(27,30,27,0.96),rgba(18,20,18,0.98))]";

/** Compact inset surface for tiles, pills, and mobile secondary cards */
export const PANEL_INSET_CLASS = "rounded-2xl border border-white/6 bg-black/10";

/** Compact inset surface with a softer hover state for interactive tiles */
export const PANEL_INSET_INTERACTIVE_CLASS =
  "rounded-2xl border border-white/6 bg-black/10 transition-colors hover:bg-white/[0.03]";
