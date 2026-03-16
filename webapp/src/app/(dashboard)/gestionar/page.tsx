import Link from "next/link";
import { FileUp, Repeat2, Wallet, Contact, Settings, Landmark, type LucideIcon } from "lucide-react";

const actions: {
  href: string;
  icon: LucideIcon;
  label: string;
  description: string;
}[] = [
  {
    href: "/import",
    icon: FileUp,
    label: "Importar PDF",
    description: "Subir extracto bancario",
  },
  {
    href: "/recurrentes",
    icon: Repeat2,
    label: "Recurrentes",
    description: "Plantillas y pagos fijos",
  },
  {
    href: "/accounts",
    icon: Wallet,
    label: "Cuentas",
    description: "Administrar cuentas",
  },
  {
    href: "/deudas",
    icon: Landmark,
    label: "Deudas",
    description: "Pagos y simulador",
  },
  {
    href: "/destinatarios",
    icon: Contact,
    label: "Destinatarios",
    description: "Comercios y personas",
  },
  {
    href: "/settings",
    icon: Settings,
    label: "Ajustes",
    description: "Configuración general",
  },
];

export default function GestionarPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Gestionar</h1>

      <div className="grid grid-cols-2 gap-3">
        {actions.map(({ href, icon: Icon, label, description }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-2 rounded-xl border bg-card p-6 text-center hover:bg-muted/50 active:bg-muted"
          >
            <Icon className="size-8 text-muted-foreground" />
            <span className="text-sm font-medium">{label}</span>
            <span className="text-[11px] text-muted-foreground">
              {description}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
