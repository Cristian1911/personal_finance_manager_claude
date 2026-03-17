"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { finishOnboarding } from "@/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    CreditCard,
    ArrowLeftRight,
    Repeat2,
    TrendingDown,
    LayoutDashboard,
    Menu,
    FileUp,
    Tags,
} from "lucide-react";
import { trackClientEvent } from "@/lib/utils/analytics";
import { getDefaultConfig } from "@/lib/dashboard-config-defaults";
import type { AppPurpose, DashboardConfig, TabConfig } from "@/types/dashboard-config";

const ICON_MAP: Record<string, typeof CreditCard> = {
    CreditCard,
    PiggyBank,
    ArrowLeftRight,
    Repeat2,
    TrendingDown,
    LayoutDashboard,
    Menu,
};

const TAB_OPTIONS: TabConfig[] = [
    { id: "debt-recurring", label: "Deudas", icon: "CreditCard", features: ["debt", "recurring"], position: 2 },
    { id: "movimientos", label: "Movimientos", icon: "ArrowLeftRight", features: ["transactions"], position: 2 },
    { id: "presupuesto", label: "Presupuesto", icon: "PiggyBank", features: ["budget"], position: 3 },
    { id: "presupuesto-ahorro", label: "Presupuesto", icon: "PiggyBank", features: ["budget", "savings"], position: 2 },
    { id: "movimientos-presupuesto", label: "Gastos", icon: "TrendingDown", features: ["transactions", "budget"], position: 2 },
    { id: "recurrentes", label: "Recurrentes", icon: "Repeat2", features: ["recurring"], position: 3 },
];

const QUICK_WIN: Record<string, { label: string; href: string; icon: typeof FileUp }> = {
    manage_debt: { label: "Importa tu primer extracto", href: "/import", icon: FileUp },
    track_spending: { label: "Registra tu primer gasto", href: "/dashboard", icon: Wallet },
    save_money: { label: "Configura tu primer presupuesto", href: "/categories", icon: Tags },
    improve_habits: { label: "Registra tu primer gasto", href: "/dashboard", icon: Wallet },
};

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Step 1: Purpose
    const [purpose, setPurpose] = useState("");

    // Step 2: Profile (was step 3)
    const [fullName, setFullName] = useState("");
    const [currency, setCurrency] = useState("USD");
    const [timezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

    // Step 3: Finanzas (was step 2)
    const [income, setIncome] = useState("");
    const [expenses, setExpenses] = useState("");
    const [debtCount, setDebtCount] = useState("");

    // Step 4: Tab preview
    const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig | null>(null);

    // Step 5: First account
    const [accountName, setAccountName] = useState("");
    const [accountType, setAccountType] = useState("CHECKING");
    const [balance, setBalance] = useState("");

    const startedAtRef = useRef<number>(Date.now());
    const totalSteps = 6;

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

    // Generate dashboard config when purpose is selected and we reach step 4
    useEffect(() => {
        if (step === 4 && purpose && !dashboardConfig) {
            setDashboardConfig(getDefaultConfig(purpose as AppPurpose));
        }
    }, [step, purpose, dashboardConfig]);

    const nextStep = () => {
        if (step === 1 && !purpose) {
            toast.error("Elige un objetivo para continuar.");
            return;
        }
        if (step === 2 && !fullName) {
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

    const prevStep = () => setStep((prev) => Math.max(prev - 1, 1));

    const onSubmit = async () => {
        if (!accountName || !balance) {
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
                    locale: navigator.language || "en-US",
                },
                {
                    name: accountName,
                    account_type: accountType,
                    current_balance: parseFloat(balance) || 0,
                },
                dashboardConfig,
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
            // Go to quick win step
            setStep(6);
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

    function swapTab(position: 2 | 3) {
        if (!dashboardConfig) return;
        const current = dashboardConfig.tabs.find(t => t.position === position);
        // Get available options not already in use
        const usedIds = new Set(dashboardConfig.tabs.map(t => t.id));
        const available = TAB_OPTIONS.filter(t => !usedIds.has(t.id));
        if (available.length === 0) return;

        // Cycle to next option
        const currentIdx = TAB_OPTIONS.findIndex(t => t.id === current?.id);
        let nextIdx = (currentIdx + 1) % TAB_OPTIONS.length;
        while (usedIds.has(TAB_OPTIONS[nextIdx].id) && nextIdx !== currentIdx) {
            nextIdx = (nextIdx + 1) % TAB_OPTIONS.length;
        }
        const next = { ...TAB_OPTIONS[nextIdx], position };

        setDashboardConfig({
            ...dashboardConfig,
            tabs: dashboardConfig.tabs.map(t => t.position === position ? next : t),
        });
    }

    const purposes = [
        { id: "manage_debt", label: "Salir de deudas", icon: Target },
        { id: "track_spending", label: "Entender mis gastos", icon: Wallet },
        { id: "save_money", label: "Ahorrar para una meta", icon: PiggyBank },
        { id: "improve_habits", label: "Mejorar hábitos financieros", icon: TrendingUp },
    ];

    const incomeNumber = parseFloat(income) || 0;
    const expensesNumber = parseFloat(expenses) || 0;
    const availableToBudget = Math.max(incomeNumber - expensesNumber, 0);
    const progressStep = Math.min(step, totalSteps);

    const quickWin = QUICK_WIN[purpose] ?? QUICK_WIN.track_spending;

    return (
        <div className="mx-auto w-full max-w-lg">
            {step <= totalSteps && step < 6 && (
                <div className="mb-4 rounded-xl border bg-card/80 p-4">
                    <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-muted-foreground">Onboarding Zeta</span>
                        <span className="font-semibold">Paso {progressStep} de {totalSteps}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                        <div
                            className="h-2 rounded-full bg-primary transition-all"
                            style={{ width: `${(progressStep / totalSteps) * 100}%` }}
                        />
                    </div>
                </div>
            )}
            <AnimatePresence mode="wait">
                {/* Step 1: Objetivo (unchanged) */}
                {step === 1 && (
                    <motion.div
                        key="step1"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                    >
                        <Card className="border-border">
                            <CardHeader>
                                <CardTitle className="text-2xl">Bienvenido a Zeta</CardTitle>
                                <CardDescription>Antes de arrancar, cuéntanos qué quieres lograr.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4">
                                {purposes.map((p) => {
                                    const Icon = p.icon;
                                    return (
                                        <button
                                            key={p.id}
                                            onClick={() => setPurpose(p.id)}
                                            className={`flex items-center gap-4 rounded-lg border p-4 transition-all hover:bg-muted ${purpose === p.id ? "border-primary bg-primary/10" : ""}`}
                                        >
                                            <div className="rounded-full bg-muted p-2 text-primary">
                                                <Icon size={24} />
                                            </div>
                                            <span className="font-medium text-foreground">{p.label}</span>
                                        </button>
                                    );
                                })}
                            </CardContent>
                            <CardFooter className="flex justify-between border-t p-6">
                                <Button variant="ghost" disabled>
                                    Atrás
                                </Button>
                                <Button onClick={nextStep} disabled={!purpose}>
                                    Siguiente <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </CardFooter>
                        </Card>
                    </motion.div>
                )}

                {/* Step 2: Perfil (was step 3) */}
                {step === 2 && (
                    <motion.div
                        key="step2"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                    >
                        <Card className="border-border">
                            <CardHeader>
                                <CardTitle className="text-2xl">Tu perfil</CardTitle>
                                <CardDescription>Personaliza cómo quieres ver tu dinero.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-6">
                                <div className="grid gap-2">
                                    <Label htmlFor="fullName">Nombre completo</Label>
                                    <Input
                                        id="fullName"
                                        placeholder="Ej: María Pérez"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="currency">Moneda preferida</Label>
                                    <Select value={currency} onValueChange={setCurrency}>
                                        <SelectTrigger id="currency">
                                            <SelectValue placeholder="Selecciona una moneda" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="USD">USD ($)</SelectItem>
                                            <SelectItem value="EUR">EUR (€)</SelectItem>
                                            <SelectItem value="COP">COP ($)</SelectItem>
                                            <SelectItem value="MXN">MXN ($)</SelectItem>
                                            <SelectItem value="BRL">BRL (R$)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-between border-t p-6">
                                <Button variant="ghost" onClick={prevStep}>
                                    <ArrowLeft className="mr-2 h-4 w-4" /> Atrás
                                </Button>
                                <Button onClick={nextStep} disabled={!fullName}>
                                    Siguiente <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </CardFooter>
                        </Card>
                    </motion.div>
                )}

                {/* Step 3: Finanzas (was step 2, enhanced) */}
                {step === 3 && (
                    <motion.div
                        key="step3"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                    >
                        <Card className="border-border">
                            <CardHeader>
                                <CardTitle className="text-2xl">Pulso mensual</CardTitle>
                                <CardDescription>
                                    Arranquemos con una estimación rápida de tus ingresos y gastos.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-6">
                                <div className="grid gap-2">
                                    <Label htmlFor="income">Ingreso mensual estimado</Label>
                                    <CurrencyInput
                                        id="income"
                                        placeholder="Ej: 5.000"
                                        value={income}
                                        onChange={(e) => setIncome(e.target.value)}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="expenses">Gasto mensual estimado</Label>
                                    <CurrencyInput
                                        id="expenses"
                                        placeholder="Ej: 4.000"
                                        value={expenses}
                                        onChange={(e) => setExpenses(e.target.value)}
                                    />
                                </div>
                                {incomeNumber > 0 && (
                                    <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                                        <p className="font-medium">Disponible para presupuesto: {availableToBudget.toLocaleString()}</p>
                                        <p className="text-muted-foreground">
                                            Esta referencia nos ayuda a sugerirte límites de gasto desde el día 1.
                                        </p>
                                    </div>
                                )}
                                {/* Enhanced: debt count for manage_debt users */}
                                {purpose === "manage_debt" && (
                                    <div className="grid gap-2">
                                        <Label htmlFor="debtCount">¿Cuántas tarjetas de crédito o préstamos tienes?</Label>
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
                                            <p className="text-sm text-z-income">
                                                Perfecto, Zeta te ayudará a organizar tus {debtCount} deudas.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="flex justify-between border-t p-6">
                                <Button variant="ghost" onClick={prevStep}>
                                    <ArrowLeft className="mr-2 h-4 w-4" /> Atrás
                                </Button>
                                <Button onClick={nextStep} disabled={!income || !expenses}>
                                    Siguiente <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </CardFooter>
                        </Card>
                    </motion.div>
                )}

                {/* Step 4: Tu app — tab preview (NEW) */}
                {step === 4 && dashboardConfig && (
                    <motion.div
                        key="step4"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                    >
                        <Card className="border-border">
                            <CardHeader>
                                <CardTitle className="text-2xl">Tu app</CardTitle>
                                <CardDescription>
                                    Basado en tu objetivo, así se ve tu Zeta. Toca las pestañas para cambiarlas.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {/* Phone mockup */}
                                <div className="mx-auto w-64 rounded-2xl border-2 border-border bg-z-ink p-3">
                                    {/* Screen content placeholder */}
                                    <div className="h-48 rounded-xl bg-z-surface flex items-center justify-center">
                                        <p className="text-sm text-muted-foreground">Tu dashboard</p>
                                    </div>
                                    {/* Tab bar mockup */}
                                    <div className="mt-3 flex items-center justify-around rounded-xl bg-z-surface-2 p-2">
                                        {/* Tab 1: fixed */}
                                        <div className="flex flex-col items-center gap-0.5">
                                            <LayoutDashboard className="size-4 text-primary" />
                                            <span className="text-[9px] font-bold text-primary">Inicio</span>
                                        </div>
                                        {/* Tab 2: tappable */}
                                        <button
                                            type="button"
                                            onClick={() => swapTab(2)}
                                            className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 hover:bg-z-surface-3 transition-colors"
                                        >
                                            {(() => {
                                                const tab = dashboardConfig.tabs.find(t => t.position === 2);
                                                const Icon = ICON_MAP[tab?.icon ?? "PiggyBank"] ?? PiggyBank;
                                                return (
                                                    <>
                                                        <Icon className="size-4 text-muted-foreground" />
                                                        <span className="text-[9px] text-muted-foreground">{tab?.label ?? "?"}</span>
                                                    </>
                                                );
                                            })()}
                                        </button>
                                        {/* Tab 3: tappable */}
                                        <button
                                            type="button"
                                            onClick={() => swapTab(3)}
                                            className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 hover:bg-z-surface-3 transition-colors"
                                        >
                                            {(() => {
                                                const tab = dashboardConfig.tabs.find(t => t.position === 3);
                                                const Icon = ICON_MAP[tab?.icon ?? "PiggyBank"] ?? PiggyBank;
                                                return (
                                                    <>
                                                        <Icon className="size-4 text-muted-foreground" />
                                                        <span className="text-[9px] text-muted-foreground">{tab?.label ?? "?"}</span>
                                                    </>
                                                );
                                            })()}
                                        </button>
                                        {/* Tab 4: fixed */}
                                        <div className="flex flex-col items-center gap-0.5">
                                            <Menu className="size-4 text-muted-foreground" />
                                            <span className="text-[9px] text-muted-foreground">Más</span>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground text-center mt-4">
                                    Toca las pestañas del centro para explorar opciones
                                </p>
                            </CardContent>
                            <CardFooter className="flex justify-between border-t p-6">
                                <Button variant="ghost" onClick={prevStep}>
                                    <ArrowLeft className="mr-2 h-4 w-4" /> Atrás
                                </Button>
                                <Button onClick={nextStep}>
                                    Siguiente <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </CardFooter>
                        </Card>
                    </motion.div>
                )}

                {/* Step 5: Primera cuenta (was step 4) */}
                {step === 5 && (
                    <motion.div
                        key="step5"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                    >
                        <Card className="border-border">
                            <CardHeader>
                                <CardTitle className="text-2xl">Primera cuenta</CardTitle>
                                <CardDescription>
                                    Agrega tu cuenta principal para empezar con datos reales.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-6">
                                <div className="grid gap-2">
                                    <Label htmlFor="accountName">Nombre de la cuenta</Label>
                                    <Input
                                        id="accountName"
                                        placeholder="Ej: Cuenta principal"
                                        value={accountName}
                                        onChange={(e) => setAccountName(e.target.value)}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="accountType">Tipo de cuenta</Label>
                                    <Select value={accountType} onValueChange={setAccountType}>
                                        <SelectTrigger id="accountType">
                                            <SelectValue placeholder="Selecciona tipo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CHECKING">Corriente</SelectItem>
                                            <SelectItem value="SAVINGS">Ahorros</SelectItem>
                                            <SelectItem value="CREDIT_CARD">Tarjeta de crédito</SelectItem>
                                            <SelectItem value="CASH">Efectivo</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="balance">Saldo actual</Label>
                                    <CurrencyInput
                                        id="balance"
                                        placeholder="0"
                                        value={balance}
                                        onChange={(e) => setBalance(e.target.value)}
                                    />
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-between border-t p-6">
                                <Button variant="ghost" onClick={prevStep} disabled={loading}>
                                    <ArrowLeft className="mr-2 h-4 w-4" /> Atrás
                                </Button>
                                <Button onClick={onSubmit} disabled={loading || !accountName || !balance}>
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Finalizar
                                </Button>
                            </CardFooter>
                        </Card>
                    </motion.div>
                )}

                {/* Step 6: Quick win (NEW) */}
                {step === 6 && (
                    <motion.div
                        key="step6"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                    >
                        <Card className="border-border">
                            <CardHeader className="text-center">
                                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-z-income/10 text-z-income">
                                    <CheckCircle2 size={40} />
                                </div>
                                <CardTitle className="text-2xl">Listo, {fullName.split(" ")[0] || "vamos"}!</CardTitle>
                                <CardDescription className="text-base mt-1">
                                    Tu Zeta está configurado. ¿Qué quieres hacer primero?
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-3">
                                <Button
                                    size="lg"
                                    className="w-full gap-2"
                                    onClick={() => router.push(quickWin.href)}
                                >
                                    <quickWin.icon className="h-5 w-5" />
                                    {quickWin.label}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="lg"
                                    className="w-full"
                                    onClick={() => router.push("/dashboard")}
                                >
                                    Explorar primero
                                </Button>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
