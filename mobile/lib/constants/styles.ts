/**
 * Style constants. Mirrors webapp/src/lib/constants/styles.ts.
 *
 * NOTE: the pre-computed opacity colors below (`z-brass-12`, `white-6`, …) are
 * legacy from NativeWind v3, which couldn't resolve the `/opacity` modifier.
 * The app is on NativeWind 4.2.2 + Tailwind 3.3.5, where the webapp's own
 * `bg-z-brass/12` syntax compiles and renders correctly — verified on device.
 * Prefer the webapp syntax in new code so both codebases read the same; the
 * pre-computed tokens stay because ~hundreds of call sites still use them.
 * Collapsing the two dialects is tracked in BACKLOG.md.
 */

/** Primary action button */
export const BRASS_BUTTON_CLASS = "bg-z-brass text-z-ink";

/** Secondary/ghost button */
export const GHOST_BUTTON_CLASS =
  "border border-white-8 bg-black-10 text-z-sage-light";

/** Accent ghost button (brass tint) */
export const BRASS_GHOST_BUTTON_CLASS =
  "border border-z-brass-20 bg-z-brass-8 text-z-brass";

/** Destructive ghost button — outlined in debt/25 with expense text */
export const DESTRUCTIVE_GHOST_BUTTON_CLASS =
  "border border-z-debt-25 bg-black-10 text-z-expense";

/** Standard elevated panel */
export const PANEL_SURFACE_CLASS =
  "rounded-2xl border border-white-6 bg-z-surface-2-80";

/** Lighter elevated panel */
export const PANEL_SURFACE_SUBTLE_CLASS =
  "rounded-2xl border border-white-6 bg-z-surface-2-55";

/** Compact inset surface */
export const PANEL_INSET_CLASS = "rounded-2xl border border-white-6 bg-black-10";

/** Token-based text input surface — used by all v2 form fields */
export const FORM_INPUT_CLASS = `${PANEL_INSET_CLASS} px-4 py-3 text-sm font-inter text-foreground`;

/** Mobile v2 card: inset container with padding */
export const MOBILE_CARD_CLASS = `${PANEL_SURFACE_SUBTLE_CLASS} p-3`;

/** Mobile v2 tight card: no padding, overflow hidden */
export const MOBILE_CARD_TIGHT_CLASS = `${PANEL_SURFACE_SUBTLE_CLASS} overflow-hidden`;

/** Mobile v2 page background */
export const MOBILE_BG_CLASS = "bg-background";

/** Eyebrow label */
export const SECTION_EYEBROW_CLASS =
  "text-[10px] font-inter-semibold uppercase tracking-[4px] text-z-sage-dark";

/** Mobile v2 action button (brass ghost) */
export const MOBILE_ACTION_BUTTON_CLASS =
  "rounded-lg border border-z-brass-20 bg-z-brass-8 px-2.5 py-1 text-[10px] font-inter-semibold text-z-brass";

/**
 * Bottom padding for scrollable screens so content clears the floating tab bar.
 * Mirrors webapp MOBILE_TAB_BAR_CLEARANCE_CLASS but as a numeric padding value
 * for RN contentContainerStyle.
 */
export const MOBILE_TAB_BAR_CLEARANCE = 120;
