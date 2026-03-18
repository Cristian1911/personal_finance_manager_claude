import { connection } from "next/server";
import Link from "next/link";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import {
  FileUp,
  Wallet,
  Contact,
  Tags,
  Landmark,
  Repeat2,
  Settings,
  ChevronRight,
  User,
} from "lucide-react";

const PURPOSE_LABELS: Record<string, string> = {
  manage_debt: "Controlar deudas",
  track_spending: "Seguir gastos",
  save_money: "Ahorrar",
  improve_habits: "Mejorar hábitos",
};

const quickLinks = [
  { href: "/import", icon: FileUp, label: "Importar" },
  { href: "/accounts", icon: Wallet, label: "Cuentas" },
  { href: "/destinatarios", icon: Contact, label: "Destinatarios" },
  { href: "/categories", icon: Tags, label: "Categorías" },
  { href: "/deudas", icon: Landmark, label: "Deudas" },
  { href: "/recurrentes", icon: Repeat2, label: "Recurrentes" },
];

export default async function GestionarPage() {
  await connection();
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, app_purpose")
    .eq("user_id", user.id)
    .single();

  const name = profile?.full_name || "Usuario";
  const purposeLabel = PURPOSE_LABELS[profile?.app_purpose ?? ""] ?? "";

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Más</h1>

      {/* Profile header */}
      <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
        <div className="flex size-12 items-center justify-center rounded-full bg-z-surface-2">
          <User className="size-6 text-z-sage" />
        </div>
        <div>
          <p className="font-semibold">{name}</p>
          {purposeLabel && (
            <p className="text-xs text-muted-foreground">{purposeLabel}</p>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Acceso rápido
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {quickLinks.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center hover:bg-muted/50 active:bg-muted transition-colors"
            >
              <Icon className="size-6 text-muted-foreground" />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div>
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Configuración
        </h2>
        <Link
          href="/settings"
          className="flex items-center justify-between rounded-xl border bg-card p-4 hover:bg-muted/50 active:bg-muted transition-colors"
        >
          <div className="flex items-center gap-3">
            <Settings className="size-5 text-muted-foreground" />
            <span className="text-sm font-medium">Ajustes</span>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
}
