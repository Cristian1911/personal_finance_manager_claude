/** Obsidian & Brass design token: primary action button */
export const BRASS_BUTTON_CLASS =
  "bg-gradient-to-b from-z-brass-hot to-z-brass text-z-ink hover:brightness-110";

/** Obsidian & Brass design token: secondary/ghost button */
export const GHOST_BUTTON_CLASS =
  "border-white/6 bg-black/10 text-z-sage-light hover:bg-white/5 hover:text-z-sage-light";

/** Obsidian & Brass design token: accent ghost button (brass tint) */
export const BRASS_GHOST_BUTTON_CLASS =
  "border-z-brass/20 bg-z-brass/8 text-z-brass hover:bg-z-brass/12";

/** Solid destructive button — for confirm-destroy actions (deletes, unrecoverable ops). */
export const DESTRUCTIVE_BUTTON_CLASS =
  "bg-z-debt text-z-white hover:bg-z-debt/90";

/**
 * Ghost-tinted destructive button — softer destructive surface for inline
 * remove/delete affordances (row-level Eliminar buttons, secondary destructive
 * actions). Mirrors the mobile `DESTRUCTIVE_GHOST_BUTTON_CLASS` token.
 */
export const DESTRUCTIVE_GHOST_BUTTON_CLASS =
  "border-z-debt/25 bg-black/10 text-z-expense hover:bg-z-debt/10";

/**
 * Minimal icon/text destructive trigger — borderless, no surface. For inline
 * "remove" affordances (X to remove a row, trash icon, "Quitar" link) that
 * shouldn't read as full buttons. Resting color is the muted eyebrow token for
 * AA contrast; reddens on hover.
 */
export const ICON_DESTRUCTIVE_TRIGGER_CLASS =
  "rounded-md text-z-sage-dark transition-colors hover:text-z-debt disabled:opacity-50";

/** Neutral sibling of the above: borderless icon-only trigger, brass on hover. */
export const ICON_TRIGGER_CLASS =
  "rounded-md text-z-sage-dark transition-colors hover:text-z-brass disabled:opacity-50";

/**
 * Z-index — single ascending, spaced token scale (defined in globals.css as
 * `--z-layer-*` tokens, referenced via the arbitrary form, e.g.
 * `z-[var(--z-layer-modal)]`). Overlay order follows
 * the industry convention so a child surface opened inside a modal is never
 * hidden behind it — see docs/design-system/Z_INDEX.md.
 *
 * NOTE: never write a wildcard class-shaped example in this file (z-[var(
 * --z-layer-star)] with a literal asterisk) — Tailwind v4 scans this file for
 * class candidates and emits it as invalid CSS, crashing the dev server.
 *
 *   --z-layer-nav      40    mobile tab bar, bottom nav, fixed bottom bars
 *   --z-layer-modal    1000  Dialog, AlertDialog, Sheet, Drawer, FabMenu
 *   --z-layer-popover  1100  Popover, Dropdown, Select, date-picker (ABOVE modal)
 *   --z-layer-toast    1200  Sonner toasts
 *   --z-layer-tooltip  1300  Tooltip
 *
 * Because every popover outranks every modal, a Popover/Dialog opened from
 * inside a Sheet sits above it automatically — no per-call-site z-bump needed.
 */

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

/**
 * Bottom padding that clears the mobile tab bar + the brass FAB overshoot
 * (the `+` button sits ~16px above the bar) + the device safe area.
 *
 * Apply to:
 *  - any page-level scroll container with content that ends near the bottom
 *    (forms, lists, settings pages)
 *  - any inline bottom-anchored action bar that should sit above the tab bar
 *
 * Do NOT apply inside `Sheet`/`Drawer` content — those float over the tab bar
 * (modal tier --z-layer-modal sits above the bar at --z-layer-nav). Inside
 * sheets/drawers, use `pb-[calc(1rem+env(safe-area-inset-bottom))]` instead so
 * you only reserve the safe area, not the tab bar height.
 */
export const MOBILE_TAB_BAR_CLEARANCE_CLASS =
  "pb-[calc(var(--z-mobile-tab-bar-h)_+_var(--z-mobile-fab-overshoot)_+_env(safe-area-inset-bottom))]";

/**
 * Bottom padding for content INSIDE a `Sheet` / `Drawer` — only reserves the
 * device safe area. The sheet itself floats above the tab bar, so no tab-bar
 * height is needed.
 */
export const MOBILE_SHEET_SAFE_AREA_CLASS =
  "pb-[calc(1rem_+_env(safe-area-inset-bottom))]";

/** Mobile v2 action button (brass ghost) */
export const MOBILE_ACTION_BUTTON_CLASS =
  "rounded-lg border border-z-brass/20 bg-z-brass/8 px-2.5 py-1 text-[10px] font-semibold text-z-brass";

/** Neutral action chip used on the transaction detail page (Acciones grid,
 *  Vincular/Excluir/Eliminar, "Hacer recurrente" trigger). */
export const DETAIL_ACTION_CHIP_CLASS =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/6 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-foreground transition-colors active:opacity-70 disabled:opacity-50";

/** Segmented tab control — inactive tab (e.g. /deudas Carga·Plan·Cuentas) */
export const SEGMENTED_TAB_CLASS =
  "flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors text-muted-foreground active:bg-white/[0.06]";

/** Segmented tab control — active tab */
export const SEGMENTED_TAB_ACTIVE_CLASS =
  "flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors border border-z-brass/30 bg-z-brass/15 text-z-brass";

/** Neutral pill chip for inline actions (brass icon + label inside) */
export const CHIP_NEUTRAL_CLASS =
  "inline-flex items-center gap-2 rounded-full border border-white/6 bg-white/[0.03] px-3 py-1.5 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-z-brass/50";

/** Brass fill toggle chip (multi-select tags, single-select segments). */
export const CHIP_TOGGLE_BASE_CLASS =
  "rounded-full border px-2.5 py-1 text-xs transition-colors";
export function chipToggleClass(selected: boolean): string {
  return `${CHIP_TOGGLE_BASE_CLASS} ${
    selected
      ? "border-z-brass bg-z-brass text-z-ink"
      : "border-white/6 text-muted-foreground hover:bg-z-surface-2"
  }`;
}

/** Full-width "Ver todas / Ver menos" inline expand toggle (accordion footer). */
export const INLINE_EXPAND_TOGGLE_CLASS =
  "flex w-full items-center justify-center gap-1 border-t border-white/6 py-2 text-[11px] font-semibold text-z-brass transition-colors hover:bg-white/[0.02]";

/** Full-width clickable row header that toggles an expandable detail region. */
export const ROW_EXPAND_TRIGGER_CLASS =
  "flex w-full items-center gap-2.5 py-2.5 text-left transition-colors hover:bg-white/[0.02]";
