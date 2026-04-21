"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Ban,
  CheckCircle2,
  Clock,
  CreditCard,
  Heart,
  Landmark,
  Loader2,
  PiggyBank,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import type {
  PurchaseDecisionResult,
  PurchaseFundingType,
  PurchaseUrgency,
} from "@zeta/shared";
import { analyzePurchaseDecisionAction } from "@/actions/purchase-decision";
import { saveAffordToWishlist } from "@/actions/wishlist";
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import {
  useAccounts,
  useOutflowCategories,
} from "@/components/providers/app-data-provider";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import {
  BRASS_BUTTON_CLASS,
  BRASS_GHOST_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  PAGE_STACK_CLASS,
  PANEL_INSET_CLASS,
  PANEL_SURFACE_CLASS,
  SECTION_EYEBROW_CLASS,
} from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

type Verdict = PurchaseDecisionResult["verdict"];

const URGENCY_OPTIONS: { value: PurchaseUrgency; label: string }[] = [
  { value: "NECESSARY", label: "Necesidad" },
  { value: "USEFUL", label: "Útil" },
  { value: "IMPULSE", label: "Capricho" },
];

const FUNDING_OPTIONS: { value: PurchaseFundingType; label: string }[] = [
  { value: "ONE_TIME", label: "Pago único" },
  { value: "INSTALLMENTS", label: "Cuotas" },
];

type VerdictMeta = {
  label: string;
  icon: typeof ShieldCheck;
  tone: "income" | "alert" | "expense" | "debt";
  border: string;
  badgeBg: string;
  badgeText: string;
  scoreColor: string;
};

const VERDICT_META: Record<Verdict, VerdictMeta> = {
  BUY: {
    label: "Sí, adelante",
    icon: ShieldCheck,
    tone: "income",
    border: "border-z-income/30",
    badgeBg: "bg-z-income/12",
    badgeText: "text-z-income",
    scoreColor: "text-z-income",
  },
  BUY_WITH_CAUTION: {
    label: "Sí, con cautela",
    icon: TriangleAlert,
    tone: "alert",
    border: "border-z-brass/30",
    badgeBg: "bg-z-brass/12",
    badgeText: "text-z-brass",
    scoreColor: "text-z-brass",
  },
  WAIT: {
    label: "Mejor espera",
    icon: Clock,
    tone: "expense",
    border: "border-z-expense/30",
    badgeBg: "bg-z-expense/12",
    badgeText: "text-z-expense",
    scoreColor: "text-z-expense",
  },
  NOT_RECOMMENDED: {
    label: "No recomendado",
    icon: Ban,
    tone: "debt",
    border: "border-z-debt/30",
    badgeBg: "bg-z-debt/12",
    badgeText: "text-z-debt",
    scoreColor: "text-z-debt",
  },
};

const SEVERITY_DOT: Record<string, string> = {
  positive: "bg-z-income",
  warning: "bg-z-expense",
  critical: "bg-z-debt",
};

const ACCOUNT_ICON: Record<string, typeof Landmark> = {
  CHECKING: Landmark,
  SAVINGS: PiggyBank,
  CREDIT_CARD: CreditCard,
  CASH: Wallet,
};

interface AffordPageClientProps {
  defaultMonth: string;
  defaultCurrency: CurrencyCode;
}

export function AffordPageClient({
  defaultMonth,
  defaultCurrency,
}: AffordPageClientProps) {
  const router = useRouter();
  const accounts = useAccounts();
  const categories = useOutflowCategories();
  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.account_type !== "LOAN"),
    [accounts],
  );

  const [isAnalyzing, startAnalyze] = useTransition();
  const [isSaving, startSave] = useTransition();

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(activeAccounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [urgency, setUrgency] = useState<PurchaseUrgency>("USEFUL");
  const [fundingType, setFundingType] =
    useState<PurchaseFundingType>("ONE_TIME");
  const [installments, setInstallments] = useState("3");

  const [result, setResult] = useState<PurchaseDecisionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedToWishlist, setSavedToWishlist] = useState(false);
  const [savedWishlistId, setSavedWishlistId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const selectedAccount = useMemo(
    () => activeAccounts.find((a) => a.id === accountId) ?? null,
    [activeAccounts, accountId],
  );

  const currency: CurrencyCode =
    (selectedAccount?.currency_code as CurrencyCode | undefined) ??
    defaultCurrency;

  useEffect(() => {
    setResult(null);
    setSavedToWishlist(false);
    setSavedWishlistId(null);
    setSaveError(null);
  }, [amount, accountId, categoryId, urgency, fundingType, installments]);

  function handleAnalyze() {
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setError("Ingresa un monto válido.");
      return;
    }
    if (!accountId) {
      setError("Selecciona una cuenta.");
      return;
    }

    setError(null);
    startAnalyze(async () => {
      const response = await analyzePurchaseDecisionAction({
        amount: numAmount,
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
        setError(
          response.success
            ? "No fue posible analizar la compra."
            : response.error,
        );
        return;
      }

      setResult(response.data);
      // Scroll verdict into view on mobile after render settles.
      requestAnimationFrame(() => {
        document
          .getElementById("afford-verdict")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function handleSaveToWishlist() {
    if (!result) return;
    const numAmount = Number(amount);
    if (!numAmount) return;

    const fallbackName =
      name.trim().length > 0
        ? name.trim()
        : result.summary.length > 60
          ? `${result.summary.slice(0, 57).trim()}…`
          : (result.summary || "Compra por decidir");

    setSaveError(null);
    startSave(async () => {
      const response = await saveAffordToWishlist({
        name: fallbackName,
        amount: numAmount,
        currency_code: currency,
        urgency,
        funding_type: fundingType,
        installments:
          fundingType === "INSTALLMENTS" ? Number(installments || "0") : null,
        account_id: accountId || null,
        category_id: categoryId ?? null,
        why: result.reasons[0]?.detail ?? null,
        last_verdict: result.verdict,
        last_score: Math.round(result.score),
      });

      if (!response.success) {
        setSaveError(response.error);
        return;
      }
      setSavedToWishlist(true);
      setSavedWishlistId(response.data.id);
    });
  }

  function handleReset() {
    setName("");
    setAmount("");
    setAccountId(activeAccounts[0]?.id ?? "");
    setCategoryId(null);
    setUrgency("USEFUL");
    setFundingType("ONE_TIME");
    setInstallments("3");
    setResult(null);
    setError(null);
    setSavedToWishlist(false);
    setSavedWishlistId(null);
    setSaveError(null);
  }

  const verdictMeta = result ? VERDICT_META[result.verdict] : null;
  const shouldOfferWishlist =
    result !== null &&
    (result.verdict === "WAIT" ||
      result.verdict === "NOT_RECOMMENDED" ||
      result.verdict === "BUY_WITH_CAUTION");

  if (activeAccounts.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 lg:py-10">
        <div
          className={cn(
            PANEL_SURFACE_CLASS,
            "p-6 text-center",
          )}
        >
          <p className={SECTION_EYEBROW_CLASS}>Compra consciente</p>
          <h1 className="mt-2 text-xl font-semibold text-foreground">
            Necesitas al menos una cuenta activa
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Crea una cuenta (diferente a un préstamo) para empezar a evaluar
            compras.
          </p>
          <Link
            href="/accounts"
            className={cn(
              BRASS_BUTTON_CLASS,
              "mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold",
            )}
          >
            Ir a cuentas
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 lg:py-10">
      <div className={PAGE_STACK_CLASS}>
        {/* Header eyebrow */}
        <div className="hidden lg:block">
          <p className={SECTION_EYEBROW_CLASS}>Compra consciente</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight lg:text-3xl">
            ¿Debería comprar esto?
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Evalúa impacto en tu liquidez, deuda y presupuesto antes de
            decidir. Respuesta corta y honesta.
          </p>
        </div>

        {/* Form */}
        <section className="space-y-5">
          <div className="space-y-2">
            <label
              htmlFor="afford-name"
              className={SECTION_EYEBROW_CLASS}
            >
              ¿Qué es?
            </label>
            <Input
              id="afford-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="AirPods Pro · Zapatos · Curso…"
              maxLength={200}
              className="h-12 rounded-xl"
            />
            <p className="text-[11px] text-muted-foreground">
              Opcional. Se usa para guardar en deseos.
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="afford-amount"
              className={SECTION_EYEBROW_CLASS}
            >
              ¿Cuánto cuesta?
            </label>
            <CurrencyInput
              id="afford-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="250.000"
              className="h-12 rounded-xl text-lg font-semibold tabular-nums"
            />
          </div>

          <div className="space-y-2">
            <p className={SECTION_EYEBROW_CLASS}>Desde qué cuenta</p>
            <div className="flex flex-wrap gap-2">
              {activeAccounts.map((a) => {
                const isSelected = a.id === accountId;
                const Icon = ACCOUNT_ICON[a.account_type] ?? Landmark;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAccountId(a.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors",
                      isSelected
                        ? "border-z-brass bg-z-brass/12 text-foreground"
                        : "border-white/6 bg-white/[0.02] text-z-sage-light hover:bg-white/5",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-3.5",
                        isSelected ? "text-z-brass" : "text-z-sage-dark",
                      )}
                      strokeWidth={2}
                    />
                    {a.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <p className={SECTION_EYEBROW_CLASS}>Urgencia</p>
              <div className="flex gap-2">
                {URGENCY_OPTIONS.map((opt) => {
                  const isSelected = urgency === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setUrgency(opt.value)}
                      aria-pressed={isSelected}
                      className={cn(
                        "flex-1 rounded-xl border px-3 py-2.5 text-center text-sm font-semibold transition-colors",
                        isSelected
                          ? "border-z-brass bg-z-brass/12 text-foreground"
                          : "border-white/6 bg-white/[0.02] text-z-sage-light hover:bg-white/5",
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className={SECTION_EYEBROW_CLASS}>Forma de pago</p>
              <div className="flex gap-2">
                {FUNDING_OPTIONS.map((opt) => {
                  const isSelected = fundingType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFundingType(opt.value)}
                      aria-pressed={isSelected}
                      className={cn(
                        "flex-1 rounded-xl border px-3 py-2.5 text-center text-sm font-semibold transition-colors",
                        isSelected
                          ? "border-z-brass bg-z-brass/12 text-foreground"
                          : "border-white/6 bg-white/[0.02] text-z-sage-light hover:bg-white/5",
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {fundingType === "INSTALLMENTS" && (
            <div className="space-y-2">
              <label
                htmlFor="afford-installments"
                className={SECTION_EYEBROW_CLASS}
              >
                Número de cuotas
              </label>
              <Input
                id="afford-installments"
                type="number"
                inputMode="numeric"
                min={2}
                max={36}
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
          )}

          <div className="space-y-2">
            <p className={SECTION_EYEBROW_CLASS}>Categoría (opcional)</p>
            <CategoryZonePicker
              variant="popover"
              categories={categories}
              value={categoryId}
              onValueChange={setCategoryId}
              direction="OUTFLOW"
              placeholder="Asigna una categoría"
              triggerClassName="w-full h-11 rounded-xl"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-z-debt/20 bg-z-debt/5 p-3 text-sm text-z-debt">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className={cn(
              BRASS_BUTTON_CLASS,
              "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Analizando
              </>
            ) : result ? (
              "Analizar de nuevo"
            ) : (
              "Analizar"
            )}
          </button>
        </section>

        {/* Results */}
        {result && verdictMeta && (
          <section className="space-y-4">
            {/* Verdict hero */}
            <div
              id="afford-verdict"
              className={cn(
                "rounded-2xl border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
                verdictMeta.border,
                "bg-z-surface-2/80",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-1.5",
                    verdictMeta.badgeBg,
                  )}
                >
                  <verdictMeta.icon
                    className={cn("size-4", verdictMeta.badgeText)}
                    strokeWidth={2.2}
                  />
                  <span
                    className={cn(
                      "text-xs font-bold",
                      verdictMeta.badgeText,
                    )}
                  >
                    {verdictMeta.label}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span
                    className={cn(
                      "text-[32px] font-bold tabular-nums",
                      verdictMeta.scoreColor,
                    )}
                  >
                    {Math.round(result.score)}
                  </span>
                  <span className="text-sm text-z-sage-dark">/100</span>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-foreground">
                {result.summary}
              </p>
            </div>

            {/* Metrics grid */}
            <div className={cn(PANEL_INSET_CLASS, "p-4")}>
              <p className={SECTION_EYEBROW_CLASS}>Impacto financiero</p>
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <MetricTile
                  label="Desembolso"
                  value={formatCurrency(
                    result.metrics.effectiveImmediateImpact,
                    currency,
                  )}
                />
                <MetricTile
                  label="Colchón proyectado"
                  value={formatCurrency(
                    result.metrics.projectedLiquidBuffer,
                    currency,
                  )}
                />
                <MetricTile
                  label="Colchón recomendado"
                  value={formatCurrency(
                    result.metrics.recommendedBuffer,
                    currency,
                  )}
                />
                <MetricTile
                  label="Flujo libre mensual"
                  value={formatCurrency(
                    result.metrics.monthlyFreeCashflow,
                    currency,
                  )}
                />
                {result.metrics.estimatedMonthlyInstallment > 0 && (
                  <MetricTile
                    label="Cuota estimada"
                    value={formatCurrency(
                      result.metrics.estimatedMonthlyInstallment,
                      currency,
                    )}
                  />
                )}
                {result.metrics.selectedAccountUtilizationAfter != null && (
                  <MetricTile
                    label="Uso del cupo después"
                    value={`${Math.round(result.metrics.selectedAccountUtilizationAfter)}%`}
                  />
                )}
                {result.metrics.currentBudgetRemaining !== null &&
                  result.metrics.budgetRemainingAfterPurchase !== null && (
                    <MetricTile
                      label="Presupuesto restante"
                      value={formatCurrency(
                        result.metrics.budgetRemainingAfterPurchase,
                        currency,
                      )}
                    />
                  )}
              </div>
            </div>

            {/* Reasons */}
            {result.reasons.length > 0 && (
              <div className={cn(PANEL_INSET_CLASS, "p-4")}>
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="size-3.5 text-z-sage-dark" />
                  <p className={SECTION_EYEBROW_CLASS}>Por qué</p>
                </div>
                <div className="mt-3 space-y-3">
                  {result.reasons.map((r, i) => (
                    <div
                      key={`${r.code}-${i}`}
                      className="flex gap-2.5"
                    >
                      <span
                        className={cn(
                          "mt-1.5 inline-block size-2 shrink-0 rounded-full",
                          SEVERITY_DOT[r.severity] ?? "bg-z-sage-dark",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          {r.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {r.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alternatives — "caminos más seguros" */}
            {result.alternatives.length > 0 && (
              <div className={cn(PANEL_INSET_CLASS, "p-4")}>
                <div className="flex items-center gap-1.5">
                  <PiggyBank className="size-3.5 text-z-sage-dark" />
                  <p className={SECTION_EYEBROW_CLASS}>
                    Caminos más seguros
                  </p>
                </div>
                <div className="mt-3 space-y-3">
                  {result.alternatives.map((alt, i) => (
                    <div
                      key={`${alt.type}-${i}`}
                      className="rounded-xl border border-white/6 bg-white/[0.02] p-3"
                    >
                      <p className="text-sm font-semibold text-foreground">
                        {alt.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {alt.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Decision actions */}
            <div
              className={cn(PANEL_SURFACE_CLASS, "p-4")}
              aria-label="Decidir"
            >
              <p className={SECTION_EYEBROW_CLASS}>Decidir</p>
              <div className="mt-3 space-y-2">
                <Link
                  href="/transactions/new?type=expense"
                  className={cn(
                    "flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition-colors",
                    BRASS_BUTTON_CLASS,
                  )}
                >
                  <span className="flex flex-col text-left">
                    <span>Comprar ahora</span>
                    <span className="text-[11px] font-normal opacity-80">
                      Registra el gasto hoy
                    </span>
                  </span>
                  <ArrowRight className="size-4" />
                </Link>

                {shouldOfferWishlist && !savedToWishlist && (
                  <button
                    type="button"
                    onClick={handleSaveToWishlist}
                    disabled={isSaving}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition-colors",
                      BRASS_GHOST_BUTTON_CLASS,
                      "disabled:cursor-not-allowed disabled:opacity-60",
                    )}
                  >
                    <span className="flex flex-col text-left">
                      <span>Guardar en deseos</span>
                      <span className="text-[11px] font-normal opacity-80">
                        Decide más tarde · guarda el veredicto
                      </span>
                    </span>
                    {isSaving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Heart className="size-4" />
                    )}
                  </button>
                )}

                {savedToWishlist && (
                  <div className="space-y-2">
                    <div
                      aria-live="polite"
                      className="flex items-center justify-center gap-2 rounded-xl border border-z-income/30 bg-z-income/12 px-4 py-3"
                    >
                      <CheckCircle2
                        className="size-4 text-z-income"
                        strokeWidth={2}
                      />
                      <span className="text-sm font-semibold text-z-income">
                        Guardado en deseos
                      </span>
                    </div>
                    <Link
                      href={
                        savedWishlistId
                          ? `/plan?tab=deseos#${savedWishlistId}`
                          : "/plan?tab=deseos"
                      }
                      className="block text-center text-sm font-semibold text-z-brass hover:underline"
                    >
                      Ver en Deseos →
                    </Link>
                  </div>
                )}

                {saveError && (
                  <p className="rounded-lg border border-z-debt/20 bg-z-debt/5 px-3 py-2 text-xs text-z-debt">
                    {saveError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleReset}
                  className={cn(
                    GHOST_BUTTON_CLASS,
                    "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold",
                  )}
                >
                  <span className="flex flex-col text-left">
                    <span>Descartar</span>
                    <span className="text-[11px] font-normal opacity-70">
                      Sin rastro · empieza otra evaluación
                    </span>
                  </span>
                  <Ban className="size-4" />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.back()}
              className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              ← Volver
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn(PANEL_INSET_CLASS, "px-3 py-2.5")}>
      <p className={SECTION_EYEBROW_CLASS}>{label}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
