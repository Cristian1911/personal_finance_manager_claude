"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Save, Download, Trash2, Loader2 } from "lucide-react";
import { saveScenario, deleteScenario } from "@/actions/scenarios";
import type { PlannerAction, PlannerState, ScenarioState } from "../scenario-planner";
import type { DebtAccount, ScenarioResult, CashEntry } from "@zeta/shared";
import type { CurrencyCode } from "@zeta/shared";

interface SavedScenario {
  id: string;
  name: string | null;
  cash_entries: unknown;
  strategy: string;
  allocations: unknown;
  snapshot_accounts: unknown;
  results: unknown;
  created_at: string;
  updated_at: string;
}

interface Props {
  accounts: DebtAccount[];
  state: PlannerState;
  results: Record<number, ScenarioResult>;
  savedScenarios: SavedScenario[];
  currency?: CurrencyCode;
  dispatch: React.Dispatch<PlannerAction>;
  onScenariosChange: () => void;
}

export function ScenarioManager({
  accounts,
  state,
  results,
  savedScenarios,
  currency = "COP",
  dispatch,
  onScenariosChange,
}: Props) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [scenarioName, setScenarioName] = useState(state.scenarios[0]?.name ?? "Plan A");
  const [isPending, startTransition] = useTransition();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  function handleSave() {
    if (!scenarioName.trim()) return;

    const activeScenario = state.scenarios[state.activeScenarioIndex];
    const activeResult = results[state.activeScenarioIndex];

    startTransition(async () => {
      const result = await saveScenario({
        id: state.savedScenarioId ?? undefined,
        name: scenarioName.trim(),
        cashEntries: state.cashEntries,
        strategy: activeScenario.strategy,
        allocations: activeScenario.allocations,
        snapshotAccounts: accounts.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          balance: a.balance,
          currency: a.currency,
          interestRate: a.interestRate,
          monthlyPayment: a.monthlyPayment,
          creditLimit: a.creditLimit,
          paymentDay: a.paymentDay,
          cutoffDay: a.cutoffDay,
          color: a.color,
          institutionName: a.institutionName,
          currencyBreakdown: a.currencyBreakdown,
        })),
        results: activeResult
          ? {
              totalMonths: activeResult.totalMonths,
              totalInterestPaid: activeResult.totalInterestPaid,
              totalAmountPaid: activeResult.totalAmountPaid,
              debtFreeDate: activeResult.debtFreeDate,
              payoffOrder: activeResult.payoffOrder,
              timeline: activeResult.timeline,
            }
          : {
              totalMonths: 0,
              totalInterestPaid: 0,
              totalAmountPaid: 0,
              debtFreeDate: "",
              payoffOrder: [],
              timeline: [],
            },
      });

      if (result.success) {
        dispatch({ type: "MARK_SAVED", id: result.data.id });
        setSaveDialogOpen(false);
        onScenariosChange();
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteScenario(id);
      setDeleteConfirm(null);
      onScenariosChange();
    });
  }

  function handleLoad(scenario: SavedScenario) {
    const cashEntries = (scenario.cash_entries as CashEntry[]) ?? [];
    const allocations = (scenario.allocations as ScenarioState["allocations"]) ?? {
      manualOverrides: [],
      cascadeRedirects: [],
    };

    dispatch({
      type: "LOAD_STATE",
      state: {
        cashEntries,
        scenarios: [
          {
            name: scenario.name ?? "Plan cargado",
            strategy: (scenario.strategy as ScenarioState["strategy"]) ?? "avalanche",
            allocations,
          },
        ],
        activeScenarioIndex: 0,
        savedScenarioId: scenario.id,
        isDirty: false,
      },
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Planes guardados</CardTitle>
          <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant={state.isDirty ? "default" : "outline"}>
                <Save className="h-4 w-4 mr-1.5" />
                Guardar plan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Guardar escenario</DialogTitle>
                <DialogDescription>
                  Dale un nombre a tu plan para encontrarlo después
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2">
                <Label htmlFor="scenario-name">Nombre</Label>
                <Input
                  id="scenario-name"
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  placeholder="Mi plan de pagos"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={isPending || !scenarioName.trim()}>
                  {isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                  Guardar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {savedScenarios.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aún no has guardado ningún plan
          </p>
        ) : (
          <div className="space-y-2">
            {savedScenarios.map((s) => {
              const r = s.results as { totalMonths?: number; totalInterestPaid?: number; debtFreeDate?: string } | null;
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{s.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {s.strategy === "snowball" ? "Bola de nieve" : s.strategy === "custom" ? "Personalizado" : "Avalancha"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                      {r?.totalMonths && <span>{r.totalMonths} meses</span>}
                      {r?.debtFreeDate && <span>Libre: {r.debtFreeDate}</span>}
                      <span>
                        Actualizado: {new Date(s.updated_at).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLoad(s)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Cargar
                    </Button>
                    {deleteConfirm === s.id ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleDelete(s.id)}
                      >
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteConfirm(s.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
