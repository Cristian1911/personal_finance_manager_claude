import {
  LayoutDashboard,
  ArrowLeftRight,
  FileUp,
  Wallet,
  PiggyBank,
  Landmark,
  Repeat2,
  Inbox,
  Settings,
  BarChart3,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** If true, the sidebar will show an uncategorized count badge */
  badge?: "uncategorized";
};

export const MAIN_NAV: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Transacciones", href: "/transactions", icon: ArrowLeftRight },
  { title: "Categorizar", href: "/categorizar", icon: Inbox, badge: "uncategorized" },
  { title: "Importar", href: "/import", icon: FileUp },
  { title: "Cuentas", href: "/accounts", icon: Wallet },
  { title: "Deudas", href: "/deudas", icon: Landmark },
  { title: "Recurrentes", href: "/recurrentes", icon: Repeat2 },
  { title: "Presupuesto", href: "/categories", icon: PiggyBank },
  { title: "Gestionar", href: "/gestionar", icon: Wrench },
];

export const BOTTOM_NAV: NavItem[] = [
  { title: "Configuración", href: "/settings", icon: Settings },
  { title: "Analytics", href: "/settings/analytics", icon: BarChart3 },
];
