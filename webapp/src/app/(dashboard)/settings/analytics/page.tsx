import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowRight, BarChart3, Funnel, ShieldCheck, Sparkles, Users } from "lucide-react";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";
import { Button } from "@/components/ui/button";
import { PageHero, HeroPill, HeroAccentPill } from "@/components/ui/page-hero";
import { StatCard } from "@/components/ui/stat-card";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";

type DailyEventCountRow = {
  day: string;
  event_name: string;
  flow: string;
  event_count: number;
  user_count: number;
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
  users_with_activity: number;
  seen: number;
  picker_opened: number;
  selected: number;
  categorized: number;
  bulk_categorized: number;
  seen_to_categorized_pct: number;
};

export default async function AnalyticsPage() {
  await connection();
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) redirect("/login");

  // Analytics schema exists in DB but is not included in Supabase generated types.
  // We type the query builder minimally to match actual usage below.
  const analyticsClient = (
    supabase as unknown as {
      schema(name: string): {
        from(table: string): {
          select(columns: string): {
            order(
              column: string,
              options?: { ascending: boolean }
            ): {
              limit(count: number): Promise<{ data: unknown[] | null; error: unknown }>;
            };
          };
        };
      };
    }
  ).schema("analytics");

  const [dailyCountsRes, activationRes, importRes, categorizeRes] = await Promise.all([
    analyticsClient
      .from("product_event_daily_counts")
      .select("day,event_name,flow,event_count,user_count")
      .order("day", { ascending: false })
      .limit(50),
    analyticsClient
      .from("activation_d7")
      .select("cohort_day,signups,activated_d7,activation_d7_pct")
      .order("cohort_day", { ascending: false })
      .limit(30),
    analyticsClient
      .from("import_funnel_daily")
      .select(
        "day,sessions,opened,file_selected,parse_requested,parse_succeeded,confirm_submitted,completed,open_to_complete_pct"
      )
      .order("day", { ascending: false })
      .limit(30),
    analyticsClient
      .from("categorization_funnel_daily")
      .select(
        "day,users_with_activity,seen,picker_opened,selected,categorized,bulk_categorized,seen_to_categorized_pct"
      )
      .order("day", { ascending: false })
      .limit(30),
  ]);

  const dailyCounts = ((dailyCountsRes.data ?? []) as DailyEventCountRow[]).map((r) => ({
    day: r.day ?? "",
    event_name: r.event_name ?? "",
    flow: r.flow ?? "unknown",
    event_count: r.event_count ?? 0,
    user_count: r.user_count ?? 0,
  }));

  const activation = ((activationRes.data ?? []) as ActivationRow[]).map((r) => ({
    cohort_day: r.cohort_day ?? "",
    signups: r.signups ?? 0,
    activated_d7: r.activated_d7 ?? 0,
    activation_d7_pct: r.activation_d7_pct ?? 0,
  }));

  const importFunnel = ((importRes.data ?? []) as ImportFunnelRow[]).map((r) => ({
    day: r.day ?? "",
    sessions: r.sessions ?? 0,
    opened: r.opened ?? 0,
    file_selected: r.file_selected ?? 0,
    parse_requested: r.parse_requested ?? 0,
    parse_succeeded: r.parse_succeeded ?? 0,
    confirm_submitted: r.confirm_submitted ?? 0,
    completed: r.completed ?? 0,
    open_to_complete_pct: r.open_to_complete_pct ?? 0,
  }));

  const categorizeFunnel = ((categorizeRes.data ?? []) as CategorizationFunnelRow[]).map((r) => ({
    day: r.day ?? "",
    users_with_activity: r.users_with_activity ?? 0,
    seen: r.seen ?? 0,
    picker_opened: r.picker_opened ?? 0,
    selected: r.selected ?? 0,
    categorized: r.categorized ?? 0,
    bulk_categorized: r.bulk_categorized ?? 0,
    seen_to_categorized_pct: r.seen_to_categorized_pct ?? 0,
  }));

  const latestImport = importFunnel[0];
  const latestCategorize = categorizeFunnel[0];
  const latestActivation = activation[0];

  return (
    <div className="space-y-6 lg:space-y-8">
      <MobilePageHeader title="Analytics interno" backHref="/settings" />

      <PageHero
        variant="brass"
        pills={<><HeroPill>Panel interno</HeroPill><HeroAccentPill>Operación de producto</HeroAccentPill></>}
        title="Lee la salud del producto sin convertir esto en otro data dump"
        description="Este panel existe para entender activación, importación y categorización con foco operativo: dónde se cae la gente, dónde estamos mejorando y qué flujo necesita atención."
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
                Activation D7
              </div>
            }
            value={latestActivation ? `${latestActivation.activation_d7_pct}%` : "\u2014"}
            description={
              latestActivation
                ? `${latestActivation.activated_d7}/${latestActivation.signups} usuarios activados`
                : "Sin datos aún"
            }
          />
          <StatCard
            label={
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                <Funnel className="size-4 text-z-brass" />
                Import open → complete
              </div>
            }
            value={latestImport ? `${latestImport.open_to_complete_pct}%` : "\u2014"}
            description={
              latestImport
                ? `${latestImport.completed}/${latestImport.opened} sesiones`
                : "Sin datos aún"
            }
          />
          <StatCard
            label={
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                <BarChart3 className="size-4 text-z-brass" />
                Seen → categorized
              </div>
            }
            value={latestCategorize ? `${latestCategorize.seen_to_categorized_pct}%` : "\u2014"}
            description={
              latestCategorize
                ? `${latestCategorize.categorized}/${latestCategorize.seen} usuarios`
                : "Sin datos aún"
            }
          />
          <StatCard
            label={
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                <ShieldCheck className="size-4 text-z-brass" />
                Cómo leer este panel
              </div>
            }
            value={
              <span className="text-sm font-normal leading-6 text-muted-foreground">
                Úsalo para detectar cuellos de botella en funnels, no para duplicar métricas del dashboard principal.
              </span>
            }
          />
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="rounded-2xl border border-white/6 bg-z-surface-2/55 p-4">
            <div className="flex items-start gap-3">
              <Activity className="mt-0.5 size-4 text-z-brass" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-z-white">Qué deberías revisar primero</p>
                <p className="text-sm text-muted-foreground">
                  Si la activación cae, revisa onboarding. Si importación cae, mira el wizard.
                  Si categorización cae, revisa urgencia, picker y bulk actions.
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
                  Es una consola interna de operación, no una capa que deba contaminar el shell principal del usuario.
                </p>
              </div>
            </div>
          </div>
        </div>
      </PageHero>

      <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <CardHeader>
          <CardTitle>Funnel de Importación (diario)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Señal rápida del flujo más crítico para devolver frescura a la base financiera.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {importFunnel.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
          ) : (
            importFunnel.slice(0, 10).map((row) => (
              <div
                key={row.day}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/6 bg-black/10 p-3 text-sm"
              >
                <span className="font-medium">{row.day}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">open {row.opened}</Badge>
                  <Badge variant="secondary">parse ok {row.parse_succeeded}</Badge>
                  <Badge variant="secondary">complete {row.completed}</Badge>
                  <Badge>{row.open_to_complete_pct}%</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <CardHeader>
          <CardTitle>Funnel de Categorización (diario)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Útil para saber si el inbox y el picker están resolviendo o generando fricción.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {categorizeFunnel.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
          ) : (
            categorizeFunnel.slice(0, 10).map((row) => (
              <div
                key={row.day}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/6 bg-black/10 p-3 text-sm"
              >
                <span className="font-medium">{row.day}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">seen {row.seen}</Badge>
                  <Badge variant="secondary">selected {row.selected}</Badge>
                  <Badge variant="secondary">categorized {row.categorized}</Badge>
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
            Log resumido para revisar qué flujos se están usando realmente y con qué volumen.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {dailyCounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
          ) : (
            dailyCounts.slice(0, 20).map((row, idx) => (
              <div
                key={`${row.day}-${row.event_name}-${idx}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/6 bg-black/10 p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{row.day}</Badge>
                  <span>{row.event_name}</span>
                  <span className="text-xs text-muted-foreground">({row.flow})</span>
                </div>
                <div className="text-muted-foreground">
                  {row.event_count} eventos · {row.user_count} usuarios
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
