import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Funnel,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import type { Database } from "@/types/database";
import { formatDate } from "@/lib/utils/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";
import { Button } from "@/components/ui/button";
import { PageHero, HeroAccentPill, HeroPill } from "@/components/ui/page-hero";
import { StatCard } from "@/components/ui/stat-card";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";

type ProductEventRow = Pick<
  Database["public"]["Tables"]["product_events"]["Row"],
  "event_name" | "event_time" | "session_id" | "flow" | "success"
>;

type DailyEventCountRow = {
  day: string;
  event_name: string;
  flow: string;
  event_count: number;
  session_count: number;
};

type ActivationRow = {
  cohort_day: string;
  signups: number;
  activated_d7: number;
  activation_d7_pct: number;
};

type ImportFunnelRow = {
  day: string;
  sessions: number;
  opened: number;
  file_selected: number;
  parse_requested: number;
  parse_succeeded: number;
  confirm_submitted: number;
  completed: number;
  open_to_complete_pct: number;
};

type CategorizationFunnelRow = {
  day: string;
  seen: number;
  picker_opened: number;
  selected: number;
  categorized: number;
  bulk_categorized: number;
  seen_to_categorized_pct: number;
};

const DAY_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/Bogota",
});

const EVENT_LABELS: Record<string, string> = {
  auth_login_completed: "Inicio de sesión",
  auth_signup_completed: "Registro completado",
  bulk_categorize_applied: "Categorización masiva aplicada",
  category_picker_opened: "Selector de categoría abierto",
  category_selected: "Categoría seleccionada",
  first_financial_insight_rendered: "Primera lectura financiera",
  import_completed: "Importación completada",
  import_confirm_submitted: "Confirmación de importación",
  import_file_selected: "Archivo seleccionado",
  import_flow_opened: "Importación iniciada",
  import_parse_requested: "Parseo solicitado",
  import_parse_succeeded: "Parseo exitoso",
  transaction_categorized: "Movimiento categorizado",
  uncategorized_item_seen: "Movimiento sin categoría visto",
};

const FLOW_LABELS: Record<string, string> = {
  budget: "presupuesto",
  categorize: "categorización",
  dashboard: "dashboard",
  debt: "deuda",
  import: "importación",
  onboarding: "onboarding",
  unknown: "general",
};

const ACTIVATION_EVENT_NAMES = [
  "import_completed",
  "transaction_categorized",
  "first_financial_insight_rendered",
] as const;

function getDayKey(eventTime: string): string {
  return DAY_FORMATTER.format(new Date(eventTime));
}

function getSessionKey(event: ProductEventRow): string {
  return event.session_id ?? `${event.flow ?? "general"}:${event.event_time.slice(0, 19)}`;
}

function toPercent(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function buildDailyEventCounts(events: ProductEventRow[]): DailyEventCountRow[] {
  const grouped = new Map<
    string,
    {
      day: string;
      event_name: string;
      flow: string;
      event_count: number;
      sessions: Set<string>;
    }
  >();

  for (const event of events) {
    const day = getDayKey(event.event_time);
    const flow = event.flow ?? "unknown";
    const key = `${day}:${event.event_name}:${flow}`;
    const current = grouped.get(key) ?? {
      day,
      event_name: event.event_name,
      flow,
      event_count: 0,
      sessions: new Set<string>(),
    };

    current.event_count += 1;
    current.sessions.add(getSessionKey(event));
    grouped.set(key, current);
  }

  return [...grouped.values()]
    .map((row) => ({
      day: row.day,
      event_name: row.event_name,
      flow: row.flow,
      event_count: row.event_count,
      session_count: row.sessions.size,
    }))
    .sort(
      (a, b) =>
        b.day.localeCompare(a.day) ||
        b.event_count - a.event_count ||
        a.event_name.localeCompare(b.event_name)
    );
}

function buildImportFunnel(events: ProductEventRow[]): ImportFunnelRow[] {
  const sessionsByDay = new Map<
    string,
    Map<
      string,
      {
        opened: number;
        file_selected: number;
        parse_requested: number;
        parse_succeeded: number;
        confirm_submitted: number;
        completed: number;
      }
    >
  >();

  for (const event of events) {
    if (event.flow !== "import") continue;

    const day = getDayKey(event.event_time);
    const sessionId = getSessionKey(event);
    const daySessions = sessionsByDay.get(day) ?? new Map();
    const current = daySessions.get(sessionId) ?? {
      opened: 0,
      file_selected: 0,
      parse_requested: 0,
      parse_succeeded: 0,
      confirm_submitted: 0,
      completed: 0,
    };

    switch (event.event_name) {
      case "import_flow_opened":
        current.opened = 1;
        break;
      case "import_file_selected":
        current.file_selected = 1;
        break;
      case "import_parse_requested":
        current.parse_requested = 1;
        break;
      case "import_parse_succeeded":
        current.parse_succeeded = 1;
        break;
      case "import_confirm_submitted":
        current.confirm_submitted = 1;
        break;
      case "import_completed":
        if (event.success) current.completed = 1;
        break;
      default:
        break;
    }

    daySessions.set(sessionId, current);
    sessionsByDay.set(day, daySessions);
  }

  return [...sessionsByDay.entries()]
    .map(([day, sessions]) => {
      const rows = [...sessions.values()];
      const opened = rows.reduce((total, row) => total + row.opened, 0);
      const completed = rows.reduce((total, row) => total + row.completed, 0);

      return {
        day,
        sessions: rows.length,
        opened,
        file_selected: rows.reduce((total, row) => total + row.file_selected, 0),
        parse_requested: rows.reduce((total, row) => total + row.parse_requested, 0),
        parse_succeeded: rows.reduce((total, row) => total + row.parse_succeeded, 0),
        confirm_submitted: rows.reduce((total, row) => total + row.confirm_submitted, 0),
        completed,
        open_to_complete_pct: toPercent(completed, opened),
      };
    })
    .sort((a, b) => b.day.localeCompare(a.day));
}

function buildCategorizationFunnel(events: ProductEventRow[]): CategorizationFunnelRow[] {
  const grouped = new Map<string, Omit<CategorizationFunnelRow, "seen_to_categorized_pct">>();

  for (const event of events) {
    if (event.flow !== "categorize") continue;

    const day = getDayKey(event.event_time);
    const current = grouped.get(day) ?? {
      day,
      seen: 0,
      picker_opened: 0,
      selected: 0,
      categorized: 0,
      bulk_categorized: 0,
    };

    switch (event.event_name) {
      case "uncategorized_item_seen":
        current.seen += 1;
        break;
      case "category_picker_opened":
        current.picker_opened += 1;
        break;
      case "category_selected":
        current.selected += 1;
        break;
      case "transaction_categorized":
        if (event.success) current.categorized += 1;
        break;
      case "bulk_categorize_applied":
        if (event.success) current.bulk_categorized += 1;
        break;
      default:
        break;
    }

    grouped.set(day, current);
  }

  return [...grouped.values()]
    .map((row) => ({
      ...row,
      seen_to_categorized_pct: toPercent(row.categorized, row.seen),
    }))
    .sort((a, b) => b.day.localeCompare(a.day));
}

function getEventLabel(eventName: string): string {
  return EVENT_LABELS[eventName] ?? eventName;
}

function getFlowLabel(flow: string): string {
  return FLOW_LABELS[flow] ?? flow;
}

export default async function AnalyticsPage() {
  await connection();

  const { supabase, user } = await getAuthenticatedClient();
  if (!user) redirect("/login");

  const analyticsWindowStart = new Date();
  analyticsWindowStart.setDate(analyticsWindowStart.getDate() - 45);

  const [eventsRes, profileRes, signupRes] = await Promise.all([
    supabase
      .from("product_events")
      .select("event_name,event_time,session_id,flow,success")
      .eq("user_id", user.id)
      .gte("event_time", analyticsWindowStart.toISOString())
      .order("event_time", { ascending: false })
      .limit(1000),
    supabase.from("profiles").select("created_at").eq("id", user.id).single(),
    supabase
      .from("product_events")
      .select("event_time")
      .eq("user_id", user.id)
      .eq("event_name", "auth_signup_completed")
      .eq("success", true)
      .order("event_time", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const queryErrors: string[] = [];

  if (eventsRes.error) {
    queryErrors.push("No pudimos leer tus eventos de uso recientes.");
  }
  if (profileRes.error) {
    queryErrors.push("No pudimos leer la fecha base de tu cuenta.");
  }
  if (signupRes.error) {
    queryErrors.push("No pudimos ubicar tu evento de registro inicial.");
  }

  const events = (eventsRes.data ?? []) as ProductEventRow[];
  const dailyCounts = buildDailyEventCounts(events);
  const importFunnel = buildImportFunnel(events);
  const categorizeFunnel = buildCategorizationFunnel(events);

  const signupAt = signupRes.data?.event_time ?? profileRes.data?.created_at ?? null;
  let latestActivation: ActivationRow | null = null;

  if (signupAt) {
    const activationWindowEnd = new Date(signupAt);
    activationWindowEnd.setDate(activationWindowEnd.getDate() + 7);

    const activationRes = await supabase
      .from("product_events")
      .select("event_name,success,event_time")
      .eq("user_id", user.id)
      .in("event_name", [...ACTIVATION_EVENT_NAMES])
      .gte("event_time", signupAt)
      .lte("event_time", activationWindowEnd.toISOString())
      .order("event_time", { ascending: true });

    if (activationRes.error) {
      queryErrors.push("No pudimos calcular tu activación dentro de los primeros 7 días.");
    } else {
      const activated = (activationRes.data ?? []).some((event) => event.success === true);
      latestActivation = {
        cohort_day: getDayKey(signupAt),
        signups: 1,
        activated_d7: activated ? 1 : 0,
        activation_d7_pct: activated ? 100 : 0,
      };
    }
  }

  const latestImport = importFunnel[0];
  const latestCategorize = categorizeFunnel[0];

  return (
    <div className="space-y-6 lg:space-y-8">
      <MobilePageHeader title="Actividad de uso" backHref="/settings" />

      <PageHero
        variant="brass"
        pills={
          <>
            <HeroPill>Actividad propia</HeroPill>
            <HeroAccentPill>Señales de uso</HeroAccentPill>
          </>
        }
        title="Revisa cómo estás usando Zeta sin salir del shell principal"
        description="Esta vista resume tus eventos recientes de onboarding, importación y categorización para entender qué flujos sí están funcionando y dónde todavía hay fricción."
        actions={
          <Button asChild className={BRASS_BUTTON_CLASS}>
            <Link href="/settings">
              Volver a Ajustes
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                <Users className="size-4 text-z-brass" />
                Activación D7
              </div>
            }
            value={latestActivation ? `${latestActivation.activation_d7_pct}%` : "—"}
            description={
              latestActivation
                ? `${latestActivation.activated_d7}/${latestActivation.signups} cohortes activadas`
                : "Sin dato base todavía"
            }
          />
          <StatCard
            label={
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                <Funnel className="size-4 text-z-brass" />
                Apertura → importación
              </div>
            }
            value={latestImport ? `${latestImport.open_to_complete_pct}%` : "—"}
            description={
              latestImport
                ? `${latestImport.completed}/${latestImport.opened} sesiones completadas`
                : "Sin datos aún"
            }
          />
          <StatCard
            label={
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                <BarChart3 className="size-4 text-z-brass" />
                Visto → categorizado
              </div>
            }
            value={latestCategorize ? `${latestCategorize.seen_to_categorized_pct}%` : "—"}
            description={
              latestCategorize
                ? `${latestCategorize.categorized}/${latestCategorize.seen} acciones resueltas`
                : "Sin datos aún"
            }
          />
          <StatCard
            label={
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                <ShieldCheck className="size-4 text-z-brass" />
                Cómo leer esta vista
              </div>
            }
            value={
              <span className="text-sm font-normal leading-6 text-muted-foreground">
                Lee esto como telemetría de uso personal, no como un panel agregado del producto.
              </span>
            }
          />
        </div>

        {queryErrors.length > 0 ? (
          <div className="rounded-2xl border border-z-debt/30 bg-z-debt/8 p-4 text-sm text-z-sage-light">
            <p className="font-medium text-z-white">La lectura de eventos no quedó completa.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              {queryErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="rounded-2xl border border-white/6 bg-z-surface-2/55 p-4">
            <div className="flex items-start gap-3">
              <Activity className="mt-0.5 size-4 text-z-brass" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-z-white">Qué conviene mirar primero</p>
                <p className="text-sm text-muted-foreground">
                  Si tu activación cae, revisa onboarding. Si importación cae, revisa el wizard.
                  Si categorización cae, mira urgencia, picker y acciones masivas.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/6 bg-z-surface-2/55 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 size-4 text-z-brass" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-z-white">Límite de esta vista</p>
                <p className="text-sm text-muted-foreground">
                  Sirve para leer señales de uso recientes de tu cuenta; no reemplaza métricas agregadas de producto.
                </p>
              </div>
            </div>
          </div>
        </div>
      </PageHero>

      <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <CardHeader>
          <CardTitle>Funnel de importación (diario)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Señal rápida del flujo que más impacta la frescura de tus datos.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {importFunnel.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin eventos de importación todavía.</p>
          ) : (
            importFunnel.slice(0, 10).map((row) => (
              <div
                key={row.day}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/6 bg-black/10 p-3 text-sm"
              >
                <span className="font-medium">{formatDate(row.day, "dd MMM yyyy")}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">abierto {row.opened}</Badge>
                  <Badge variant="secondary">parseado {row.parse_succeeded}</Badge>
                  <Badge variant="secondary">completado {row.completed}</Badge>
                  <Badge>{row.open_to_complete_pct}%</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <CardHeader>
          <CardTitle>Funnel de categorización (diario)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Útil para ver si el inbox y el selector de categorías están resolviendo o generando fricción.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {categorizeFunnel.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin eventos de categorización todavía.</p>
          ) : (
            categorizeFunnel.slice(0, 10).map((row) => (
              <div
                key={row.day}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/6 bg-black/10 p-3 text-sm"
              >
                <span className="font-medium">{formatDate(row.day, "dd MMM yyyy")}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">visto {row.seen}</Badge>
                  <Badge variant="secondary">seleccionado {row.selected}</Badge>
                  <Badge variant="secondary">categorizado {row.categorized}</Badge>
                  <Badge>{row.seen_to_categorized_pct}%</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <CardHeader>
          <CardTitle>Eventos recientes (agregado diario)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Log resumido para revisar qué flujos estás usando realmente y con qué intensidad.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {dailyCounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin eventos recientes todavía.</p>
          ) : (
            dailyCounts.slice(0, 20).map((row, idx) => (
              <div
                key={`${row.day}-${row.event_name}-${idx}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/6 bg-black/10 p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{formatDate(row.day, "dd MMM")}</Badge>
                  <span>{getEventLabel(row.event_name)}</span>
                  <span className="text-xs text-muted-foreground">({getFlowLabel(row.flow)})</span>
                </div>
                <div className="text-muted-foreground">
                  {row.event_count} eventos · {row.session_count} sesiones
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
