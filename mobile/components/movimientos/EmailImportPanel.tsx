import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert, FlatList } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  ArrowUpRight,
  ArrowDownLeft,
  X,
  ChevronDown,
  Clock,
  FileUp,
  Wallet,
  ArrowRight,
} from "lucide-react-native";
import { formatCurrency, formatDate, type CurrencyCode } from "@zeta/shared";
import { COLORS } from "../../lib/constants/colors";
import { SECTION_EYEBROW_CLASS, BRASS_BUTTON_CLASS } from "../../lib/constants/styles";
import { MobileSheet } from "../ui/MobileSheet";
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

// Deterministic height estimate for the parent AnimatedAccordion (measuring
// inside a clipping accordion is unreliable). Tuned to the row layout below.
const H_HEADER = 30; // eyebrow
const H_SUBIR = 60; // "Subir PDF" row + divider
const H_ROW = 50; // one collapsed row
const H_ROW_EXPANDED_EXTRA = 132; // chips + account selector + actions
const H_FOOTER = 34;
const H_PADDING = 20;

interface EmailImportPanelProps {
  /** Navigate to the full PDF import wizard. */
  onOpenImport: () => void;
  /** Fired after the queue mutates so the parent tile can refresh its count. */
  onAfterChange?: () => void;
  /** Report the panel's natural height so the parent accordion can size itself. */
  onHeightChange?: (height: number) => void;
}

/**
 * Email import queue embedded in the Movimientos "Importar" tool tile —
 * parity with the webapp's expanded Importar surface. Each row imports inline
 * (using the auto-matched account) and expands to reassign the account or
 * discard. Includes the "Subir PDF" entry and a bulk "Importar todas".
 */
export function EmailImportPanel({
  onOpenImport,
  onAfterChange,
  onHeightChange,
}: EmailImportPanelProps) {
  const [rows, setRows] = useState<PendingEmailRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
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
      // Offline / auth hiccup — leave the queue empty.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Report natural height to the parent accordion whenever it changes.
  useEffect(() => {
    const height =
      H_PADDING +
      H_HEADER +
      H_SUBIR +
      rows.length * H_ROW +
      (expandedId ? H_ROW_EXPANDED_EXTRA : 0) +
      (rows.length > 0 ? H_FOOTER : 0);
    onHeightChange?.(height);
  }, [rows.length, expandedId, onHeightChange]);

  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  function resolveAccount(row: PendingEmailRow): AccountRow | null {
    const id = overrides[row.id] ?? row.suggested_account_id ?? undefined;
    return id ? accountMap.get(id) ?? null : null;
  }

  function clearRow(pendingId: string) {
    setRows((prev) => prev.filter((r) => r.id !== pendingId));
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[pendingId];
      return next;
    });
    if (expandedId === pendingId) setExpandedId(null);
  }

  async function refreshAfterMutation() {
    try {
      await syncAll();
    } catch {
      // Remote write already succeeded; local SQLite catches up next sync.
    }
    onAfterChange?.();
  }

  async function runApprove(pendingId: string, reconcileWithId?: string) {
    const result = await approveEmailTransaction(pendingId, overrides[pendingId], reconcileWithId);
    if (result.success) {
      clearRow(pendingId);
      return true;
    }
    Alert.alert("No se pudo importar", result.error ?? "Inténtalo de nuevo.");
    return false;
  }

  function handleApprove(row: PendingEmailRow) {
    setBusyId(row.id);
    (async () => {
      try {
        const match = await checkEmailReconciliation(row.id, overrides[row.id]);
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

  function handleImportAll() {
    const importable = rows.filter((r) => resolveAccount(r));
    if (importable.length === 0) return;
    setBulkBusy(true);
    (async () => {
      let imported = 0;
      let failed = 0;
      for (const r of importable) {
        try {
          const result = await approveEmailTransaction(r.id, overrides[r.id]);
          if (result.success) imported++;
          else failed++;
        } catch {
          failed++;
        }
      }
      const ids = new Set(importable.map((r) => r.id));
      setRows((prev) => prev.filter((r) => !ids.has(r.id)));
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

  return (
    <View className="gap-2">
      <Text className={`${SECTION_EYEBROW_CLASS} text-z-sage-light`}>
        Pendientes por correo
      </Text>

      {/* Subir PDF del banco */}
      <Pressable
        onPress={onOpenImport}
        accessibilityRole="button"
        accessibilityLabel="Subir PDF del banco"
        className="flex-row items-center gap-3 rounded-xl p-2 active:bg-white-5"
      >
        <View className="h-8 w-8 items-center justify-center rounded-lg border border-z-sage-20 bg-z-sage-10">
          <FileUp size={16} color={COLORS.sageLight} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[11px] font-inter-semibold text-foreground">
            Subir PDF del banco
          </Text>
          <Text className="text-[9px] font-inter text-muted-foreground">
            Extracto mensual de cualquier banco
          </Text>
        </View>
        <View className={`${BRASS_BUTTON_CLASS} rounded-lg px-3 py-1`}>
          <Text className="text-[10px] font-inter-semibold text-z-ink">Subir</Text>
        </View>
      </Pressable>

      {rows.length > 0 && <View className="h-px bg-white-6" />}

      {/* Email rows — import inline; tap the body to expand for account/discard */}
      {rows.map((row) => {
        const parsed = row.parsed_data;
        const merchant = parsed.merchant ?? parsed.destination ?? "Transacción";
        const isInflow = parsed.direction === "INFLOW";
        const account = resolveAccount(row);
        const hasAccount = !!account;
        const isBusy = busyId === row.id;
        const isExpanded = expandedId === row.id;

        return (
          <View key={row.id} className="rounded-xl bg-black-10">
            {/* Compact row */}
            <View className="flex-row items-center gap-2 px-2 py-2">
              <Pressable
                onPress={() => setExpandedId(isExpanded ? null : row.id)}
                accessibilityRole="button"
                accessibilityLabel={`Detalle de ${merchant}`}
                className="min-w-0 flex-1 flex-row items-center gap-2 active:opacity-70"
              >
                <View
                  className={`h-7 w-7 items-center justify-center rounded-lg ${
                    isInflow ? "bg-z-income-10" : "bg-z-expense-12"
                  }`}
                >
                  {isInflow ? (
                    <ArrowDownLeft size={13} color={COLORS.income} />
                  ) : (
                    <ArrowUpRight size={13} color={COLORS.expense} />
                  )}
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-xs font-inter-medium text-foreground" numberOfLines={1}>
                    {merchant}
                  </Text>
                  <Text className="text-[10px] font-inter text-muted-foreground" numberOfLines={1}>
                    {formatDate(parsed.transaction_date, "dd MMM")}
                    {parsed.card_last4 ? ` · *${parsed.card_last4}` : ""}
                  </Text>
                </View>
              </Pressable>

              <Text
                className={`shrink-0 tabular-nums text-xs font-inter-semibold ${
                  isInflow ? "text-z-income" : "text-foreground"
                }`}
              >
                {isInflow ? "+" : ""}
                {formatCurrency(parsed.amount, parsed.currency as CurrencyCode)}
              </Text>

              {/* Inline import */}
              <Pressable
                onPress={() => handleApprove(row)}
                disabled={isBusy || !hasAccount}
                accessibilityRole="button"
                accessibilityLabel={`Importar ${merchant}`}
                className={`shrink-0 flex-row items-center gap-1 rounded-full px-3 py-1.5 ${
                  hasAccount ? "bg-z-income-20 active:opacity-80" : "bg-white-5"
                }`}
              >
                {isBusy ? (
                  <ActivityIndicator size="small" color={COLORS.income} />
                ) : (
                  <Text
                    className={`text-[11px] font-inter-semibold ${
                      hasAccount ? "text-z-income" : "text-z-sage-dark"
                    }`}
                  >
                    Importar
                  </Text>
                )}
              </Pressable>
            </View>

            {/* Expanded detail — reassign account or discard */}
            {isExpanded && (
              <View className="gap-2 px-2 pb-2.5">
                <View className="flex-row items-center gap-1.5">
                  <View className="flex-row items-center gap-1 rounded-full border border-white-6 bg-white-5 px-2 py-0.5">
                    {isInflow ? (
                      <ArrowDownLeft size={10} color={COLORS.sageDark} />
                    ) : (
                      <ArrowUpRight size={10} color={COLORS.sageDark} />
                    )}
                    <Text className="text-[10px] font-inter-medium text-muted-foreground">
                      {PATTERN_LABELS[parsed.pattern_type] ?? parsed.pattern_type}
                    </Text>
                  </View>
                  {parsed.transaction_time ? (
                    <View className="flex-row items-center gap-1 rounded-full border border-white-6 bg-white-5 px-2 py-0.5">
                      <Clock size={10} color={COLORS.sageDark} />
                      <Text className="text-[10px] font-inter-medium text-muted-foreground">
                        {parsed.transaction_time}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Account selector */}
                <Pressable
                  onPress={() => setPickerFor(row.id)}
                  accessibilityRole="button"
                  accessibilityLabel="Elegir cuenta"
                  className={`flex-row items-center justify-between rounded-lg border px-3 py-2 ${
                    hasAccount ? "border-white-6 bg-white-5" : "border-z-alert-30 bg-z-alert-12"
                  }`}
                >
                  <View className="min-w-0 flex-row items-center gap-2">
                    <Wallet size={13} color={hasAccount ? COLORS.sageDark : COLORS.alert} />
                    <Text
                      className={`shrink text-[11px] font-inter-medium ${
                        hasAccount ? "text-foreground" : "text-z-alert"
                      }`}
                      numberOfLines={1}
                    >
                      {hasAccount ? `${account!.name} (${account!.currency_code})` : "Sin cuenta"}
                    </Text>
                  </View>
                  <ChevronDown size={14} color={hasAccount ? COLORS.sageDark : COLORS.alert} />
                </Pressable>

                <Pressable
                  onPress={() => handleDismiss(row)}
                  disabled={isBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Descartar"
                  className="flex-row items-center justify-center gap-1 rounded-full border border-white-10 py-2 active:bg-white-5"
                >
                  <X size={12} color={COLORS.debt} />
                  <Text className="text-[11px] font-inter-medium text-z-debt">Descartar</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}

      {/* Footer */}
      {rows.length > 0 && (
        <View className="flex-row items-center justify-between pt-1">
          <Text className="text-[10px] font-inter text-muted-foreground">
            {rows.length} {rows.length === 1 ? "pendiente" : "pendientes"}
          </Text>
          <Pressable
            onPress={handleImportAll}
            disabled={bulkBusy}
            accessibilityRole="button"
            accessibilityLabel="Importar todas"
            className="flex-row items-center gap-1"
          >
            {bulkBusy && <ActivityIndicator size="small" color={COLORS.income} />}
            <Text className="text-[11px] font-inter-semibold text-z-income">Importar todas</Text>
            <ArrowRight size={11} color={COLORS.income} />
          </Pressable>
        </View>
      )}

      {/* Account picker */}
      <MobileSheet
        visible={pickerFor !== null}
        onClose={() => setPickerFor(null)}
        maxHeightClass="max-h-[70%]"
      >
        <Text className="px-5 pb-2 font-inter-bold text-base text-z-white">Elegir cuenta</Text>
        <FlatList
          data={accounts}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => {
            const active =
              pickerFor &&
              (overrides[pickerFor] ??
                rows.find((r) => r.id === pickerFor)?.suggested_account_id) === item.id;
            return (
              <Pressable
                onPress={() => {
                  if (pickerFor) setOverrides((prev) => ({ ...prev, [pickerFor]: item.id }));
                  setPickerFor(null);
                }}
                className={`mx-4 flex-row items-center justify-between rounded-xl px-4 py-3 active:bg-white-5 ${
                  active ? "bg-z-brass-10" : ""
                }`}
              >
                <View className="flex-row items-center gap-3">
                  <Wallet size={16} color={COLORS.sageDark} />
                  <Text className="font-inter-medium text-sm text-z-white">{item.name}</Text>
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
                  className={`tabular-nums text-sm font-inter-semibold ${
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
              <Text className="font-inter-semibold text-sm text-z-white">Importar como nueva</Text>
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
