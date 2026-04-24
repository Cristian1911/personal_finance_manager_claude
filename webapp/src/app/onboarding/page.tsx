"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { finishOnboarding } from "@/actions/onboarding";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectPill } from "@/components/ui/select-pill";
import type { Database } from "@/types/database";
import {
    BRASS_BUTTON_CLASS,
    GHOST_BUTTON_CLASS,
    PANEL_INSET_INTERACTIVE_CLASS,
    PANEL_SURFACE_CLASS,
    SECTION_EYEBROW_CLASS,
} from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";
import { toast } from "sonner";
import {
    Loader2,
    ArrowRight,
    ArrowLeft,
    Target,
    Wallet,
    PiggyBank,
    TrendingUp,
    CheckCircle2,
    FileUp,
    Tags,
} from "lucide-react";
import { trackClientEvent } from "@/lib/utils/analytics";
import { getDefaultConfig } from "@/lib/dashboard-config-defaults";
import { DEFAULT_LAYOUT as DEFAULT_MOBILE_LAYOUT } from "@zeta/shared";
import type { AppPurpose } from "@/types/dashboard-config";

const OPTIONAL_STEPS = new Set([1]);

type QuickWin = { label: string; href: string; icon: typeof FileUp };

const QUICK_WIN: Record<string, QuickWin> = {
    manage_debt: { label: "Importa tu primer extracto", href: "/import", icon: FileUp },
    track_spending: { label: "Registra tu primer gasto", href: "/transactions/new", icon: Wallet },
    save_money: { label: "Configura tu primer presupuesto", href: "/presupuesto", icon: Tags },
    improve_habits: { label: "Registra tu primer gasto", href: "/transactions/new", icon: Wallet },
};

const PURPOSES = [
    { id: "manage_debt", label: "Salir de deudas", icon: Target },
    { id: "track_spending", label: "Entender mis gastos", icon: Wallet },
    { id: "save_money", label: "Ahorrar para una meta", icon: PiggyBank },
    { id: "improve_habits", label: "Mejorar hábitos financieros", icon: TrendingUp },
] as const;

const CURRENCIES = [
    { code: "COP", label: "COP" },
    { code: "USD", label: "USD" },
    { code: "MXN", label: "MXN" },
    { code: "EUR", label: "EUR" },
    { code: "BRL", label: "BRL" },
] as const;

const ACCOUNT_TYPES = [
    { code: "CHECKING", label: "Corriente" },
    { code: "SAVINGS", label: "Ahorros" },
    { code: "CREDIT_CARD", label: "Crédito" },
    { code: "CASH", label: "Efectivo" },
] as const;

const STEP_TITLES = {
    1: { title: "¿Qué quieres lograr?", sub: "Tres taps. Esto moldea todo." },
    2: { title: "Tu perfil", sub: "Personaliza cómo ves tu dinero." },
    3: { title: "Pulso mensual", sub: "Una estimación rápida para arrancar." },
    4: { title: "Primera cuenta", sub: "Luego puedes importar un extracto." },
    5: { title: "¡Listo!", sub: "" },
} as const;

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    const [purpose, setPurpose] = useState<AppPurpose | "">("");
    const [fullName, setFullName] = useState("");
    const [currency, setCurrency] = useState<CurrencyCode>("COP");
    const [timezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

    const [income, setIncome] = useState("");
    const [expenses, setExpenses] = useState("");
    const [debtCount, setDebtCount] = useState("");

    const [accountName, setAccountName] = useState("");
    const [accountType, setAccountType] =
        useState<Database["public"]["Enums"]["account_type"]>("CHECKING");
    const [balance, setBalance] = useState("");

    const startedAtRef = useRef<number>(Date.now());
    const totalSteps = 5;
    const progressStep = Math.min(step, totalSteps);

    useEffect(() => {
        void trackClientEvent({
            event_name: "onboarding_started",
            flow: "onboarding",
            step: "step_1",
            entry_point: "redirect",
            success: true,
            metadata: { step_number: 1, total_steps: totalSteps },
        });
    }, []);

    const nextStep = () => {
        if (step === 1 && !purpose) {
            toast.error("Elige un objetivo para continuar.");
            return;
        }
        if (step === 2 && !fullName.trim()) {
            toast.error("Ingresa tu nombre.");
            return;
        }
        if (step === 3 && (!income || !expenses)) {
            toast.error("Ingresa tus ingresos y gastos estimados.");
            return;
        }
        void trackClientEvent({
            event_name: "onboarding_step_completed",
            flow: "onboarding",
            step: `step_${step}`,
            entry_point: "cta",
            success: true,
            metadata: { step_number: step, total_steps: totalSteps },
        });
        setStep((prev) => Math.min(prev + 1, totalSteps));
    };

    const skipStep = (defaultAction: () => void) => {
        void trackClientEvent({
            event_name: "onboarding_step_skipped",
            flow: "onboarding",
            step: `step_${step}`,
            entry_point: "skip",
            success: true,
            metadata: { step_number: step, total_steps: totalSteps },
        });
        defaultAction();
        setStep((prev) => Math.min(prev + 1, totalSteps));
    };

    const prevStep = () => setStep((prev) => Math.max(prev - 1, 1));

    const onSubmit = async () => {
        if (!accountName.trim() || balance === "") {
            toast.error("Completa los datos de tu cuenta.");
            return;
        }
        setLoading(true);
        try {
            await finishOnboarding(
                {
                    app_purpose: purpose,
                    estimated_monthly_income: parseFloat(income) || 0,
                    estimated_monthly_expenses: parseFloat(expenses) || 0,
                    full_name: fullName,
                    preferred_currency: currency,
                    timezone,
                    locale: navigator.language || "es-CO",
                },
                {
                    name: accountName,
                    account_type: accountType,
                    current_balance: parseFloat(balance) || 0,
                },
                getDefaultConfig((purpose || "track_spending") as AppPurpose),
                DEFAULT_MOBILE_LAYOUT,
            );
            toast.success("Configuración completada");
            void trackClientEvent({
                event_name: "onboarding_completed",
                flow: "onboarding",
                step: "completed",
                entry_point: "cta",
                success: true,
                duration_ms: Date.now() - startedAtRef.current,
                metadata: { total_steps: totalSteps },
            });
            setStep(5);
        } catch (error) {
            void trackClientEvent({
                event_name: "onboarding_completed",
                flow: "onboarding",
                step: "completed",
                entry_point: "cta",
                success: false,
                duration_ms: Date.now() - startedAtRef.current,
                error_code: "finish_onboarding_failed",
            });
            toast.error(error instanceof Error ? error.message : "Ocurrió un error inesperado");
        } finally {
            setLoading(false);
        }
    };

    const incomeNumber = parseFloat(income) || 0;
    const expensesNumber = parseFloat(expenses) || 0;
    const availableToBudget = Math.max(incomeNumber - expensesNumber, 0);
    const quickWin = QUICK_WIN[purpose] ?? QUICK_WIN.track_spending;

    const headerCopy = STEP_TITLES[step as keyof typeof STEP_TITLES];

    return (
        <div className="space-y-5">
            {step < 5 && (
                <div className={cn(PANEL_SURFACE_CLASS, "p-4")}>
                    <div className="flex items-center justify-between">
                        <span className={SECTION_EYEBROW_CLASS}>Configuración</span>
                        <span className="text-[11px] font-semibold text-muted-foreground">
                            Paso {progressStep} de {totalSteps - 1}
                        </span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                        <div
                            className="h-full rounded-full bg-z-brass transition-all duration-300"
                            style={{ width: `${(progressStep / (totalSteps - 1)) * 100}%` }}
                        />
                    </div>
                    <div className="mt-3 flex items-center justify-center gap-2">
                        {Array.from({ length: totalSteps - 1 }, (_, i) => i + 1).map((s) => (
                            <div
                                key={s}
                                className={cn(
                                    "h-1.5 rounded-full transition-all duration-300",
                                    s === step
                                        ? "w-5 bg-z-brass"
                                        : s < step
                                            ? "w-2 bg-z-brass/60"
                                            : OPTIONAL_STEPS.has(s)
                                                ? "w-2 bg-white/10"
                                                : "w-2 bg-white/15",
                                )}
                            />
                        ))}
                    </div>
                </div>
            )}

            {step < 5 && (
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight">{headerCopy.title}</h2>
                    {headerCopy.sub && (
                        <p className="text-sm text-muted-foreground">{headerCopy.sub}</p>
                    )}
                </div>
            )}

            {step === 1 && (
                <div key="step1" className="animate-in fade-in slide-in-from-right-4 duration-200 space-y-4">
                    <div className="grid gap-2">
                        {PURPOSES.map((p) => {
                            const Icon = p.icon;
                            const active = purpose === p.id;
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => setPurpose(p.id)}
                                    className={cn(
                                        PANEL_INSET_INTERACTIVE_CLASS,
                                        "flex items-center gap-3 p-4 text-left transition-colors",
                                        active && "border-z-brass/40 bg-z-brass/10",
                                    )}
                                    aria-pressed={active}
                                >
                                    <span
                                        className={cn(
                                            "flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/5",
                                            active && "bg-z-brass/15 text-z-brass",
                                        )}
                                    >
                                        <Icon className="size-4" />
                                    </span>
                                    <span className="text-sm font-medium text-foreground">{p.label}</span>
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex items-center justify-between pt-2">
                        <button
                            type="button"
                            onClick={() => skipStep(() => setPurpose("track_spending"))}
                            className="text-xs text-muted-foreground hover:text-foreground"
                        >
                            Omitir
                        </button>
                        <Button onClick={nextStep} disabled={!purpose} className={BRASS_BUTTON_CLASS}>
                            Siguiente <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div key="step2" className="animate-in fade-in slide-in-from-right-4 duration-200 space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="fullName">Nombre</Label>
                        <Input
                            id="fullName"
                            placeholder="Cómo quieres que te llamemos"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            autoComplete="name"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Moneda principal</Label>
                        <div className="flex flex-wrap gap-2">
                            {CURRENCIES.map((c) => (
                                <SelectPill
                                    key={c.code}
                                    label={c.label}
                                    active={currency === c.code}
                                    onClick={() => setCurrency(c.code)}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                        <Button
                            variant="ghost"
                            onClick={prevStep}
                            className={GHOST_BUTTON_CLASS}
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" /> Atrás
                        </Button>
                        <Button onClick={nextStep} disabled={!fullName.trim()} className={BRASS_BUTTON_CLASS}>
                            Siguiente <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div key="step3" className="animate-in fade-in slide-in-from-right-4 duration-200 space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="income">Ingreso mensual estimado</Label>
                        <CurrencyInput
                            id="income"
                            placeholder="Ej: 5.000.000"
                            value={income}
                            onChange={(e) => setIncome(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="expenses">Gasto mensual estimado</Label>
                        <CurrencyInput
                            id="expenses"
                            placeholder="Ej: 4.000.000"
                            value={expenses}
                            onChange={(e) => setExpenses(e.target.value)}
                        />
                    </div>
                    {incomeNumber > 0 && (
                        <div className={cn(PANEL_INSET_INTERACTIVE_CLASS, "p-3 text-sm")}>
                            <p className="font-semibold tabular-nums text-foreground">
                                Disponible para presupuesto:{" "}
                                {formatCurrency(availableToBudget, currency)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Nos ayuda a sugerirte límites desde el día 1.
                            </p>
                        </div>
                    )}
                    {purpose === "manage_debt" && (
                        <div className="space-y-2">
                            <Label htmlFor="debtCount">Tarjetas o préstamos activos</Label>
                            <Input
                                id="debtCount"
                                type="number"
                                min="0"
                                max="20"
                                placeholder="Ej: 3"
                                value={debtCount}
                                onChange={(e) => setDebtCount(e.target.value)}
                            />
                            {debtCount && parseInt(debtCount) > 0 && (
                                <p className="text-xs text-z-income">
                                    Zeta te ayudará a organizar tus {debtCount} deudas.
                                </p>
                            )}
                        </div>
                    )}
                    <div className="flex items-center justify-between pt-2">
                        <Button variant="ghost" onClick={prevStep} className={GHOST_BUTTON_CLASS}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Atrás
                        </Button>
                        <Button onClick={nextStep} disabled={!income || !expenses} className={BRASS_BUTTON_CLASS}>
                            Siguiente <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {step === 4 && (
                <div key="step4" className="animate-in fade-in slide-in-from-right-4 duration-200 space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="accountName">Nombre de la cuenta</Label>
                        <Input
                            id="accountName"
                            placeholder="Ej: Bancolombia ahorros"
                            value={accountName}
                            onChange={(e) => setAccountName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Tipo</Label>
                        <div className="flex flex-wrap gap-2">
                            {ACCOUNT_TYPES.map((t) => (
                                <SelectPill
                                    key={t.code}
                                    label={t.label}
                                    active={accountType === t.code}
                                    onClick={() => setAccountType(t.code)}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="balance">Saldo actual</Label>
                        <CurrencyInput
                            id="balance"
                            placeholder="0"
                            value={balance}
                            onChange={(e) => setBalance(e.target.value)}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        ¿Tienes un extracto PDF? Podrás importarlo luego y tus cuentas aparecen automáticamente.
                    </p>
                    <div className="flex items-center justify-between pt-2">
                        <Button variant="ghost" onClick={prevStep} disabled={loading} className={GHOST_BUTTON_CLASS}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Atrás
                        </Button>
                        <Button
                            onClick={onSubmit}
                            disabled={loading || !accountName.trim() || balance === ""}
                            className={BRASS_BUTTON_CLASS}
                        >
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Finalizar
                        </Button>
                    </div>
                </div>
            )}

            {step === 5 && (
                <div key="step5" className="animate-in fade-in slide-in-from-right-4 duration-200 space-y-5 text-center">
                    <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-z-income/10 text-z-income">
                        <CheckCircle2 className="size-9" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-xl font-bold tracking-tight">
                            Listo, {fullName.split(" ")[0] || "vamos"}.
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Tu Zeta está configurado. ¿Qué quieres hacer primero?
                        </p>
                    </div>
                    <div className="grid gap-3">
                        <Button
                            size="lg"
                            className={cn("w-full gap-2", BRASS_BUTTON_CLASS)}
                            onClick={() => router.push(quickWin.href)}
                        >
                            <quickWin.icon className="h-5 w-5" />
                            {quickWin.label}
                        </Button>
                        <Button
                            variant="ghost"
                            size="lg"
                            className={cn("w-full", GHOST_BUTTON_CLASS)}
                            onClick={() => router.push("/dashboard")}
                        >
                            Explorar primero
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
