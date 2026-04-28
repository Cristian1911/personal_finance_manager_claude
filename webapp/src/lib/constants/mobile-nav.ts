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
