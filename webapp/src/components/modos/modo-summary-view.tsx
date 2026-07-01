import Link from "next/link";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { ModoSummary, ModoTxRow } from "@/lib/utils/modo-summary";
import type { CurrencyCode, Modo, SharedPaymentGroup } from "@/types/domain";

export function ModoSummaryView({
  modo,
  summary,
  sharedGroups,
  transactions,
}: {
  modo: Modo;
  summary: ModoSummary;
  sharedGroups: SharedPaymentGroup[];
  transactions: ModoTxRow[];
}) {
  const applyHref = `/transactions?tags=${modo.tag_ids.join(",")}&dateFrom=${modo.date_from}&dateTo=${modo.date_to}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      {/* Bloque 1: header total + conteo */}
      <header className="space-y-1">
        <Link href={applyHref} className="text-sm text-z-brass hover:underline">
          Ver en Movimientos →
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
          {modo.emoji ?? "📍"} {modo.name}
        </h1>
        <p className="text-3xl font-bold tabular-nums">{formatCurrency(summary.total)}</p>
        <p className="text-sm text-muted-foreground">
          {summary.count} transacciones ·{" "}
          {formatDate(summary.observedFrom ?? modo.date_from, "d MMM")} –{" "}
          {formatDate(summary.observedTo ?? modo.date_to, "d MMM yyyy")}
        </p>
      </header>

      {/* Bloque 2: por categoría */}
      {summary.byCategory.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-medium">Por categoría</h2>
          {summary.byCategory.map((b) => (
            <div key={b.categoryId ?? b.name} className="flex justify-between text-sm">
              <span>
                {b.name}{" "}
                <span className="text-muted-foreground">({b.count})</span>
              </span>
              <span className="tabular-nums">{formatCurrency(b.total)}</span>
            </div>
          ))}
        </section>
      )}

      {/* Bloque 3: pagos compartidos / por persona */}
      {sharedGroups.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-medium">Pagos compartidos</h2>
          {sharedGroups.map((g) => {
            const cc = g.currency_code as CurrencyCode;
            return (
              <div
                key={g.split_group_id}
                className="rounded-xl border border-white/6 bg-[#111] px-3 py-2 text-sm"
              >
                <div className="flex justify-between">
                  <span>{g.description ?? "Pago compartido"}</span>
                  <span className="tabular-nums">{formatCurrency(g.total, cc)}</span>
                </div>
                <p className="text-muted-foreground">
                  Tu parte <span className="tabular-nums">{formatCurrency(g.userShare, cc)}</span> · pendiente{" "}
                  <span className="tabular-nums">{formatCurrency(g.outstanding_total, cc)}</span>
                </p>
              </div>
            );
          })}
        </section>
      )}

      {/* Bloque 4: lista de transacciones */}
      {transactions.length > 0 && (
        <section className="space-y-1">
          <h2 className="font-medium">Transacciones</h2>
          {transactions.map((t) => (
            <div
              key={t.id}
              className="flex justify-between border-b border-white/6 py-1.5 text-sm"
            >
              <span>
                {t.category?.name_es ?? t.category?.name ?? "Sin categoría"} ·{" "}
                {formatDate(t.transaction_date, "d MMM")}
              </span>
              <span className="tabular-nums">{formatCurrency(t.amount ?? 0)}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
