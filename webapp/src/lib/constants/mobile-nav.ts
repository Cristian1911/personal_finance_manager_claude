import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  Landmark,
  type LucideIcon,
} from "lucide-react";

export type MobileTab = {
  title: string;
  href: string;
  icon: LucideIcon;
  matchHrefs?: string[];
};

export const MOBILE_TABS: MobileTab[] = [
  { title: "Inicio", href: "/dashboard", icon: LayoutDashboard },
  { title: "Movim.", href: "/transactions", icon: ArrowLeftRight },
  {
    title: "Plan",
    href: "/plan",
    icon: PiggyBank,
  },
  {
    title: "Deudas",
    href: "/deudas",
    matchHrefs: ["/deudas/planificador"],
    icon: Landmark,
  },
];

export function isMobileTabActive(pathname: string, tab: MobileTab): boolean {
  const hrefs = [tab.href, ...(tab.matchHrefs ?? [])];
  return hrefs.some((h) => pathname === h || pathname.startsWith(`${h}/`));
}
