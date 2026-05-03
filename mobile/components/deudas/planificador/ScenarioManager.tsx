import { memo, useCallback, useState } from "react";
import { View, Text, Pressable, TextInput, ActivityIndicator } from "react-native";
import {
  type CashEntry,
  type CurrencyCode,
  type ScenarioAllocations,
  type ScenarioResult,
  type ScenarioStrategy,
} from "@zeta/shared";
import { Download, Save, Trash2 } from "lucide-react-native";
import { COLORS } from "../../../lib/constants/colors";
import {
  BRASS_BUTTON_CLASS,
  FORM_INPUT_CLASS,
  GHOST_BUTTON_CLASS,
  PANEL_INSET_CLASS,
} from "../../../lib/constants/styles";
import { MCard } from "../../ui/MCard";
import { MobileSheet } from "../../ui/MobileSheet";
import type { DebtAccountInfo } from "../../../lib/repositories/debt";
import {
  saveScenario,
  deleteScenario,
  type SavedScenario,
  type SnapshotAccount,
} from "../../../lib/repositories/scenarios";
import type { PlannerAction, PlannerState } from "./reducer";
import { formatDebtFreeDate } from "./utils";

interface Props {
  accounts: DebtAccountInfo[];
  state: PlannerState;
  results: Record<number, ScenarioResult>;
  savedScenarios: SavedScenario[];
  currency: CurrencyCode;
  dispatch: React.Dispatch<PlannerAction>;
  onSaved: () => void;
}

function buildSnapshot(accounts: DebtAccountInfo[]): SnapshotAccount[] {
  return accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    balance: a.balance,
    currency: a.currency,
    interestRate: a.interestRate ?? null,
    monthlyPayment: a.monthlyPayment ?? null,
    creditLimit: a.creditLimit > 0 ? a.creditLimit : null,
    paymentDay: a.paymentDay,
    cutoffDay: null,
    color: null,
    institutionName: null,
    currencyBreakdown: null,
  }));
}

export const ScenarioManager = memo(function ScenarioManager({
  accounts,
  state,
  results,
  savedScenarios,
  currency,
  dispatch,
  onSaved,
}: Props) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState(state.scenarios[0]?.name ?? "Plan A");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const canSave = state.cashEntries.length > 0 && name.trim().length > 0;

  const handleSave = useCallback(async () => {
    if (!canSave || busy) return;
    const active = state.scenarios[state.activeScenarioIndex];
    const activeResult = results[state.activeScenarioIndex];
    if (!active || !activeResult) return;
    if (accounts.length === 0) return;
    const badIds = state.cashEntries.filter(
      (e) => !/^[0-9a-f]{8}-/i.test(e.id)
    );
    if (badIds.length > 0) {
      console.error("[planificador] cash entry id format invalid; aborting save");
      return;
    }
    setBusy(true);
    try {
      const res = await saveScenario({
        id: state.savedScenarioId ?? undefined,
        name: name.trim(),
        cashEntries: state.cashEntries,
        strategy: active.strategy,
        allocations: active.allocations,
        snapshotAccounts: buildSnapshot(accounts),
        results: {
          totalMonths: activeResult.totalMonths,
          totalInterestPaid: activeResult.totalInterestPaid,
          totalAmountPaid: activeResult.totalAmountPaid,
          debtFreeDate: activeResult.debtFreeDate,
          payoffOrder: activeResult.payoffOrder,
          timeline: activeResult.timeline,
        },
      });
      if (res.ok) {
        dispatch({ type: "MARK_SAVED", id: res.scenario.id });
        onSaved();
        setSaveOpen(false);
      } else {
        console.error("[planificador] save failed:", res.error);
      }
    } finally {
      setBusy(false);
    }
  }, [canSave, busy, state, results, name, accounts, dispatch, onSaved]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (busy) return;
      setBusy(true);
      try {
        await deleteScenario(id);
        setConfirmDelete(null);
        onSaved();
      } finally {
        setBusy(false);
      }
    },
    [busy, onSaved]
  );

  const handleLoad = useCallback(
    (s: SavedScenario) => {
      const allocations: ScenarioAllocations =
        (s.allocations as ScenarioAllocations | null | undefined) ?? {
          manualOverrides: [],
          cascadeRedirects: [],
        };
      const cashEntries: CashEntry[] = (s.cash_entries as CashEntry[] | null) ?? [];
      const strategy: ScenarioStrategy =
        (s.strategy as ScenarioStrategy) ?? "avalanche";
      dispatch({
        type: "LOAD_STATE",
        state: {
          cashEntries,
          scenarios: [
            {
              name: s.name ?? "Plan cargado",
              strategy,
              allocations,
            },
          ],
          activeScenarioIndex: 0,
          savedScenarioId: s.id,
          isDirty: false,
        },
      });
    },
    [dispatch]
  );

  const remaining = Math.max(0, 3 - savedScenarios.length);
  const reachedCap = savedScenarios.length >= 3 && !state.savedScenarioId;

  return (
    <MCard className="gap-2">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-[10px] font-inter-semibold uppercase tracking-[3px] text-z-sage-dark">
            Planes guardados
          </Text>
          <Text className="text-[11px] font-inter text-muted-foreground">
            Hasta 3 planes guardados ({remaining} disponible
            {remaining === 1 ? "" : "s"}).
          </Text>
        </View>
        <Pressable
          onPress={() => setSaveOpen(true)}
          disabled={state.cashEntries.length === 0 || reachedCap}
          className={`${state.isDirty ? BRASS_BUTTON_CLASS : GHOST_BUTTON_CLASS} flex-row items-center gap-1 rounded-xl px-3 py-2 ${state.cashEntries.length === 0 || reachedCap ? "opacity-50" : ""}`}
        >
          <Save size={12} color={state.isDirty ? COLORS.ink : COLORS.brass} />
          <Text
            className={`text-[12px] font-inter-semibold ${state.isDirty ? "text-z-ink" : "text-z-brass"}`}
          >
            Guardar plan
          </Text>
        </Pressable>
      </View>

      {state.cashEntries.length === 0 && (
        <Text className="text-[11px] font-inter italic text-muted-foreground">
          Agrega al menos una entrada de efectivo para poder guardar un plan.
        </Text>
      )}

      {savedScenarios.length === 0 ? (
        <Text className="text-[11px] font-inter text-muted-foreground text-center py-2">
          Aún no has guardado ningún plan.
        </Text>
      ) : (
        <View className="gap-2">
          {savedScenarios.map((s) => (
            <SavedScenarioRow
              key={s.id}
              scenario={s}
              currency={currency}
              isCurrent={s.id === state.savedScenarioId}
              onLoad={() => handleLoad(s)}
              confirmDelete={confirmDelete === s.id}
              onAskDelete={() => setConfirmDelete(s.id)}
              onConfirmDelete={() => handleDelete(s.id)}
              onCancelDelete={() => setConfirmDelete(null)}
              busy={busy}
            />
          ))}
        </View>
      )}

      <MobileSheet
        visible={saveOpen}
        onClose={() => setSaveOpen(false)}
        maxHeightClass="max-h-[40%]"
      >
        <View className="px-5 pt-2 pb-4 gap-3">
          <Text className="text-[15px] font-inter-semibold text-foreground">
            Guardar plan
          </Text>
          <Text className="text-[12px] font-inter text-muted-foreground">
            Dale un nombre a tu plan para encontrarlo después.
          </Text>
          <TextInput
            className={FORM_INPUT_CLASS}
            placeholder="Mi plan de pagos"
            placeholderTextColor={COLORS.sageDark}
            value={name}
            onChangeText={setName}
          />
          <View className="flex-row gap-2 pt-1">
            <Pressable
              onPress={handleSave}
              disabled={!canSave || busy}
              className={`${BRASS_BUTTON_CLASS} flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3 ${!canSave || busy ? "opacity-50" : ""}`}
            >
              {busy && <ActivityIndicator size="small" color={COLORS.ink} />}
              <Text className="text-[13px] font-inter-semibold text-z-ink">
                Guardar
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSaveOpen(false)}
              className={`${GHOST_BUTTON_CLASS} rounded-xl px-4 py-3`}
            >
              <Text className="text-[13px] font-inter-semibold text-foreground">
                Cancelar
              </Text>
            </Pressable>
          </View>
        </View>
      </MobileSheet>
    </MCard>
  );
});

interface SavedScenarioRowProps {
  scenario: SavedScenario;
  currency: CurrencyCode;
  isCurrent: boolean;
  onLoad: () => void;
  confirmDelete: boolean;
  onAskDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  busy: boolean;
}

const STRATEGY_LABELS: Record<string, string> = {
  avalanche: "Avalancha",
  snowball: "Bola de nieve",
  custom: "Personalizado",
};

const SavedScenarioRow = memo(function SavedScenarioRow({
  scenario,
  isCurrent,
  onLoad,
  confirmDelete,
  onAskDelete,
  onConfirmDelete,
  onCancelDelete,
  busy,
}: SavedScenarioRowProps) {
  const r = scenario.results;
  return (
    <View
      className={`${PANEL_INSET_CLASS} p-3 gap-1 ${isCurrent ? "border-z-brass" : ""}`}
    >
      <View className="flex-row items-center gap-2">
        <Text
          className="text-[13px] font-inter-semibold text-foreground flex-1"
          numberOfLines={1}
        >
          {scenario.name ?? "Sin nombre"}
        </Text>
        <View className="rounded-full border border-white-6 px-2 py-0.5">
          <Text className="text-[9px] font-inter-semibold text-muted-foreground">
            {STRATEGY_LABELS[scenario.strategy] ?? scenario.strategy}
          </Text>
        </View>
      </View>
      <Text className="text-[10px] font-inter text-muted-foreground">
        {r?.totalMonths ? `${r.totalMonths} meses · ` : ""}
        {r?.debtFreeDate ? `Libre: ${formatDebtFreeDate(r.debtFreeDate)} · ` : ""}
        Actualizado:{" "}
        {new Date(scenario.updated_at).toLocaleDateString("es-CO", {
          day: "numeric",
          month: "short",
        })}
      </Text>
      <View className="flex-row gap-2 mt-1">
        <Pressable
          onPress={onLoad}
          className="flex-row items-center gap-1 rounded-md border border-white-6 px-2.5 py-1.5"
        >
          <Download size={11} color={COLORS.brass} />
          <Text className="text-[11px] font-inter-semibold text-z-brass">
            Cargar
          </Text>
        </Pressable>
        {confirmDelete ? (
          <View className="flex-row gap-1">
            <Pressable
              onPress={onConfirmDelete}
              disabled={busy}
              className="flex-row items-center gap-1 rounded-md bg-z-expense px-2.5 py-1.5"
            >
              {busy && <ActivityIndicator size="small" color="#fff" />}
              <Text className="text-[11px] font-inter-semibold text-white">
                Confirmar
              </Text>
            </Pressable>
            <Pressable
              onPress={onCancelDelete}
              className="rounded-md border border-white-6 px-2.5 py-1.5"
            >
              <Text className="text-[11px] font-inter text-foreground">
                Cancelar
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={onAskDelete}
            className="flex-row items-center gap-1 rounded-md px-2.5 py-1.5"
          >
            <Trash2 size={11} color={COLORS.expense} />
          </Pressable>
        )}
      </View>
    </View>
  );
});
