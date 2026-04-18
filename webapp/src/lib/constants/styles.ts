/** Obsidian & Brass design token: primary action button */
export const BRASS_BUTTON_CLASS = "bg-z-brass text-z-ink hover:bg-z-brass/90";

/** Obsidian & Brass design token: secondary/ghost button */
export const GHOST_BUTTON_CLASS =
  "border-white/6 bg-black/10 text-z-sage-light hover:bg-white/5 hover:text-z-sage-light";

/** Obsidian & Brass design token: accent ghost button (brass tint) */
export const BRASS_GHOST_BUTTON_CLASS =
  "border-z-brass/20 bg-z-brass/8 text-z-brass hover:bg-z-brass/12";

/** Solid destructive button — for confirm-destroy actions (deletes, unrecoverable ops). */
export const DESTRUCTIVE_BUTTON_CLASS =
  "bg-z-debt text-z-white hover:bg-z-debt/90";

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

/** Subtle inset surface — lighter variant of PANEL_INSET_CLASS used by widget tiles */
export const PANEL_INSET_SUBTLE_CLASS =
  "rounded-2xl border border-white/6 bg-white/[0.02]";

/** Mobile v2 card: inset container with figure/ground contrast */
export const MOBILE_CARD_CLASS = `${PANEL_SURFACE_SUBTLE_CLASS} p-3`;

/** Mobile v2 tight card: no padding, overflow hidden, for list containers */
export const MOBILE_CARD_TIGHT_CLASS = `${PANEL_SURFACE_SUBTLE_CLASS} overflow-hidden`;

/** Mobile v2 page background */
export const MOBILE_BG_CLASS = "bg-background";

/** Mobile v2 eyebrow label */
export const MOBILE_EYEBROW_CLASS = SECTION_EYEBROW_CLASS;

/** Height of the mobile tab bar — mirrors --z-mobile-tab-bar-h in globals.css */
export const MOBILE_TAB_BAR_HEIGHT = "3.5rem";

/** Bottom padding that clears the mobile tab bar + safe area */
export const MOBILE_TAB_BAR_CLEARANCE_CLASS =
  "pb-[calc(var(--z-mobile-tab-bar-h)_+_env(safe-area-inset-bottom))]";

/** Mobile v2 action button (brass ghost) */
export const MOBILE_ACTION_BUTTON_CLASS =
  "rounded-lg border border-z-brass/20 bg-z-brass/8 px-2.5 py-1 text-[10px] font-semibold text-z-brass";
