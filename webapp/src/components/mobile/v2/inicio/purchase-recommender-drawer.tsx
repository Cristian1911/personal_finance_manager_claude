"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowRight, Brain, CircleAlert, Loader2, PiggyBank, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import type { PurchaseDecisionResult, PurchaseFundingType, PurchaseUrgency } from "@zeta/shared";
import { analyzePurchaseDecisionAction } from "@/actions/purchase-decision";
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccounts, useOutflowCategories } from "@/components/providers/app-data-provider";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import type { Account, CategoryWithChildren } from "@/types/domain";

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
    label: "Sí, dale",
    badgeClassName: "border-z-income/30 bg-z-income/10 text-z-income",
    panelClassName: "border-z-income/20 bg-z-income/5",
  },
  BUY_WITH_CAUTION: {
    label: "Sí, con cautela",
    badgeClassName: "border-z-expense/30 bg-z-expense/10 text-z-expense",
    panelClassName: "border-z-expense/20 bg-z-expense/5",
  },
  WAIT: {
    label: "Mejor espera",
    badgeClassName: "border-orange-500/30 bg-orange-500/10 text-orange-400",
    panelClassName: "border-orange-500/20 bg-orange-500/5",
  },
  NOT_RECOMMENDED: {
    label: "No recomendado",
    badgeClassName: "border-red-500/30 bg-red-500/10 text-red-400",
    panelClassName: "border-red-500/20 bg-red-500/5",
  },
};

interface PurchaseRecommenderDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PurchaseRecommenderDrawer({ open, onOpenChange }: PurchaseRecommenderDrawerProps) {
  const allAccounts = useAccounts();
  const categories = useOutflowCategories();

  const activeAccounts = useMemo(
    () => allAccounts.filter((a) => a.account_type !== "LOAN"),
    [allAccounts]
  );

  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(activeAccounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [urgency, setUrgency] = useState<PurchaseUrgency>("USEFUL");
  const [fundingType, setFundingType] = useState<PurchaseFundingType>("ONE_TIME");
  const [installments, setInstallments] = useState("3");
  const [result, setResult] = useState<PurchaseDecisionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setAmount("");
    setAccountId(activeAccounts[0]?.id ?? "");
    setCategoryId(null);
    setUrgency("USEFUL");
    setFundingType("ONE_TIME");
    setInstallments("3");
    setResult(null);
    setError(null);
  }

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
        installments: fundingType === "INSTALLMENTS" ? Number(installments || "0") : null,
        month: format(new Date(), "yyyy-MM"),
      });

      if (!response.success || !response.data) {
        setResult(null);
        setError(response.success ? "No fue posible analizar la compra." : response.error);
        return;
      }

      setResult(response.data);
    });
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[92dvh]">
        <DrawerHeader>
          <DrawerTitle>¿Puedo comprarlo?</DrawerTitle>
          <DrawerDescription>
            Evalúa el impacto en tu liquidez, deuda y presupuesto antes de decidir.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {result ? (
            <ResultView result={result} amount={amount} fundingType={fundingType} onReset={reset} />
          ) : (
            <FormView
              activeAccounts={activeAccounts}
              categories={categories}
              amount={amount}
              setAmount={setAmount}
              accountId={accountId}
              setAccountId={setAccountId}
              categoryId={categoryId}
              setCategoryId={setCategoryId}
              urgency={urgency}
              setUrgency={setUrgency}
              fundingType={fundingType}
              setFundingType={setFundingType}
              installments={installments}
              setInstallments={setInstallments}
              error={error}
              isPending={isPending}
              onAnalyze={handleAnalyze}
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// ─── Form ────────────────────────────────────────────────────────────────────

function FormView({
  activeAccounts,
  categories,
  amount,
  setAmount,
  accountId,
  setAccountId,
  categoryId,
  setCategoryId,
  urgency,
  setUrgency,
  fundingType,
  setFundingType,
  installments,
  setInstallments,
  error,
  isPending,
  onAnalyze,
}: {
  activeAccounts: Pick<Account, "id" | "name" | "account_type">[];
  categories: CategoryWithChildren[];
  amount: string;
  setAmount: (v: string) => void;
  accountId: string;
  setAccountId: (v: string) => void;
  categoryId: string | null;
  setCategoryId: (v: string | null) => void;
  urgency: PurchaseUrgency;
  setUrgency: (v: PurchaseUrgency) => void;
  fundingType: PurchaseFundingType;
  setFundingType: (v: PurchaseFundingType) => void;
  installments: string;
  setInstallments: (v: string) => void;
  error: string | null;
  isPending: boolean;
  onAnalyze: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="drawer-amount">Monto</Label>
        <CurrencyInput
          id="drawer-amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="250.000"
        />
      </div>

      <div className="space-y-2">
        <Label>Cuenta</Label>
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona una cuenta" />
          </SelectTrigger>
          <SelectContent>
            {activeAccounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Urgencia</Label>
          <Select value={urgency} onValueChange={(v) => setUrgency(v as PurchaseUrgency)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(urgencyLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Pago</Label>
          <Select value={fundingType} onValueChange={(v) => setFundingType(v as PurchaseFundingType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ONE_TIME">Único</SelectItem>
              <SelectItem value="INSTALLMENTS">Cuotas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {fundingType === "INSTALLMENTS" && (
        <div className="space-y-2">
          <Label htmlFor="drawer-installments">Número de cuotas</Label>
          <Input
            id="drawer-installments"
            type="number"
            min="2"
            max="36"
            step="1"
            value={installments}
            onChange={(e) => setInstallments(e.target.value)}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>Categoría (opcional)</Label>
        <CategoryZonePicker
          variant="popover"
          categories={categories}
          value={categoryId}
          onValueChange={setCategoryId}
          direction="OUTFLOW"
          placeholder="Selecciona una categoría"
          triggerClassName="w-full"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button className={cn("w-full gap-2", BRASS_BUTTON_CLASS)} onClick={onAnalyze} disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Analizando…
          </>
        ) : (
          <>
            Obtener recomendación
            <Brain className="h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
}

// ─── Result ──────────────────────────────────────────────────────────────────

function ResultView({
  result,
  amount,
  fundingType,
  onReset,
}: {
  result: PurchaseDecisionResult;
  amount: string;
  fundingType: PurchaseFundingType;
  onReset: () => void;
}) {
  const meta = verdictMeta[result.verdict];

  return (
    <div className="space-y-4">
      {/* Verdict */}
      <div className={cn("rounded-xl border p-4", meta.panelClassName)}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <Badge variant="outline" className={meta.badgeClassName}>
              {meta.label}
            </Badge>
            <p className="mt-1 text-xs text-muted-foreground">
              Score {Math.round(result.score)}/100
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">
              {formatCurrency(result.metrics.effectiveImmediateImpact)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {fundingType === "INSTALLMENTS" ? "primera cuota" : "impacto inmediato"}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed">{result.summary}</p>
      </div>

      {/* Before / After */}
      <div className="rounded-xl border p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-z-sage-dark">
          Antes y después
        </p>
        <div className="divide-y divide-white/6">
          <BeforeAfterMobile
            label="Liquidez"
            before={formatCurrency(result.metrics.currentLiquidBuffer)}
            after={formatCurrency(result.metrics.projectedLiquidBuffer)}
            improved={result.metrics.projectedLiquidBuffer >= result.metrics.currentLiquidBuffer}
          />
          {result.metrics.selectedAccountUtilizationBefore !== null &&
            result.metrics.selectedAccountUtilizationAfter !== null && (
              <BeforeAfterMobile
                label="Uso de cupo"
                before={`${Math.round(result.metrics.selectedAccountUtilizationBefore)}%`}
                after={`${Math.round(result.metrics.selectedAccountUtilizationAfter)}%`}
                improved={result.metrics.selectedAccountUtilizationAfter <= result.metrics.selectedAccountUtilizationBefore}
              />
            )}
          {result.metrics.currentBudgetRemaining !== null &&
            result.metrics.budgetRemainingAfterPurchase !== null && (
              <BeforeAfterMobile
                label="Presupuesto"
                before={formatCurrency(result.metrics.currentBudgetRemaining)}
                after={formatCurrency(result.metrics.budgetRemainingAfterPurchase)}
                improved={result.metrics.budgetRemainingAfterPurchase >= result.metrics.currentBudgetRemaining}
              />
            )}
        </div>
      </div>

      {/* Reasons */}
      {result.reasons.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-z-sage-dark" />
            <p className="text-xs font-semibold uppercase tracking-wider text-z-sage-dark">Por qué</p>
          </div>
          {result.reasons.map((r) => (
            <div key={`${r.code}-${r.title}`} className="rounded-lg border border-white/6 bg-black/10 p-3">
              <div className="mb-0.5 flex items-center gap-1.5">
                <span className={cn(
                  "inline-block h-2 w-2 rounded-full",
                  r.severity === "critical" ? "bg-z-debt" : r.severity === "warning" ? "bg-z-expense" : "bg-z-income"
                )} />
                <p className="text-xs font-medium">{r.title}</p>
              </div>
              <p className="text-xs text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
      )}

      {/* Alternatives */}
      {result.alternatives.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <PiggyBank className="h-3.5 w-3.5 text-z-sage-dark" />
            <p className="text-xs font-semibold uppercase tracking-wider text-z-sage-dark">Alternativas</p>
          </div>
          {result.alternatives.map((alt) => (
            <div key={`${alt.type}-${alt.title}`} className="rounded-lg border border-white/6 bg-black/10 p-3">
              <p className="text-xs font-medium">{alt.title}</p>
              <p className="text-xs text-muted-foreground">{alt.detail}</p>
            </div>
          ))}
        </div>
      )}

      {/* New analysis */}
      <Button variant="outline" className="w-full gap-2" onClick={onReset}>
        <CircleAlert className="h-4 w-4" />
        Analizar otra compra
      </Button>
    </div>
  );
}

function BeforeAfterMobile({
  label,
  before,
  after,
  improved,
}: {
  label: string;
  before: string;
  after: string;
  improved: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{before}</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <span className={cn("text-xs font-semibold", improved ? "text-z-income" : "text-z-debt")}>
          {after}
        </span>
      </div>
    </div>
  );
}
