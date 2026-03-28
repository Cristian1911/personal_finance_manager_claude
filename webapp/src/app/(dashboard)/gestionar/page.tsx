import { connection } from "next/server";
import Link from "next/link";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import {
  BarChart3,
  ChevronRight,
  Contact,
  FileUp,
  Landmark,
  Repeat2,
  Settings,
  Tags,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const PURPOSE_META = {
  manage_debt: {
    label: "Controlar deudas",
    description: "Mantén visibles prioridades, fechas y decisiones que protegen tu flujo.",
  },
  track_spending: {
    label: "Seguir gastos",
    description: "Ordena movimientos y reglas para entender rápido si vas dentro del margen.",
  },
  save_money: {
    label: "Ahorrar",
    description: "Usa este espacio para limpiar ruido y dejar más claro qué sí puedes apartar.",
  },
  improve_habits: {
    label: "Mejorar hábitos",
    description: "Convierte mantenimiento operativo en una rutina pequeña y confiable.",
  },
} as const;

type ActionLink = {
  href: string;
  icon: LucideIcon;
  label: string;
  description: string;
  accent?: "olive" | "brass" | "neutral";
};

const coreActions: ActionLink[] = [
  {
    href: "/import",
    icon: FileUp,
    label: "Importar extractos",
    description: "Trae movimientos reales y refresca la foto del mes antes de decidir.",
    accent: "brass",
  },
  {
    href: "/accounts",
    icon: Wallet,
    label: "Cuentas",
    description: "Revisa saldos, ajustes y la base que alimenta tu estado general.",
    accent: "olive",
  },
  {
    href: "/recurrentes",
    icon: Repeat2,
    label: "Recurrentes",
    description: "Mantén visibles pagos y cobros que pueden mover tu margen cada semana.",
  },
];

const organizationActions: ActionLink[] = [
  {
    href: "/categorizar",
    icon: Tags,
    label: "Categorizar",
    description: "Limpia pendientes y mejora la lectura de gasto sin duplicar criterio.",
  },
  {
    href: "/destinatarios",
    icon: Contact,
    label: "Destinatarios",
    description: "Normaliza comercios y reglas para que los movimientos hablen un solo idioma.",
  },
  {
    href: "/deudas",
    icon: Landmark,
    label: "Deudas",
    description: "Ordena obligaciones, estrategias y próximos pasos desde un solo lugar.",
  },
];

const systemActions: ActionLink[] = [
  {
    href: "/settings",
    icon: Settings,
    label: "Ajustes",
    description: "Preferencias, moneda y configuración general del espacio.",
    accent: "olive",
  },
  {
    href: "/settings/analytics",
    icon: BarChart3,
    label: "Analytics",
    description: "Revisa trazabilidad y señales del producto cuando necesites contexto extra.",
  },
];

const cardAccentClasses: Record<NonNullable<ActionLink["accent"]>, string> = {
  olive: "border-z-olive-deep/35 bg-z-olive-deep/12",
  brass: "border-z-brass/25 bg-z-brass/12",
  neutral: "border-white/6 bg-card",
};

const iconAccentClasses: Record<NonNullable<ActionLink["accent"]>, string> = {
  olive: "bg-z-olive-deep/30 text-z-sage-light",
  brass: "bg-z-brass/20 text-z-brass",
  neutral: "bg-z-surface-2 text-muted-foreground",
};

function ActionCard({
  href,
  icon: Icon,
  label,
  description,
  accent = "neutral",
}: ActionLink) {
  return (
    <Link
      href={href}
      className={`group rounded-[22px] border p-5 transition-colors hover:bg-white/5 ${cardAccentClasses[accent]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`flex size-11 items-center justify-center rounded-2xl ${iconAccentClasses[accent]}`}>
          <Icon className="size-5" />
        </div>
        <ChevronRight className="mt-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="mt-5 space-y-2">
        <h2 className="text-base font-semibold">{label}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}

function InlineLinkRow({
  href,
  icon: Icon,
  label,
  description,
  accent = "neutral",
}: ActionLink) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 rounded-2xl border border-white/6 bg-card px-4 py-4 transition-colors hover:bg-white/5"
    >
      <div className="flex items-center gap-3">
        <div className={`flex size-10 items-center justify-center rounded-xl ${iconAccentClasses[accent]}`}>
          <Icon className="size-4" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">{label}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <ChevronRight className="size-4 text-muted-foreground" />
    </Link>
  );
}

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
  const purposeMeta =
    profile?.app_purpose && profile.app_purpose in PURPOSE_META
      ? PURPOSE_META[profile.app_purpose as keyof typeof PURPOSE_META]
      : null;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_22rem]">
        <div className="overflow-hidden rounded-[28px] border border-white/6 bg-[radial-gradient(circle_at_top_left,rgba(63,70,50,0.24),transparent_55%),linear-gradient(180deg,rgba(30,34,30,0.96),rgba(18,20,18,0.98))] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-full bg-z-surface-2 text-z-sage">
                <User className="size-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                  Espacio personal
                </p>
                <p className="text-lg font-semibold">{name}</p>
              </div>
            </div>
            <Link
              href="/settings"
              className="inline-flex min-h-9 items-center gap-2 rounded-full bg-z-brass px-4 text-sm font-medium text-z-ink"
            >
              <Settings className="size-4" />
              Ajustes
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Más</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Administra las piezas que mantienen tu sistema claro, confiable y listo para decidir.
              </p>
            </div>

            {purposeMeta ? (
              <div className="space-y-2">
                <span className="inline-flex rounded-full border border-z-olive-deep/35 bg-z-olive-deep/15 px-3 py-1 text-xs font-medium text-z-sage-light">
                  {purposeMeta.label}
                </span>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  {purposeMeta.description}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/6 bg-z-surface-2/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
            Siguiente ajuste
          </p>
          <h2 className="mt-2 text-lg font-semibold leading-tight">
            Mantén tu base limpia antes de profundizar en más análisis
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Si saldos, movimientos y reglas están al día, el resto de la app se vuelve mucho más clara.
          </p>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <ChevronRight className="mt-0.5 size-4 text-z-brass" />
              <p>Importa extractos nuevos antes de revisar desvíos o presupuesto.</p>
            </div>
            <div className="flex items-start gap-2">
              <ChevronRight className="mt-0.5 size-4 text-z-brass" />
              <p>Confirma cuentas y recurrentes para que tu margen diario sea confiable.</p>
            </div>
            <div className="flex items-start gap-2">
              <ChevronRight className="mt-0.5 size-4 text-z-brass" />
              <p>Usa categorizar y destinatarios para bajar ruido operativo.</p>
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
            Mantener al día
          </p>
          <h2 className="text-xl font-semibold">Lo que sostiene tu foto real</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {coreActions.map((action) => (
            <ActionCard key={action.href} {...action} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
            Organizar y reglas
          </p>
          <h2 className="text-xl font-semibold">Menos ruido operativo, más criterio consistente</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {organizationActions.map((action) => (
            <ActionCard key={action.href} {...action} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
            Sistema
          </p>
          <h2 className="text-xl font-semibold">Preferencias y contexto adicional</h2>
        </div>
        <div className="grid gap-3">
          {systemActions.map((action) => (
            <InlineLinkRow key={action.href} {...action} />
          ))}
        </div>
      </section>
    </div>
  );
}
