"use client";

import { useState } from "react";
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

    const totalSteps = 4;

    const nextStep = () => {
        // Basic validation
        if (step === 1 && !purpose) {
            toast.error("Please select a purpose to continue.");
            return;
        }
        if (step === 2 && (!income || !expenses)) {
            toast.error("Please enter your estimated income and expenses.");
            return;
        }
        if (step === 3 && !fullName) {
            toast.error("Please enter your name.");
            return;
        }
        setStep((prev) => Math.min(prev + 1, totalSteps));
    };

    const prevStep = () => setStep((prev) => Math.max(prev - 1, 1));

    const onSubmit = async () => {
        if (!accountName || !balance) {
            toast.error("Please provide your account details.");
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
            toast.success("Setup complete!");
            // Step 5 is success (simulated by state change or redirect)
            setStep(5);
            setTimeout(() => {
                router.push("/dashboard");
            }, 1500);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "An unknown error occurred");
        } finally {
            setLoading(false);
        }
    };

    const purposes = [
        { id: "manage_debt", label: "Get out of debt", icon: Target },
        { id: "track_spending", label: "Know my income/spending", icon: Wallet },
        { id: "save_money", label: "Save for a goal", icon: PiggyBank },
        { id: "improve_habits", label: "Improve financial habits", icon: TrendingUp },
    ];

    return (
        <div className="mx-auto w-full max-w-lg">
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
                                <CardTitle className="text-2xl">Welcome to your PF App!</CardTitle>
                                <CardDescription>First, what brings you here?</CardDescription>
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
                                    Back
                                </Button>
                                <Button onClick={nextStep} disabled={!purpose}>
                                    Next <ArrowRight className="ml-2 h-4 w-4" />
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
                                <CardTitle className="text-2xl">Financial Awareness</CardTitle>
                                <CardDescription>
                                    Let&apos;s see how well you know your finances! What do you think
                                    your average monthly income and spending are?
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-6">
                                <div className="grid gap-2">
                                    <Label htmlFor="income">Estimated Monthly Income</Label>
                                    <Input
                                        id="income"
                                        type="number"
                                        placeholder="e.g. 5000"
                                        value={income}
                                        onChange={(e) => setIncome(e.target.value)}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="expenses">Estimated Monthly Expenses</Label>
                                    <Input
                                        id="expenses"
                                        type="number"
                                        placeholder="e.g. 4000"
                                        value={expenses}
                                        onChange={(e) => setExpenses(e.target.value)}
                                    />
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-between border-t p-6">
                                <Button variant="ghost" onClick={prevStep}>
                                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                                </Button>
                                <Button onClick={nextStep} disabled={!income || !expenses}>
                                    Next <ArrowRight className="ml-2 h-4 w-4" />
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
                                <CardTitle className="text-2xl">Profile Basics</CardTitle>
                                <CardDescription>How should we call you and display your money?</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-6">
                                <div className="grid gap-2">
                                    <Label htmlFor="fullName">Full Name</Label>
                                    <Input
                                        id="fullName"
                                        placeholder="e.g. John Doe"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="currency">Preferred Currency</Label>
                                    <Select value={currency} onValueChange={setCurrency}>
                                        <SelectTrigger id="currency">
                                            <SelectValue placeholder="Select a currency" />
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
                                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                                </Button>
                                <Button onClick={nextStep} disabled={!fullName}>
                                    Next <ArrowRight className="ml-2 h-4 w-4" />
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
                                <CardTitle className="text-2xl">Add First Account</CardTitle>
                                <CardDescription>
                                    Let&apos;s find out the truth. Add your primary account to start
                                    evaluating your numbers.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-6">
                                <div className="grid gap-2">
                                    <Label htmlFor="accountName">Account Name</Label>
                                    <Input
                                        id="accountName"
                                        placeholder="e.g. Main Checking, Chase Sapphire"
                                        value={accountName}
                                        onChange={(e) => setAccountName(e.target.value)}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="accountType">Account Type</Label>
                                    <Select value={accountType} onValueChange={setAccountType}>
                                        <SelectTrigger id="accountType">
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CHECKING">Checking</SelectItem>
                                            <SelectItem value="SAVINGS">Savings</SelectItem>
                                            <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                                            <SelectItem value="CASH">Cash</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="balance">Current Balance</Label>
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
                                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                                </Button>
                                <Button onClick={onSubmit} disabled={loading || !accountName || !balance}>
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Finish Setup
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
                                <CardTitle className="text-3xl">You&apos;re all set!</CardTitle>
                                <CardDescription className="text-lg mt-2">
                                    Taking you to your new dashboard...
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
