"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { upsertBudget, deleteBudget } from "@/actions/budgets";
import { toast } from "sonner";
import { Target, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";

export function BudgetFormDialog({
    categoryId,
    categoryName,
    currentAmount,
    budgetId,
}: {
    categoryId: string;
    categoryName: string;
    currentAmount: number;
    budgetId?: string;
}) {
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState<string>(currentAmount ? currentAmount.toString() : "");
    const [isLoading, setIsLoading] = useState(false);

    async function handleSave() {
        setIsLoading(true);
        const formData = new FormData();
        formData.append("category_id", categoryId);
        formData.append("amount", amount);
        formData.append("period", "monthly");

        const res = await upsertBudget({ success: false, error: "" }, formData);
        setIsLoading(false);

        if (res.success) {
            toast.success("Presupuesto guardado");
            setOpen(false);
        } else {
            toast.error(res.error || "Error al guardar el presupuesto");
        }
    }

    async function handleDelete() {
        if (!budgetId) return;
        setIsLoading(true);
        const res = await deleteBudget(budgetId);
        setIsLoading(false);

        if (res.success) {
            toast.success("Presupuesto eliminado");
            setAmount("");
            setOpen(false);
        } else {
            toast.error(res.error || "Error al eliminar el presupuesto");
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs flex gap-1.5 px-2 hover:bg-muted/80">
                    <Target className="h-3.5 w-3.5 text-muted-foreground" />
                    {currentAmount > 0 ? (
                        <span className="font-semibold text-primary">{formatCurrency(currentAmount, "COP")}</span>
                    ) : (
                        <span className="text-muted-foreground">Fijar presupuesto</span>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Presupuesto para {categoryName}</DialogTitle>
                    <DialogDescription>
                        Establece un límite mensual de gastos para esta categoría para llevar un mejor control.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <label htmlFor="amount" className="text-sm font-medium">Monto Mensual</label>
                        <Input
                            id="amount"
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="Ej: 500000"
                        />
                    </div>
                </div>
                <DialogFooter className="flex justify-between items-center sm:justify-between">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDelete}
                        disabled={!budgetId || isLoading}
                        className={!budgetId ? "invisible" : "text-destructive hover:text-destructive hover:bg-destructive/10"}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={isLoading || !amount}>
                            Guardar meta
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
