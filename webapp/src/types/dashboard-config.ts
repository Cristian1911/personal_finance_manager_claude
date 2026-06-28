import type {
  DashboardLayout,
  PulseRange,
  WidgetInstance,
  WidgetSize,
} from "@zeta/shared";

export type AppPurpose = "manage_debt" | "track_spending" | "save_money" | "improve_habits";

export type DashboardSection = "hero" | "niveles" | "flujo" | "presupuesto" | "patrimonio" | "actividad" | "cuentas";

export interface WidgetConfig {
  id: string;
  visible: boolean;
  order: number;
  section: DashboardSection;
}

/**
 * Mobile layout types are aliases over the shared dashboard contract so the
 * webapp and the native mobile app can't silently drift. Pulse is always
 * rendered first and is never part of `MobileDashboardLayout.widgets`.
 */
export type MobileWidgetSize = WidgetSize;
export type MobilePulseRange = PulseRange;
export type MobileWidgetInstance = WidgetInstance;
export type MobileDashboardLayout = DashboardLayout;

/** Persistent state for the "Primeros pasos" Home card (guided experience · D2). */
export interface FirstStepsState {
  /** ISO timestamp — card permanently dismissed ("Ocultar por ahora"). */
  dismissedAt?: string;
  /** ISO timestamp — card hidden until this moment ("Recordar mañana"). */
  snoozeUntil?: string;
  /** User collapsed the card body. */
  collapsed?: boolean;
}

/** Server-persisted guided-experience state, stored inside dashboard_config. */
export interface GuidedExperienceState {
  firstSteps?: FirstStepsState;
  /** Coach-mark ids the user has dismissed with "Entendido" (guided experience · D5). */
  seenCoachMarks?: string[];
}

export interface DashboardConfig {
  purpose: AppPurpose;
  widgets: WidgetConfig[];
  guidedExperience?: GuidedExperienceState;
}
