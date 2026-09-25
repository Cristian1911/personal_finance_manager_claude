import { connection } from "next/server";
import Link from "next/link";
import { CalendarClock, Lightbulb, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { getAccounts } from "@/actions/accounts";
import { getPreferredCurrency } from "@/actions/profile";
import { getExchangeRateTrend } from "@/actions/exchange-rate";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { PageHero, HeroAccentPill, HeroBackPill } from "@/components/ui/page-hero";
import { StatCard } from "@/components/ui/stat-card";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { FxHistoryChart } from "@/components/debt/fx-history-chart";
import {
  PAGE_STACK_CLASS,
  PANEL_INSET_CLASS,
  PANEL_SURFACE_CLASS,
} from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate, toColombiaDateString, toColombiaTimeString } from "@/lib/utils/date";
import {
  computeForeignDebtCost,
  computeRangeStats,
  getForeignDebtAccounts,
  largestForeignDebt,
  type FxTiming,
} from "@/lib/debt/usd-debt-insights";
import type { CurrencyCode } from "@/types/domain";

function formatPct(value: number): string {
  return `${Math.abs(value).toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`;
}

function formatUpdatedAt(iso: string, today: string): string {
  const date = new Date(iso);
  const day = toColombiaDateString(date);
  const time = toColombiaTimeString(date);
  return day === today ? `hoy ${time}` : `${formatDate(day, "d MMM")} ${time}`;
}

const TIMING_COPY: Record<FxTiming, { title: (from: string) => string; tone: string }> = {
  barato: {
    title: (from) => `El ${from} está barato hoy: buen día para abonar`,
    tone: "text-z-income",
  },
  normal: {
    title: (from) => `El ${from} está en su rango normal`,
    tone: "text-z-white",
  },
  caro: {
    title: (from) => `El ${from} está caro hoy: si tu fecha lo permite, espera`,
    tone: "text-z-expense",
  },
};

export default async function DeudaDolaresPage() {
  await connection();
  const [base, accountsResult] = await Promise.all([getPreferredCurrency(), getAccounts()]);
  const accounts = accountsResult.success ? accountsResult.data : [];
  const today = toColombiaDateString(new Date());

  // The foreign currency the user owes most in; USD when there's none.
  const from: CurrencyCode =
    largestForeignDebt(accounts, base)?.[0] ?? (base === "USD" ? "EUR" : "USD");
  const debtAccounts = getForeignDebtAccounts(accounts, from, today);
  const trend = await getExchangeRateTrend(from, base).catch(() => null);

  const header = <MobileHeader variant="sub" title={`Deuda en ${from}`} backHref="/deudas" />;
  const backPill = <HeroBackPill href="/deudas">Volver a Deudas</HeroBackPill>;

  if (!trend) {
    return (
      <div className={PAGE_STACK_CLASS}>
        {header}
        <PageHero
          variant="brass"
          pills={backPill}
          title={`No pudimos obtener la tasa ${from}/${base}`}
          description="La fuente de tasas no respondió. Se reintenta automáticamente cada hora de lunes a viernes."
        />
      </div>
    );
  }

  const stats = computeRangeStats(trend.history, trend.rate, trend.avg30d);
  const timing: FxTiming = stats?.timing ?? "normal";
  const copy = TIMING_COPY[timing];
  const totalDebt = debtAccounts.reduce((s, a) => s + a.balance, 0);
  const cost = computeForeignDebtCost(totalDebt, trend.rate, stats);
  const nearestDue = debtAccounts
    .filter((a) => a.daysToPayment !== null)
    .sort((a, b) => a.daysToPayment! - b.daysToPayment!)[0];
  const TimingIcon = timing === "barato" ? TrendingDown : timing === "caro" ? TrendingUp : Minus;

  const vsAvgLine =
    stats?.percentVsAvg30d != null
      ? `${formatPct(stats.percentVsAvg30d)} ${stats.percentVsAvg30d < 0 ? "bajo" : "sobre"} el promedio de 30 días`
      : "Aún sin promedio de 30 días";

  const tips = buildTips({ timing, from, cost, nearestDue, stats, base });

  return (
    <div className={PAGE_STACK_CLASS}>
      {header}

      <PageHero
        variant="brass"
        pills={<>
          {backPill}
          <HeroAccentPill>Tasa {from}/{base}</HeroAccentPill>
        </>}
        title={copy.title(from)}
        description={`1 ${from} = ${formatCurrency(trend.rate, base)} · ${vsAvgLine}. Tasa de mercado, actualizada ${formatUpdatedAt(trend.fetchedAt, today)}; se refresca cada hora de lunes a viernes.`}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Tasa hoy"
            value={
              <span className={cn("flex items-center gap-2 tabular-nums", copy.tone)}>
                <TimingIcon className="size-5" aria-hidden="true" />
                {formatCurrency(trend.rate, base)}
              </span>
            }
            description={
              stats
                ? `Más barata que el ${100 - stats.percentile}% de los últimos ${stats.days} días.`
                : "Construyendo historial."
            }
          />
          <StatCard
            label="Promedio 30 días"
            value={<span className="tabular-nums">{trend.avg30d ? formatCurrency(trend.avg30d, base) : "Sin dato"}</span>}
            description="Referencia para saber si hoy está caro o barato."
          />
          <StatCard
            label={`Mínimo ${stats?.days ?? ""} días`}
            value={<span className="tabular-nums">{stats ? formatCurrency(stats.min.rate, base) : "Sin dato"}</span>}
            description={stats ? `El ${formatDate(stats.min.date, "d 'de' MMMM")}.` : undefined}
          />
          <StatCard
            label={`Máximo ${stats?.days ?? ""} días`}
            value={<span className="tabular-nums">{stats ? formatCurrency(stats.max.rate, base) : "Sin dato"}</span>}
            description={stats ? `El ${formatDate(stats.max.date, "d 'de' MMMM")}.` : undefined}
          />
        </div>
      </PageHero>

      <section className={cn(PANEL_SURFACE_CLASS, "space-y-4 p-5")}>
        <SectionEyebrow>Últimos {trend.history.length} días</SectionEyebrow>
        <FxHistoryChart history={trend.history} avg30d={trend.avg30d} currency={base} />
      </section>

      {totalDebt > 0 ? (
        <section className={cn(PANEL_SURFACE_CLASS, "space-y-4 p-5")}>
          <SectionEyebrow>Tu deuda en {from}</SectionEyebrow>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className={cn(PANEL_INSET_CLASS, "p-4")}>
              <p className="text-xs text-z-sage-dark">Debes</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-z-white">
                {formatCurrency(cost.total, from)}
              </p>
              <p className="mt-1 text-xs tabular-nums text-z-sage-dark">
                Hoy equivale a {formatCurrency(cost.atToday, base)}
              </p>
            </div>
            <div className={cn(PANEL_INSET_CLASS, "p-4")}>
              <p className="text-xs text-z-sage-dark">Pagar hoy vs promedio</p>
              <p
                className={cn(
                  "mt-1 text-xl font-semibold tabular-nums",
                  cost.vsAvg30d == null
                    ? "text-z-white"
                    : cost.vsAvg30d < 0
                      ? "text-z-income"
                      : "text-z-expense",
                )}
              >
                {cost.vsAvg30d == null
                  ? "Sin dato"
                  : `${cost.vsAvg30d < 0 ? "Ahorras" : "Pagas"} ${formatCurrency(Math.abs(cost.vsAvg30d), base)}`}
              </p>
              <p className="mt-1 text-xs tabular-nums text-z-sage-dark">
                {cost.atAvg30d != null
                  ? `Al promedio costaría ${formatCurrency(cost.atAvg30d, base)}`
                  : "Falta historial para comparar"}
              </p>
            </div>
            <div className={cn(PANEL_INSET_CLASS, "p-4")}>
              <p className="text-xs text-z-sage-dark">Sensibilidad</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-z-white">
                {formatCurrency(cost.per100, base)}
              </p>
              <p className="mt-1 text-xs tabular-nums text-z-sage-dark">
                por cada {formatCurrency(100, base)} que se mueva el {from}. Rango {stats?.days ?? 0} días:{" "}
                {formatCurrency(cost.atMin, base)} – {formatCurrency(cost.atMax, base)}
              </p>
            </div>
          </div>

          <ul className="divide-y divide-white/6">
            {debtAccounts.map((account) => (
              <li key={account.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/accounts/${account.id}`}
                    className="block truncate text-sm font-medium text-z-white hover:underline"
                  >
                    {account.name}
                  </Link>
                  {account.nextPaymentDate && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-z-sage-dark">
                      <CalendarClock className="size-3.5" aria-hidden="true" />
                      Pago el {formatDate(account.nextPaymentDate, "d MMM")}
                      {account.daysToPayment === 0
                        ? " · hoy"
                        : ` · en ${account.daysToPayment} día${account.daysToPayment === 1 ? "" : "s"}`}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium tabular-nums text-z-white">
                    {formatCurrency(account.balance, from)}
                  </p>
                  <p className="text-xs tabular-nums text-z-sage-dark">
                    ≈ {formatCurrency(account.balance * trend.rate, base)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className={cn(PANEL_SURFACE_CLASS, "p-5 text-sm text-z-sage-dark")}>
          No tienes saldo pendiente en {from}. Cuando una tarjeta o préstamo tenga saldo en {from},
          aquí verás cuánto te cuesta pagarlo según la tasa del día.
        </section>
      )}

      <section className={cn(PANEL_SURFACE_CLASS, "space-y-3 p-5")}>
        <SectionEyebrow className="flex items-center gap-2">
          <Lightbulb className="size-3.5 text-z-brass" aria-hidden="true" />
          Cómo aprovechar el {from} bajo
        </SectionEyebrow>
        <ul className="space-y-3">
          {tips.map((tip) => (
            <li key={tip.title} className={cn(PANEL_INSET_CLASS, "p-4")}>
              <p className="text-sm font-medium text-z-white">{tip.title}</p>
              <p className="mt-1 text-[13px] leading-normal text-z-sage-light">{tip.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function buildTips({
  timing,
  from,
  base,
  cost,
  nearestDue,
  stats,
}: {
  timing: FxTiming;
  from: CurrencyCode;
  base: CurrencyCode;
  cost: ReturnType<typeof computeForeignDebtCost>;
  nearestDue: ReturnType<typeof getForeignDebtAccounts>[number] | undefined;
  stats: ReturnType<typeof computeRangeStats>;
}): { title: string; body: string }[] {
  const tips: { title: string; body: string }[] = [];
  const due = nearestDue?.nextPaymentDate
    ? `tu próximo pago (${formatDate(nearestDue.nextPaymentDate, "d 'de' MMMM")}, ${nearestDue.daysToPayment} días)`
    : "tu fecha límite de pago";

  if (timing === "barato") {
    tips.push({
      title: "Hoy es un buen día para abonar",
      body:
        cost.vsAvg30d != null && cost.total > 0
          ? `Pagar todo hoy te ahorra ${formatCurrency(Math.abs(cost.vsAvg30d), base)} frente a la tasa promedio del mes. Si no puedes pagarlo todo, adelanta lo que puedas.`
          : `La tasa está por debajo de su promedio del mes. Adelanta lo que puedas de tu saldo en ${from}.`,
    });
  } else if (timing === "caro") {
    tips.push({
      title: "Si puedes, espera unos días",
      body: `La tasa está por encima de su promedio. Si ${due} te da margen, espera a que baje; si no, paga solo el mínimo en ${from} y abona el resto cuando mejore.`,
    });
  } else {
    tips.push({
      title: "Tasa en su rango normal",
      body: `No hay una ventaja clara hoy. Programa el pago antes de ${due} y aprovecha si en esos días el ${from} cae bajo el promedio.`,
    });
  }

  tips.push({
    title: "Nunca esperes más allá de la fecha de pago",
    body: `Los intereses de la tarjeta y la mora casi siempre cuestan más que lo que ganas esperando una mejor tasa. Esperar solo tiene sentido dentro del plazo sin intereses.`,
  });

  tips.push({
    title: "Divide el pago en abonos",
    body: `Abonar una parte cada vez que el ${from} esté bajo el promedio promedia tu tasa y evita pagarlo todo en un pico.${
      stats ? ` En los últimos ${stats.days} días la tasa osciló entre ${formatCurrency(stats.min.rate, base)} y ${formatCurrency(stats.max.rate, base)}.` : ""
    }`,
  });

  tips.push({
    title: "La tasa de tu banco es un poco distinta",
    body: `Aquí ves la tasa de mercado. Al pagar en pesos, el banco convierte con su propia tasa (TRM del día en que aplica el pago, a veces con un margen), así que úsala como guía, no como valor exacto.`,
  });

  return tips;
}
