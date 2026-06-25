import {
  LayoutDashboard,
  ArrowLeftRight,
  FileUp,
  Wallet,
  PiggyBank,
  Landmark,
  Inbox,
  Contact,
  Users,
  Settings,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import type { AttentionPage } from "@/types/attention";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Badge type: "attention" shows the attention snapshot count */
  badge?: "attention";
  /** Additional href prefixes that should also activate this nav item */
  matchHrefs?: string[];
  /** Maps this nav item to an attention page key for badge counts */
  attentionPage?: AttentionPage;
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
    ],
  },
  { title: "Tendencias", href: "/tendencias", icon: TrendingUp },
  {
    title: "Bandeja",
    href: "/gestionar",
    icon: Inbox,
    badge: "attention",
  },
];

export const WORKSPACE_NAV: NavItem[] = [
  { title: "Categorizar", href: "/categorizar", icon: Inbox, attentionPage: "transactions" },
  { title: "Destinatarios", href: "/destinatarios", icon: Contact, attentionPage: "destinatarios" },
  { title: "Importar", href: "/import", icon: FileUp },
  { title: "Cuentas", href: "/accounts", icon: Wallet },
  { title: "Deudas", href: "/deudas", icon: Landmark },
  { title: "Deudas personales", href: "/deudas-personales", icon: Users },
];

export const BOTTOM_NAV: NavItem[] = [
  { title: "Ajustes", href: "/settings", icon: Settings },
];

export function isNavItemActive(pathname: string, item: NavItem) {
  const hrefs = [item.href, ...(item.matchHrefs ?? [])];
  return hrefs.some((href) => pathname === href || pathname.startsWith(`${href}/`));
}
