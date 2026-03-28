import {
  LayoutDashboard,
  ArrowLeftRight,
  FileUp,
  Wallet,
  PiggyBank,
  Landmark,
  Repeat2,
  Inbox,
  Contact,
  Settings,
  BarChart3,
  Menu,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** If true, the sidebar will show an uncategorized count badge */
  badge?: "uncategorized";
  /** Additional href prefixes that should also activate this nav item */
  matchHrefs?: string[];
};

export const PRIMARY_NAV: NavItem[] = [
  { title: "Inicio", href: "/dashboard", icon: LayoutDashboard },
  { title: "Movimientos", href: "/transactions", icon: ArrowLeftRight },
  {
    title: "Plan",
    href: "/plan",
    icon: PiggyBank,
    matchHrefs: [
      "/categories",
      "/deudas",
      "/deudas/planificador",
      "/recurrentes",
    ],
  },
  {
    title: "Más",
    href: "/gestionar",
    icon: Menu,
    badge: "uncategorized",
    matchHrefs: [
      "/categorizar",
      "/destinatarios",
      "/import",
      "/accounts",
      "/settings",
    ],
  },
];

export const WORKSPACE_NAV: NavItem[] = [
  { title: "Categorizar", href: "/categorizar", icon: Inbox },
  { title: "Destinatarios", href: "/destinatarios", icon: Contact },
  { title: "Importar", href: "/import", icon: FileUp },
  { title: "Cuentas", href: "/accounts", icon: Wallet },
  { title: "Deudas", href: "/deudas", icon: Landmark },
  { title: "Recurrentes", href: "/recurrentes", icon: Repeat2 },
];

export const BOTTOM_NAV: NavItem[] = [
  { title: "Ajustes", href: "/settings", icon: Settings },
  { title: "Analytics", href: "/settings/analytics", icon: BarChart3 },
];

export function isNavItemActive(pathname: string, item: NavItem) {
  const hrefs = [item.href, ...(item.matchHrefs ?? [])];
  return hrefs.some((href) => pathname === href || pathname.startsWith(`${href}/`));
}
