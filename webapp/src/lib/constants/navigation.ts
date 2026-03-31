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
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Badge type: "attention" shows the attention snapshot count */
  badge?: "attention";
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
      "/deudas",
      "/deudas/planificador",
      "/recurrentes",
    ],
  },
  {
    title: "Bandeja",
    href: "/gestionar",
    icon: Inbox,
    badge: "attention",
  },
];

export const WORKSPACE_NAV: NavItem[] = [
  { title: "Categorizar", href: "/categorizar", icon: Inbox },
  { title: "Destinatarios", href: "/destinatarios", icon: Contact },
  { title: "Importar", href: "/import", icon: FileUp },
  { title: "Cuentas", href: "/accounts", icon: Wallet },
  { title: "Presupuesto", href: "/presupuesto", icon: PiggyBank },
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
