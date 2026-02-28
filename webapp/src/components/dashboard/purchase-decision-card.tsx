"use client";

import { useMemo, useState, useTransition } from "react";
import { Brain, CircleAlert, Loader2, PiggyBank, Scale, ShieldAlert } from "lucide-react";
import type { PurchaseDecisionResult, PurchaseFundingType, PurchaseUrgency } from "@venti5/shared";
import { analyzePurchaseDecisionAction } from "@/actions/purchase-decision";
import { CategoryCombobox } from "@/components/ui/category-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import type { Account, CategoryWithChildren } from "@/types/domain";

type AccountOption = Pick<Account, "id" | "name" | "account_type">;

const urgencyLabels: Record<PurchaseUrgency, string> = {
  NECESSARY: "Necesidad",
  USEFUL: "Útil",
  IMPULSE: "Capricho",
};

const verdictMeta: Record<
  PurchaseDecisionResult["verdict"],
  { label: string; badgeClassName: string; panelClassName: string }
> = {
  BUY: {
    label: "Sí",
    badgeClassName: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
    panelClassName: "border-emerald-500/20 bg-emerald-500/5",
  },
  BUY_WITH_CAUTION: {
    label: "Sí, pero con cautela",
    badgeClassName: "border-amber-500/30 bg-amber-500/10 text-amber-700",
    panelClassName: "border-amber-500/20 bg-amber-500/5",
  },
  WAIT: {
    label: "Mejor espera",
    badgeClassName: "border-orange-500/30 bg-orange-500/10 text-orange-700",
    panelClassName: "border-orange-500/20 bg-orange-500/5",
  },
  NOT_RECOMMENDED: {
    label: "No recomendado",
    badgeClassName: "border-red-500/30 bg-red-500/10 text-red-700",
    panelClassName: "border-red-500/20 bg-red-500/5",
  },
};

export function PurchaseDecisionCard({
  accounts,
  categories,
  defaultMonth,
}: {
  accounts: AccountOption[];
  categories: CategoryWithChildren[];
  defaultMonth: string;
}) {
  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.account_type !== "LOAN"),
    [accounts]
  );
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(activeAccounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [urgency, setUrgency] = useState<PurchaseUrgency>("USEFUL");
  const [fundingType, setFundingType] = useState<PurchaseFundingType>("ONE_TIME");
  const [installments, setInstallments] = useState("3");
  const [result, setResult] = useState<PurchaseDecisionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleAnalyze() {
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError("Ingresa un monto válido.");
      return;
    }

    if (!accountId) {
      setError("Selecciona una cuenta.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const response = await analyzePurchaseDecisionAction({
        amount: numericAmount,
        accountId,
        categoryId,
        urgency,
        fundingType,
        installments:
          fundingType === "INSTALLMENTS" ? Number(installments || "0") : null,
        month: defaultMonth,
      });

      if (!response.success || !response.data) {
        setResult(null);
        setError(response.success ? "No fue posible analizar la compra." : response.error);
        return;
      }

      setResult(response.data);
    });
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-primary" />
            ¿Debería comprar esto?
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Evalúa impacto en liquidez, deuda, presupuesto y pagos próximos antes de decidir.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" disabled={activeAccounts.length === 0}>
              Analizar compra
              <Scale className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="h-[min(94vh,64rem)] w-[min(98vw,88rem)] max-w-[min(98vw,88rem)] overflow-hidden p-0 sm:p-0">
            <DialogHeader>
              <div className="border-b px-4 py-4 sm:px-6">
                <DialogTitle>Analizador de decisiones financieras</DialogTitle>
                <DialogDescription>
                El resultado usa tu flujo del mes, deudas activas, pagos próximos y presupuesto de
                categoría.
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="grid h-full gap-0 2xl:grid-cols-[380px_minmax(0,1fr)]">
              <div className="space-y-4 overflow-y-auto border-b bg-muted/30 p-4 sm:p-6 2xl:border-r 2xl:border-b-0">
                <div className="space-y-2">
                  <Label htmlFor="purchase-amount">Monto</Label>
                  <Input
                    id="purchase-amount"
                    type="number"
                    min="1"
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="250000"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Cuenta desde la que pagarías</Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {activeAccounts.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Necesitas al menos una cuenta activa distinta a préstamo para usar este
                      análisis.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <CategoryCombobox
                    categories={categories}
                    value={categoryId}
                    onValueChange={setCategoryId}
                    direction="OUTFLOW"
                    placeholder="Selecciona una categoría"
                    triggerClassName="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Urgencia</Label>
                  <Select
                    value={urgency}
                    onValueChange={(value) => setUrgency(value as PurchaseUrgency)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(urgencyLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Forma de pago</Label>
                  <Select
                    value={fundingType}
                    onValueChange={(value) => setFundingType(value as PurchaseFundingType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ONE_TIME">Pago único</SelectItem>
                      <SelectItem value="INSTALLMENTS">Cuotas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {fundingType === "INSTALLMENTS" && (
                  <div className="space-y-2">
                    <Label htmlFor="purchase-installments">Número de cuotas</Label>
                    <Input
                      id="purchase-installments"
                      type="number"
                      min="2"
                      max="36"
                      step="1"
                      value={installments}
                      onChange={(event) => setInstallments(event.target.value)}
                    />
                  </div>
                )}

                {error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <Button className="w-full gap-2" onClick={handleAnalyze} disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analizando
                    </>
                  ) : (
                    <>
                      Obtener recomendación
                      <Brain className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              <div className="min-w-0 space-y-4 overflow-y-auto p-4 sm:p-6">
                {result ? (
                  <>
                    <div
                      className={cn(
                        "rounded-xl border p-4",
                        verdictMeta[result.verdict].panelClassName
                      )}
                    >
                      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Veredicto</p>
                          <div className="mt-1 flex items-center gap-3">
                            <Badge
                              variant="outline"
                              className={verdictMeta[result.verdict].badgeClassName}
                            >
                              {verdictMeta[result.verdict].label}
                            </Badge>
                            <span className="text-sm font-medium">
                              Score {Math.round(result.score)}/100
                            </span>
                          </div>
                        </div>
                        <div className="rounded-lg bg-background/80 px-3 py-2 text-right">
                          <p className="text-xs text-muted-foreground">Impacto inmediato</p>
                          <p className="text-lg font-semibold">
                            {formatCurrency(result.metrics.effectiveImmediateImpact)}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm leading-6">{result.summary}</p>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                      <MetricTile
                        label="Buffer proyectado"
                        value={formatCurrency(result.metrics.projectedLiquidBuffer)}
                      />
                      <MetricTile
                        label="Colchón recomendado"
                        value={formatCurrency(result.metrics.recommendedBuffer)}
                      />
                      <MetricTile
                        label="Flujo libre mensual"
                        value={formatCurrency(result.metrics.monthlyFreeCashflow)}
                      />
                      <MetricTile
                        label="Cuota estimada"
                        value={formatCurrency(result.metrics.estimatedMonthlyInstallment)}
                      />
                      <MetricTile
                        label="Presupuesto restante"
                        value={
                          result.metrics.budgetRemainingAfterPurchase == null
                            ? "Sin presupuesto"
                            : formatCurrency(result.metrics.budgetRemainingAfterPurchase)
                        }
                      />
                      <MetricTile
                        label="Uso de deuda proyectado"
                        value={
                          result.metrics.selectedAccountUtilizationAfter == null
                            ? "No aplica"
                            : `${Math.round(result.metrics.selectedAccountUtilizationAfter)}%`
                        }
                      />
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <section className="rounded-xl border p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <ShieldAlert className="h-4 w-4 text-primary" />
                          <h3 className="text-sm font-semibold">Por qué</h3>
                        </div>
                        <div className="space-y-3">
                          {result.reasons.map((reason) => (
                            <div key={`${reason.code}-${reason.title}`} className="rounded-lg border bg-muted/30 p-3">
                              <div className="mb-1 flex items-center gap-2">
                                <span
                                  className={cn(
                                    "inline-block h-2.5 w-2.5 rounded-full",
                                    reason.severity === "critical"
                                      ? "bg-red-500"
                                      : reason.severity === "warning"
                                        ? "bg-amber-500"
                                        : "bg-emerald-500"
                                  )}
                                />
                                <p className="text-sm font-medium">{reason.title}</p>
                              </div>
                              <p className="text-sm text-muted-foreground">{reason.detail}</p>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="rounded-xl border p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <PiggyBank className="h-4 w-4 text-primary" />
                          <h3 className="text-sm font-semibold">Qué podrías hacer en vez</h3>
                        </div>
                        {result.alternatives.length > 0 ? (
                          <div className="space-y-3">
                            {result.alternatives.map((alternative) => (
                              <div
                                key={`${alternative.type}-${alternative.title}`}
                                className="rounded-lg border bg-muted/30 p-3"
                              >
                                <p className="text-sm font-medium">{alternative.title}</p>
                                <p className="text-sm text-muted-foreground">{alternative.detail}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                            No hay una alternativa clara más fuerte que la compra con la información
                            actual.
                          </div>
                        )}
                      </section>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
                    <CircleAlert className="mb-3 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium">Aún no hay análisis</p>
                    <p className="mt-1 max-w-md text-sm text-muted-foreground">
                      Ingresa el monto, el medio de pago y el contexto básico. El motor te dirá si
                      la compra te deja corto para pagos próximos o si empeora tu presión de deuda.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
          <p>Liquidez después de compromisos.</p>
          <p>Presión de deuda y uso de cupos.</p>
          <p>Alternativas más útiles para ese mismo dinero.</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
