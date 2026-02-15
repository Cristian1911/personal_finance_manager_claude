import {
  LayoutDashboard,
  ArrowLeftRight,
  FileUp,
  Wallet,
  Tag,
  Landmark,
  Repeat2,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export const MAIN_NAV: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Transacciones", href: "/transactions", icon: ArrowLeftRight },
  { title: "Importar", href: "/import", icon: FileUp },
  { title: "Cuentas", href: "/accounts", icon: Wallet },
  { title: "Deudas", href: "/deudas", icon: Landmark },
  { title: "Recurrentes", href: "/recurrentes", icon: Repeat2 },
  { title: "Categorías", href: "/categories", icon: Tag },
];

export const BOTTOM_NAV: NavItem[] = [
  { title: "Configuración", href: "/settings", icon: Settings },
];
