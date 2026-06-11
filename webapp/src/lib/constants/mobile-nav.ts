import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  Landmark,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import type { Database } from "@/types/database";

type NavFocus = Database["public"]["Enums"]["nav_focus"];

export type MobileTab = {
  title: string;
  href: string;
  icon: LucideIcon;
  matchHrefs?: string[];
};

const INICIO_TAB: MobileTab = {
  title: "Inicio",
  href: "/dashboard",
  icon: LayoutDashboard,
};

const MOVIMIENTOS_TAB: MobileTab = {
  title: "Movim.",
  href: "/transactions",
  icon: ArrowLeftRight,
};

const PLAN_TAB: MobileTab = {
  title: "Plan",
  href: "/plan",
  icon: PiggyBank,
};

const DEUDAS_TAB: MobileTab = {
  title: "Deudas",
  href: "/deudas",
  matchHrefs: ["/deudas/planificador"],
  icon: Landmark,
};

const MAS_TAB: MobileTab = {
  title: "Más",
  href: "/gestionar",
  icon: LayoutGrid,
};

export function getMobileTabs(focus: NavFocus): MobileTab[] {
  const thirdTab = focus === "DEBT" ? DEUDAS_TAB : PLAN_TAB;
  return [INICIO_TAB, MOVIMIENTOS_TAB, thirdTab, MAS_TAB];
}

export function isMobileTabActive(pathname: string, tab: MobileTab): boolean {
  const hrefs = [tab.href, ...(tab.matchHrefs ?? [])];
  return hrefs.some((h) => pathname === h || pathname.startsWith(`${h}/`));
}

/**
 * Pathnames that render in "focus mode" — the bottom tab bar is hidden so the
 * user can complete the task without parallel navigation. The page must
 * provide its own back affordance (`MobileHeader variant="sub"` does this).
 *
 * Add a path here when the screen is a single-task surface (form, wizard,
 * planner). Do NOT add list/index pages — users routinely pivot away from
 * those.
 *
 * For runtime/conditional hiding (e.g., wizard step changes), use
 * `useHideTabBar()` from `@/components/mobile/v2/tab-bar-visibility-provider`
 * instead of this list.
 */
const FOCUS_MODE_PATHS: ReadonlyArray<string> = [
  "/transactions/new",
  "/recurrentes/new",
  "/deudas/planificador",
  "/presupuesto/armar",
] as const;

const FOCUS_MODE_PATH_REGEXES: ReadonlyArray<RegExp> = [
  /^\/recurrentes\/[^/]+\/edit$/,
] as const;

export function isFocusModePath(pathname: string): boolean {
  if (FOCUS_MODE_PATHS.includes(pathname)) return true;
  return FOCUS_MODE_PATH_REGEXES.some((re) => re.test(pathname));
}
