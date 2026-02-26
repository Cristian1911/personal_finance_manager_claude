"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { finishOnboarding } from "@/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ArrowRight, ArrowLeft, Target, Wallet, PiggyBank, TrendingUp, CheckCircle2 } from "lucide-react";
import { trackClientEvent } from "@/lib/utils/analytics";

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Profile Form State
    const [purpose, setPurpose] = useState("");
    const [income, setIncome] = useState("");
    const [expenses, setExpenses] = useState("");
    const [fullName, setFullName] = useState("");
    const [currency, setCurrency] = useState("USD");
    const [timezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

    // Account Form State
    const [accountName, setAccountName] = useState("");
    const [accountType, setAccountType] = useState("CHECKING");
    const [balance, setBalance] = useState("");
    const startedAtRef = useRef<number>(Date.now());

    const totalSteps = 4;

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
        // Basic validation
        if (step === 1 && !purpose) {
            toast.error("Elige un objetivo para continuar.");
            return;
        }
        if (step === 2 && (!income || !expenses)) {
            toast.error("Ingresa tus ingresos y gastos estimados.");
            return;
        }
        if (step === 3 && !fullName) {
            toast.error("Ingresa tu nombre.");
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
                }
            );
            toast.success("Configuracion completada");
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
            setTimeout(() => {
                router.push("/dashboard");
            }, 1500);
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
            toast.error(error instanceof Error ? error.message : "Ocurrio un error inesperado");
        } finally {
            setLoading(false);
        }
    };

    const purposes = [
        { id: "manage_debt", label: "Salir de deudas", icon: Target },
        { id: "track_spending", label: "Entender mis gastos", icon: Wallet },
        { id: "save_money", label: "Ahorrar para una meta", icon: PiggyBank },
        { id: "improve_habits", label: "Mejorar habitos financieros", icon: TrendingUp },
    ];

    const incomeNumber = parseFloat(income) || 0;
    const expensesNumber = parseFloat(expenses) || 0;
    const availableToBudget = Math.max(incomeNumber - expensesNumber, 0);
    const progressStep = Math.min(step, totalSteps);

    return (
        <div className="mx-auto w-full max-w-lg">
            {step <= totalSteps && (
                <div className="mb-4 rounded-xl border bg-card/80 p-4">
                    <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-muted-foreground">Onboarding Venti5</span>
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
                {step === 1 && (
                    <motion.div
                        key="step1"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                    >
                        <Card className="border-border">
                            <CardHeader>
                                <CardTitle className="text-2xl">Bienvenido a Venti5</CardTitle>
                                <CardDescription>Antes de arrancar, cuentanos que quieres lograr.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4">
                                {purposes.map((p) => {
                                    const Icon = p.icon;
                                    return (
                                        <button
                                            key={p.id}
                                            onClick={() => setPurpose(p.id)}
                                            className={`flex items-center gap-4 rounded-lg border p-4 transition-all hover:bg-muted ${purpose === p.id ? "border-primary bg-primary/10" : ""
                                                }`}
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
                                    Atras
                                </Button>
                                <Button onClick={nextStep} disabled={!purpose}>
                                    Siguiente <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </CardFooter>
                        </Card>
                    </motion.div>
                )}

                {step === 2 && (
                    <motion.div
                        key="step2"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                    >
                        <Card className="border-border">
                            <CardHeader>
                                <CardTitle className="text-2xl">Pulso mensual</CardTitle>
                                <CardDescription>
                                    Arranquemos con una estimacion rapida de tus ingresos y gastos.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-6">
                                <div className="grid gap-2">
                                    <Label htmlFor="income">Ingreso mensual estimado</Label>
                                    <Input
                                        id="income"
                                        type="number"
                                        placeholder="Ej: 5000"
                                        value={income}
                                        onChange={(e) => setIncome(e.target.value)}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="expenses">Gasto mensual estimado</Label>
                                    <Input
                                        id="expenses"
                                        type="number"
                                        placeholder="Ej: 4000"
                                        value={expenses}
                                        onChange={(e) => setExpenses(e.target.value)}
                                    />
                                </div>
                                {incomeNumber > 0 && (
                                    <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                                        <p className="font-medium">Disponible para presupuesto: {availableToBudget.toLocaleString()}</p>
                                        <p className="text-muted-foreground">
                                            Esta referencia nos ayuda a sugerirte limites de gasto desde el dia 1.
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="flex justify-between border-t p-6">
                                <Button variant="ghost" onClick={prevStep}>
                                    <ArrowLeft className="mr-2 h-4 w-4" /> Atras
                                </Button>
                                <Button onClick={nextStep} disabled={!income || !expenses}>
                                    Siguiente <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </CardFooter>
                        </Card>
                    </motion.div>
                )}

                {step === 3 && (
                    <motion.div
                        key="step3"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                    >
                        <Card className="border-border">
                            <CardHeader>
                                <CardTitle className="text-2xl">Tu perfil</CardTitle>
                                <CardDescription>Personaliza como quieres ver tu dinero.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-6">
                                <div className="grid gap-2">
                                    <Label htmlFor="fullName">Nombre completo</Label>
                                    <Input
                                        id="fullName"
                                        placeholder="Ej: Maria Perez"
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
                                    <ArrowLeft className="mr-2 h-4 w-4" /> Atras
                                </Button>
                                <Button onClick={nextStep} disabled={!fullName}>
                                    Siguiente <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </CardFooter>
                        </Card>
                    </motion.div>
                )}

                {step === 4 && (
                    <motion.div
                        key="step4"
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
                                            <SelectItem value="CREDIT_CARD">Tarjeta de credito</SelectItem>
                                            <SelectItem value="CASH">Efectivo</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="balance">Saldo actual</Label>
                                    <Input
                                        id="balance"
                                        type="number"
                                        placeholder="0.00"
                                        value={balance}
                                        onChange={(e) => setBalance(e.target.value)}
                                    />
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-between border-t p-6">
                                <Button variant="ghost" onClick={prevStep} disabled={loading}>
                                    <ArrowLeft className="mr-2 h-4 w-4" /> Atras
                                </Button>
                                <Button onClick={onSubmit} disabled={loading || !accountName || !balance}>
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Finalizar
                                </Button>
                            </CardFooter>
                        </Card>
                    </motion.div>
                )}

                {step === 5 && (
                    <motion.div
                        key="step5"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                    >
                        <Card className="border-border text-center pb-8 border-transparent shadow-none bg-transparent">
                            <CardHeader>
                                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 text-green-500">
                                    <CheckCircle2 size={48} />
                                </div>
                                <CardTitle className="text-3xl">Listo, {fullName.split(" ")[0] || "vamos"}.</CardTitle>
                                <CardDescription className="text-lg mt-2">
                                    Preparando tu dashboard de Venti5...
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
