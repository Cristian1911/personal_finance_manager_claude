import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  FlatList,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  Mail,
  ArrowUpRight,
  ArrowDownLeft,
  Check,
  X,
  CheckCheck,
  AlertTriangle,
  ChevronDown,
  Wallet,
} from "lucide-react-native";
import { formatCurrency, formatDate, type CurrencyCode } from "@zeta/shared";
import { MobileSheet } from "../ui/MobileSheet";
import { COLORS } from "../../lib/constants/colors";
import { getAllAccounts, type AccountRow } from "../../lib/repositories/accounts";
import {
  getPendingEmailTransactions,
  approveEmailTransaction,
  dismissEmailTransaction,
  checkEmailReconciliation,
  type PendingEmailRow,
  type ReconciliationCandidatePreview,
} from "../../lib/repositories/pending-email";
import { syncAll } from "../../lib/sync/engine";

const PATTERN_LABELS: Record<string, string> = {
  retiro: "Retiro ATM",
  compra_debito: "Compra débito",
  compra_credito: "Compra crédito",
  transferencia: "Transferencia",
  boton_bancolombia: "Botón Bancolombia",
  qr_transferencia: "Transferencia QR",
  qr_pago: "Pago QR",
  pago_pse: "Pago PSE",
  bre_b: "Bre-B",
  nomina: "Nómina",
  avance: "Avance",
  transferencia_recibida: "Transferencia recibida",
  pago_recibido_cuenta: "Pago recibido",
};

interface PendingEmailQueueProps {
  /** Called after the queue changes (import/dismiss) so the parent can refresh
   * counts. The queue already runs `syncAll()` itself before invoking this. */
  onAfterChange?: () => void;
}

export function PendingEmailQueue({ onAfterChange }: PendingEmailQueueProps) {
  const [rows, setRows] = useState<PendingEmailRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [recon, setRecon] = useState<{
    pendingId: string;
    candidate: ReconciliationCandidatePreview;
  } | null>(null);
  const [reconBusy, setReconBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [pending, accs] = await Promise.all([
        getPendingEmailTransactions(),
        getAllAccounts(),
      ]);
      setRows(pending);
      setAccounts(accs);
    } catch {
      // Offline / auth hiccup — leave the queue empty rather than blocking the
      // import screen.
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  function resolveAccount(row: PendingEmailRow): AccountRow | null {
    const id = overrides[row.id] ?? row.suggested_account_id ?? undefined;
    return id ? accountMap.get(id) ?? null : null;
  }

  function resolveAccountId(row: PendingEmailRow): string | undefined {
    return overrides[row.id] ?? row.suggested_account_id ?? undefined;
  }

  const importableIds = new Set(
    rows.filter((r) => resolveAccountId(r)).map((r) => r.id)
  );
  const selectedImportable = [...selected].filter((id) => importableIds.has(id));

  function clearRow(pendingId: string) {
    setRows((prev) => prev.filter((r) => r.id !== pendingId));
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[pendingId];
      return next;
    });
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(pendingId);
      return next;
    });
  }

  async function refreshAfterMutation() {
    try {
      await syncAll();
    } catch {
      // Sync failures are non-fatal — the remote write already succeeded; local
      // SQLite will catch up on the next sync.
    }
    onAfterChange?.();
  }

  async function runApprove(pendingId: string, reconcileWithId?: string) {
    const override = overrides[pendingId];
    const result = await approveEmailTransaction(pendingId, override, reconcileWithId);
    if (result.success) {
      clearRow(pendingId);
      return true;
    }
    Alert.alert("No se pudo importar", result.error ?? "Inténtalo de nuevo.");
    return false;
  }

  function handleApprove(row: PendingEmailRow) {
    const override = overrides[row.id];
    setBusyId(row.id);
    (async () => {
      try {
        const match = await checkEmailReconciliation(row.id, override);
        if (match) {
          setBusyId(null);
          setRecon({ pendingId: row.id, candidate: match.candidate });
          return;
        }
        const ok = await runApprove(row.id);
        setBusyId(null);
        if (ok) await refreshAfterMutation();
      } catch {
        setBusyId(null);
        Alert.alert("Error", "No se pudo importar. Inténtalo de nuevo.");
      }
    })();
  }

  function handleReconcileChoice(reconcile: boolean) {
    if (!recon) return;
    const { pendingId, candidate } = recon;
    setRecon(null);
    setReconBusy(true);
    (async () => {
      const ok = await runApprove(pendingId, reconcile ? candidate.id : undefined);
      setReconBusy(false);
      if (ok) await refreshAfterMutation();
    })();
  }

  function handleDismiss(row: PendingEmailRow) {
    setBusyId(row.id);
    (async () => {
      const result = await dismissEmailTransaction(row.id);
      setBusyId(null);
      if (result.success) {
        clearRow(row.id);
        onAfterChange?.();
      } else {
        Alert.alert("Error", result.error ?? "No se pudo descartar.");
      }
    })();
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkApprove() {
    const ids = selectedImportable;
    if (ids.length === 0) return;
    setBulkBusy(true);
    (async () => {
      let imported = 0;
      let failed = 0;
      for (const id of ids) {
        try {
          const result = await approveEmailTransaction(id, overrides[id]);
          if (result.success) imported++;
          else failed++;
        } catch {
          failed++;
        }
      }
      setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
      setSelected(new Set());
      setBulkBusy(false);
      await refreshAfterMutation();
      Alert.alert(
        "Importación",
        failed === 0
          ? `${imported} ${imported === 1 ? "transacción importada" : "transacciones importadas"}`
          : `${imported} importadas, ${failed} con error`
      );
    })();
  }

  if (!loaded || rows.length === 0) return null;

  return (
    <View className="mb-5 overflow-hidden rounded-2xl border border-white-6 bg-z-surface-2">
      {/* Header */}
      <View className="flex-row items-center justify-between gap-2 px-4 py-3">
        <View className="flex-row items-center gap-2">
          <Mail size={16} color={COLORS.sageDark} />
          <Text className="font-inter-semibold text-sm text-z-white">
            Pendientes por correo
          </Text>
          <View className="rounded-full bg-z-brass-20 px-2 py-0.5">
            <Text className="text-[11px] font-inter-semibold text-z-brass">
              {rows.length}
            </Text>
          </View>
        </View>
        {selectedImportable.length > 0 && (
          <Pressable
            onPress={handleBulkApprove}
            disabled={bulkBusy}
            accessibilityRole="button"
            accessibilityLabel={`Importar ${selectedImportable.length} seleccionadas`}
            className="flex-row items-center gap-1.5 rounded-full bg-z-income-20 px-3 py-1.5 active:opacity-80"
          >
            {bulkBusy ? (
              <ActivityIndicator size="small" color={COLORS.income} />
            ) : (
              <CheckCheck size={14} color={COLORS.income} />
            )}
            <Text className="text-xs font-inter-semibold text-z-income">
              Importar {selectedImportable.length}
            </Text>
          </Pressable>
        )}
      </View>

      <View className="h-px bg-white-6" />

      {rows.map((row, idx) => {
        const parsed = row.parsed_data;
        const merchant = parsed.merchant ?? parsed.destination ?? "Transacción";
        const isInflow = parsed.direction === "INFLOW";
        const account = resolveAccount(row);
        const hasAccount = !!account;
        const isBusy = busyId === row.id;
        const isSelected = selected.has(row.id);
        const patternLabel = PATTERN_LABELS[parsed.pattern_type] ?? parsed.pattern_type;

        return (
          <View
            key={row.id}
            className={`px-4 py-3 ${idx > 0 ? "border-t border-white-6" : ""}`}
          >
            <View className="flex-row items-center gap-3">
              {hasAccount && (
                <Pressable
                  onPress={() => toggleSelected(row.id)}
                  disabled={bulkBusy}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`Seleccionar ${merchant}`}
                  className={`h-5 w-5 items-center justify-center rounded border ${
                    isSelected
                      ? "border-z-income bg-z-income-20"
                      : "border-white-10 bg-black-10"
                  }`}
                >
                  {isSelected && <Check size={13} color={COLORS.income} />}
                </Pressable>
              )}
              <View
                className={`h-9 w-9 items-center justify-center rounded-full ${
                  isInflow ? "bg-z-income-10" : "bg-white-5"
                }`}
              >
                {isInflow ? (
                  <ArrowDownLeft size={16} color={COLORS.income} />
                ) : (
                  <ArrowUpRight size={16} color={COLORS.sageDark} />
                )}
              </View>
              <View className="min-w-0 flex-1">
                <Text
                  className="font-inter-medium text-sm text-z-white"
                  numberOfLines={1}
                >
                  {merchant}
                </Text>
                <Text className="text-[11px] font-inter text-muted-foreground" numberOfLines={1}>
                  {formatDate(parsed.transaction_date, "dd MMM")} · {parsed.transaction_time}
                  {parsed.card_last4
                    ? ` · ${parsed.card_type === "Cta" ? "Cuenta" : parsed.card_type} *${parsed.card_last4}`
                    : ""}
                </Text>
              </View>
              <Text
                style={{ fontVariant: ["tabular-nums"] }}
                className={`shrink-0 text-sm font-inter-semibold ${
                  isInflow ? "text-z-income" : "text-z-white"
                }`}
              >
                {isInflow ? "+" : ""}
                {formatCurrency(parsed.amount, parsed.currency as CurrencyCode)}
              </Text>
            </View>

            <View className="mt-3 flex-row items-center justify-between gap-2">
              {/* Account chip */}
              <Pressable
                onPress={() => setPickerFor(row.id)}
                accessibilityRole="button"
                accessibilityLabel="Elegir cuenta"
                className={`flex-row items-center gap-1.5 rounded-full border px-2.5 py-1 ${
                  hasAccount
                    ? "border-white-6 bg-white-5"
                    : "border-z-alert-30 bg-z-alert-12"
                }`}
              >
                {hasAccount ? (
                  <Wallet size={12} color={COLORS.sageDark} />
                ) : (
                  <AlertTriangle size={12} color={COLORS.alert} />
                )}
                <Text
                  className={`text-[11px] font-inter-medium ${
                    hasAccount ? "text-muted-foreground" : "text-z-alert"
                  }`}
                  numberOfLines={1}
                >
                  {hasAccount ? account!.name : "Sin cuenta"}
                </Text>
                <ChevronDown size={12} color={hasAccount ? COLORS.sageDark : COLORS.alert} />
              </Pressable>

              <View className="flex-row items-center gap-2">
                <Pressable
                  onPress={() => handleDismiss(row)}
                  disabled={isBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Descartar"
                  className="flex-row items-center gap-1 rounded-full px-2.5 py-1.5 active:bg-white-5"
                >
                  <X size={13} color={COLORS.sageDark} />
                  <Text className="text-xs font-inter-medium text-muted-foreground">
                    Descartar
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleApprove(row)}
                  disabled={isBusy || !hasAccount}
                  accessibilityRole="button"
                  accessibilityLabel="Importar"
                  className={`flex-row items-center gap-1 rounded-full px-3 py-1.5 ${
                    hasAccount ? "bg-z-income-20 active:opacity-80" : "bg-white-5"
                  }`}
                >
                  {isBusy ? (
                    <ActivityIndicator size="small" color={COLORS.income} />
                  ) : (
                    <Check size={13} color={hasAccount ? COLORS.income : COLORS.sageDark} />
                  )}
                  <Text
                    className={`text-xs font-inter-semibold ${
                      hasAccount ? "text-z-income" : "text-z-sage-dark"
                    }`}
                  >
                    Importar
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        );
      })}

      {/* Account picker */}
      <MobileSheet
        visible={pickerFor !== null}
        onClose={() => setPickerFor(null)}
        maxHeightClass="max-h-[70%]"
      >
        <Text className="px-5 pb-2 font-inter-bold text-base text-z-white">
          Elegir cuenta
        </Text>
        <FlatList
          data={accounts}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ paddingBottom: 8 }}
          renderItem={({ item }) => {
            const active =
              pickerFor &&
              (overrides[pickerFor] ??
                rows.find((r) => r.id === pickerFor)?.suggested_account_id) === item.id;
            return (
              <Pressable
                onPress={() => {
                  if (pickerFor) {
                    setOverrides((prev) => ({ ...prev, [pickerFor]: item.id }));
                  }
                  setPickerFor(null);
                }}
                className={`mx-4 flex-row items-center justify-between rounded-xl px-4 py-3 active:bg-white-5 ${
                  active ? "bg-z-brass-10" : ""
                }`}
              >
                <View className="flex-row items-center gap-3">
                  <Wallet size={16} color={COLORS.sageDark} />
                  <Text className="font-inter-medium text-sm text-z-white">
                    {item.name}
                  </Text>
                </View>
                <Text className="text-xs font-inter text-muted-foreground">
                  {item.currency_code}
                </Text>
              </Pressable>
            );
          }}
        />
      </MobileSheet>

      {/* Reconciliation confirm */}
      <MobileSheet
        visible={recon !== null}
        onClose={() => !reconBusy && setRecon(null)}
        maxHeightClass="max-h-[60%]"
      >
        <View className="px-5">
          <Text className="font-inter-bold text-base text-z-white">
            Posible duplicado encontrado
          </Text>
          <Text className="mt-1 text-[13px] font-inter text-muted-foreground">
            Ya existe una transacción similar en esta cuenta:
          </Text>
          {recon && (
            <View className="mt-4 rounded-xl border border-white-6 bg-white-5 p-4">
              <View className="flex-row items-center gap-3">
                <View
                  className={`h-8 w-8 items-center justify-center rounded-full ${
                    recon.candidate.direction === "INFLOW" ? "bg-z-income-10" : "bg-white-5"
                  }`}
                >
                  {recon.candidate.direction === "INFLOW" ? (
                    <ArrowDownLeft size={14} color={COLORS.income} />
                  ) : (
                    <ArrowUpRight size={14} color={COLORS.sageDark} />
                  )}
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="font-inter-medium text-sm text-z-white" numberOfLines={1}>
                    {recon.candidate.merchant_name ??
                      recon.candidate.raw_description ??
                      "Transacción"}
                  </Text>
                  <Text className="text-[11px] font-inter text-muted-foreground">
                    {formatDate(recon.candidate.transaction_date, "dd MMM yyyy")}
                  </Text>
                </View>
                <Text
                  style={{ fontVariant: ["tabular-nums"] }}
                  className={`text-sm font-inter-semibold ${
                    recon.candidate.direction === "INFLOW" ? "text-z-income" : "text-z-white"
                  }`}
                >
                  {recon.candidate.direction === "INFLOW" ? "+" : "-"}
                  {formatCurrency(recon.candidate.amount, "COP")}
                </Text>
              </View>
            </View>
          )}
          <View className="mt-5 flex-row gap-3">
            <Pressable
              onPress={() => handleReconcileChoice(false)}
              disabled={reconBusy}
              className="flex-1 items-center rounded-xl border border-white-10 py-3 active:bg-white-5"
            >
              <Text className="font-inter-semibold text-sm text-z-white">
                Importar como nueva
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleReconcileChoice(true)}
              disabled={reconBusy}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-z-brass py-3 active:opacity-90"
            >
              {reconBusy && <ActivityIndicator size="small" color={COLORS.ink} />}
              <Text className="font-inter-bold text-sm text-z-ink">Reconciliar</Text>
            </Pressable>
          </View>
        </View>
      </MobileSheet>
    </View>
  );
}
