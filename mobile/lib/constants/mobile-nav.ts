import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  Landmark,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react-native";

export type NavFocus = "PLAN" | "DEBT";

export type MobileTab = {
  /** Expo Router screen name (matches file name in `app/(tabs)/`) */
  name: string;
  title: string;
  /** Pathname-style href for focus-mode + active checks */
  href: string;
  icon: LucideIcon;
  matchHrefs?: string[];
};

const INICIO_TAB: MobileTab = {
  name: "index",
  title: "Inicio",
  href: "/",
  icon: LayoutDashboard,
};

const MOVIMIENTOS_TAB: MobileTab = {
  name: "transactions",
  title: "Movim.",
  href: "/transactions",
  icon: ArrowLeftRight,
};

const PLAN_TAB: MobileTab = {
  name: "plan",
  title: "Plan",
  href: "/plan",
  icon: PiggyBank,
};

const DEUDAS_TAB: MobileTab = {
  name: "deudas",
  title: "Deudas",
  href: "/deudas",
  matchHrefs: ["/deudas/planificador"],
  icon: Landmark,
};

const MAS_TAB: MobileTab = {
  name: "menu",
  title: "Más",
  href: "/menu",
  icon: LayoutGrid,
};

/**
 * Returns the four navigable tabs in display order. The third slot swaps
 * between Plan and Deudas based on the user's `nav_focus` preference; the
 * fifth slot ("Más") is always present. The FAB is rendered between slot 2
 * and slot 3 by `MobileTabBar` itself — it is not part of this list.
 */
export function getMobileTabs(focus: NavFocus = "PLAN"): MobileTab[] {
  const thirdTab = focus === "DEBT" ? DEUDAS_TAB : PLAN_TAB;
  return [INICIO_TAB, MOVIMIENTOS_TAB, thirdTab, MAS_TAB];
}

export function isMobileTabActive(pathname: string, tab: MobileTab): boolean {
  const hrefs = [tab.href, ...(tab.matchHrefs ?? [])];
  return hrefs.some((h) => pathname === h || pathname.startsWith(`${h}/`));
}

/**
 * Pathnames that render in "focus mode" — the bottom tab bar is hidden so the
 * user can complete the task without parallel navigation. Keep in sync with
 * the webapp list in `webapp/src/lib/constants/mobile-nav.ts`.
 */
const FOCUS_MODE_PATHS: ReadonlyArray<string> = [
  "/transactions/new",
  "/recurrentes/new",
  "/deudas/planificador",
  "/presupuesto-armar",
] as const;

const FOCUS_MODE_PATH_REGEXES: ReadonlyArray<RegExp> = [
  /^\/recurrentes\/[^/]+\/edit$/,
  /^\/destinatarios\/[^/]+\/edit$/,
] as const;

export function isFocusModePath(pathname: string): boolean {
  if (FOCUS_MODE_PATHS.includes(pathname)) return true;
  return FOCUS_MODE_PATH_REGEXES.some((re) => re.test(pathname));
}
