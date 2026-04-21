import Link from "next/link";
import {
  Brain,
  CalendarClock,
  Contact,
  FileUp,
  Folder,
  Landmark,
  Settings,
  Tags,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const LINKS: { href: string; icon: LucideIcon; label: string }[] = [
  { href: "/accounts", icon: Wallet, label: "Cuentas" },
  { href: "/plan?tab=presupuesto", icon: Folder, label: "Categorías" },
  { href: "/plan?tab=recurrentes", icon: CalendarClock, label: "Recurrentes" },
  { href: "/destinatarios", icon: Contact, label: "Destinatarios" },
  { href: "/categorizar", icon: Tags, label: "Categorizar" },
  { href: "/import", icon: FileUp, label: "Importar" },
  { href: "/deudas", icon: Landmark, label: "Deudas" },
  { href: "/puedo-pagar", icon: Brain, label: "¿Comprarlo?" },
  { href: "/settings", icon: Settings, label: "Ajustes" },
];

export function MobileLinkGrid() {
  return (
    <div className="grid grid-cols-3 gap-3 lg:grid-cols-4">
      {LINKS.map(({ href, icon: Icon, label }) => (
        <Link
          key={href}
          href={href}
          className="flex flex-col items-center gap-2 rounded-2xl border border-white/6 bg-z-surface-2/80 px-3 py-4 transition-colors hover:bg-white/5"
        >
          <Icon className="size-5 text-muted-foreground" />
          <span className="text-xs font-medium">{label}</span>
        </Link>
      ))}
    </div>
  );
}
