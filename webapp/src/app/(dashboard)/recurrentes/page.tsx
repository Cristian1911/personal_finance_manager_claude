import { connection } from "next/server";
import Link from "next/link";
import { Activity, ArrowRight, CalendarClock, Sparkles } from "lucide-react";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { getPreferredCurrency } from "@/actions/profile";
import {
  getRecurringTemplates,
  getRecurringSummary,
  getUpcomingRecurrences,
} from "@/actions/recurring-templates";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";
import { RecurringFormDialog } from "@/components/recurring/recurring-form-dialog";
import { RecurringList } from "@/components/recurring/recurring-list";
import { RecurringTimelineView } from "@/components/recurring/recurring-timeline-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHero, HeroPill, HeroAccentPill } from "@/components/ui/page-hero";
import { StatCard } from "@/components/ui/stat-card";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";

export default async function RecurrentesPage() {
  await connection();
  const [templatesResult, accountsResult, categoriesResult, summary, upcoming, currency] =
    await Promise.all([
      getRecurringTemplates(),
      getAccounts(),
      getCategories(),
      getRecurringSummary(),
      getUpcomingRecurrences(14),
      getPreferredCurrency(),
    ]);

  const templates = templatesResult.success ? templatesResult.data : [];
  const accounts = accountsResult.success ? accountsResult.data : [];
  const categories = categoriesResult.success ? categoriesResult.data : [];

  return (
    <div className="space-y-6 lg:space-y-8">
      <MobilePageHeader title="Recurrentes" backHref="/plan" />

      <PageHero
        variant="sage"
        pills={<><HeroPill>Detalle del plan</HeroPill><HeroAccentPill>Cadencia operativa</HeroAccentPill></>}
        title="Las obligaciones que sostienen o presionan el ritmo del mes"
        description="Aquí no estás creando estrategia nueva; estás afinando la maquinaria recurrente que hace que el plan se cumpla o se desordene."
        actions={
          <>
            <Button asChild className={BRASS_BUTTON_CLASS}>
              <Link href="/plan">
                Volver a Plan
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <RecurringFormDialog accounts={accounts} categories={categories} />
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Plantillas activas"
            value={summary.activeCount}
            description="La cantidad de rutinas que hoy mueven el flujo financiero."
          />
          <StatCard
            label="Salidas mensuales"
            value={formatCurrency(summary.totalMonthlyExpenses, currency)}
            description="Valor mensual equivalente que ya condiciona el margen."
          />
          <StatCard
            label="Entradas mensuales"
            value={formatCurrency(summary.totalMonthlyIncome, currency)}
            description="Lo recurrente que entra sin depender de una captura manual."
          />
          <StatCard
            label={
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                <CalendarClock className="size-4 text-z-brass" />
                Próximos 14 días
              </div>
            }
            value={upcoming.length}
            description="Eventos que conviene revisar antes de que se vuelvan sorpresa."
          />
        </div>
      </PageHero>

      <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/6 bg-black/10">
              <Activity className="size-4 text-z-brass" />
            </div>
            <div className="space-y-1">
              <CardTitle>Timeline operativo</CardTitle>
              <p className="text-sm text-muted-foreground">
                Vista cronológica para confirmar qué viene, qué se completó y dónde hay fricción.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <RecurringTimelineView templates={templates} accounts={accounts} />
        </CardContent>
      </Card>

      <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/6 bg-black/10">
              <Sparkles className="size-4 text-z-brass" />
            </div>
            <div className="space-y-1">
              <CardTitle>Gestión de plantillas</CardTitle>
              <p className="text-sm text-muted-foreground">
                Ajusta la estructura recurrente sin salir de la capa operativa del plan.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <RecurringList
            templates={templates}
            accounts={accounts}
            categories={categories}
          />
        </CardContent>
      </Card>
    </div>
  );
}
