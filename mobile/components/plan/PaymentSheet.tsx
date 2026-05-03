import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Check, ChevronDown, X, Link2 } from "lucide-react-native";
import * as Crypto from "expo-crypto";
import {
  applyAccountBalanceDelta,
  computeIdempotencyKey,
  formatCurrency,
  formatDate,
  type CurrencyCode,
  type TransactionDirection,
} from "@zeta/shared";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { COLORS } from "../../lib/constants/colors";
import { PANEL_INSET_CLASS } from "../../lib/constants/styles";
import { toLocalDateString, toLocalMonthString } from "../../lib/utils/date";
import { parseLocalizedAmount } from "../../lib/amount";
import { isDebtAccountType } from "../../lib/constants/accounts";
import { markEntryCompleted } from "../../lib/repositories/planning";
import { computeRecurringGroupUuid } from "../../lib/utils/recurring-group";

const expoHashFn = (payload: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, payload);

async function buildIdempotencyKey(params: {
  txId: string;
  date: string;
  amount: number;
  description: string;
}): Promise<string> {
  // Mirrors webapp `cashflow-planner.ts:1283-1292`: same provider name and
  // providerTransactionId so SHA-256 hash matches across platforms and the
  // UNIQUE constraint dedups consistently.
  return computeIdempotencyKey(
    {
      provider: "MANUAL_FORM",
      providerTransactionId: params.txId,
      transactionDate: params.date,
      amount: params.amount,
      rawDescription: params.description,
    },
    expoHashFn,
  );
}

// Updates accounts.current_balance on Supabase to keep the webapp + dashboard
// in sync immediately. Local SQLite reconciles on the next pull.
// Throws on fetch/update errors so the caller's try/catch can surface the
// failure — silent failure would leave the transaction recorded with the
// account balance still stale.
async function updateAccountBalanceRemote(params: {
  accountId: string;
  userId: string;
  direction: TransactionDirection;
  amount: number;
}): Promise<void> {
  const sb = supabase as any;
  const { data: acct, error: fetchErr } = await sb
    .from("accounts")
    .select("current_balance, account_type")
    .eq("id", params.accountId)
    .eq("user_id", params.userId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!acct) throw new Error("Cuenta no encontrada");

  const newBalance = applyAccountBalanceDelta({
    currentBalance: acct.current_balance,
    accountType: acct.account_type,
    direction: params.direction,
    amount: params.amount,
  });

  const { error: updateErr } = await sb
    .from("accounts")
    .update({ current_balance: newBalance })
    .eq("id", params.accountId)
    .eq("user_id", params.userId);
  if (updateErr) throw new Error(updateErr.message);
}

// ── Types ──

export interface PaymentEntry {
  id: string;
  label: string;
  amount: number;
  currency_code: string;
  expected_date: string;
  account_id: string | null;
  recurring_template_id: string | null;
  category_id: string | null;
  debt_account_id?: string | null;
}

export interface PaymentAccount {
  id: string;
  name: string;
  account_type: string;
  current_balance: number;
  currency_code: string;
}

interface CandidateTransaction {
  id: string;
  description: string;
  merchant_name: string | null;
  amount: number;
  transaction_date: string;
  account_id: string;
  direction: string;
}

interface PaymentSheetProps {
  visible: boolean;
  entry: PaymentEntry;
  debtAccount: PaymentAccount | null;
  sourceAccounts: PaymentAccount[];
  currency: CurrencyCode;
  onClose: () => void;
  onSuccess: () => void;
}

type AmountOption = "planned" | "total_debt" | "custom";
type SheetMode = "loading" | "link" | "create";

// ── Component ──

export function PaymentSheet({
  visible,
  entry,
  debtAccount,
  sourceAccounts,
  currency,
  onClose,
  onSuccess,
}: PaymentSheetProps) {
  const { session } = useAuth();

  // State
  const [mode, setMode] = useState<SheetMode>("loading");
  const [candidates, setCandidates] = useState<CandidateTransaction[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [amountOption, setAmountOption] = useState<AmountOption>("planned");
  const [customAmount, setCustomAmount] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState<string>(sourceAccounts[0]?.id ?? "");
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search for candidate transactions when sheet opens
  useEffect(() => {
    if (!visible || !session?.user?.id) return;
    let cancelled = false;

    setMode("loading");
    setCandidates([]);
    setSelectedCandidateId(null);
    setAmountOption("planned");
    setCustomAmount("");
    setError(null);
    setShowSourcePicker(false);

    (async () => {
      try {
        const sb = supabase as any;
        const month = toLocalMonthString();
        const monthStart = `${month}-01`;
        const monthEnd = `${month}-31`;

        // Search for transactions that might match this expense:
        // - Same month, OUTFLOW, similar amount (±50%), or matching merchant name
        // - Not already linked to another occurrence
        const { data: txs } = await sb
          .from("transactions")
          .select("id, description, merchant_name, amount, transaction_date, account_id, direction")
          .eq("user_id", session.user.id)
          .eq("is_excluded", false)
          .is("reconciled_into_transaction_id", null)
          .gte("transaction_date", monthStart)
          .lte("transaction_date", monthEnd)
          .order("transaction_date", { ascending: false })
          .limit(50);

        if (!txs || txs.length === 0) {
          setMode("create");
          return;
        }

        // Filter candidates: match by amount range or merchant name similarity
        const targetAmount = entry.amount;
        const lowerBound = targetAmount * 0.5;
        const upperBound = targetAmount * 2.0;
        const labelLower = entry.label.toLowerCase();

        const matched = (txs as CandidateTransaction[]).filter((tx) => {
          const amt = Math.abs(tx.amount);
          const amountMatch = amt >= lowerBound && amt <= upperBound;
          const nameMatch =
            (tx.merchant_name && tx.merchant_name.toLowerCase().includes(labelLower)) ||
            (tx.description && tx.description.toLowerCase().includes(labelLower)) ||
            (tx.merchant_name && labelLower.includes(tx.merchant_name.toLowerCase()));

          // For debt accounts, also check transactions on the debt account itself
          const isOnDebtAccount = debtAccount && tx.account_id === debtAccount.id && tx.direction === "INFLOW";

          return amountMatch || nameMatch || isOnDebtAccount;
        });

        if (matched.length > 0) {
          setCandidates(matched.slice(0, 5));
          setMode("link");
        } else {
          setMode("create");
        }
      } catch {
        setMode("create");
      }
    })();
  }, [visible, session?.user?.id, entry, debtAccount]);

  const showTotalDebt = debtAccount != null && isDebtAccountType(debtAccount.account_type);

  const resolvedAmount = useMemo(() => {
    if (amountOption === "planned") return entry.amount;
    if (amountOption === "total_debt" && debtAccount) return Math.abs(debtAccount.current_balance);
    if (amountOption === "custom") {
      const parsed = parseLocalizedAmount(customAmount);
      return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
    }
    return null;
  }, [amountOption, entry.amount, debtAccount, customAmount]);

  const selectedSource = sourceAccounts.find((a) => a.id === selectedSourceId);
  const canSubmit = resolvedAmount != null && resolvedAmount > 0 && selectedSourceId !== "" && !submitting;

  const handleClose = useCallback(() => {
    setMode("loading");
    setCandidates([]);
    setSelectedCandidateId(null);
    setAmountOption("planned");
    setCustomAmount("");
    setError(null);
    setShowSourcePicker(false);
    onClose();
  }, [onClose]);

  // ── Link existing transaction ──
  const handleLinkTransaction = useCallback(async () => {
    if (!selectedCandidateId || !session?.user?.id) return;

    setSubmitting(true);
    setError(null);

    try {
      const userId = session.user.id;
      const sb = supabase as any;

      // 1. Link to recurring occurrence
      if (entry.recurring_template_id) {
        const monthPrefix = toLocalMonthString() + "%";
        const { data: occurrences } = await sb
          .from("recurring_occurrences")
          .select("id, occurrence_date")
          .eq("template_id", entry.recurring_template_id)
          .eq("user_id", userId)
          .eq("status", "pending")
          .like("occurrence_date", monthPrefix)
          .order("occurrence_date", { ascending: true })
          .limit(1);

        if (occurrences && occurrences.length > 0) {
          const occ = occurrences[0];

          // Stamp recurrence_group_id on the linked tx so visibility
          // predicates and revert flows match webapp's
          // linkExistingTransactionToOccurrence.
          const recurrenceGroupId = await computeRecurringGroupUuid(
            entry.recurring_template_id,
            occ.occurrence_date,
          );
          const txEnrichment: Record<string, unknown> = {
            recurrence_group_id: recurrenceGroupId,
          };
          // If the linked tx has no category but the entry does, backfill it.
          const candidate = candidates.find((c) => c.id === selectedCandidateId);
          if (candidate && entry.category_id) {
            const { data: txRow } = await sb
              .from("transactions")
              .select("category_id")
              .eq("id", selectedCandidateId)
              .eq("user_id", userId)
              .single();
            if (txRow && !txRow.category_id) {
              txEnrichment.category_id = entry.category_id;
              txEnrichment.categorization_source = "RECURRING_TEMPLATE";
            }
          }
          // Sequence: enrich tx first, only mark occurrence paid if that
          // succeeded. Operations aren't atomic — failing the second after
          // the first persisted is recoverable; failing the second after
          // it persisted leaves the user with a paid occurrence pointing
          // at an un-stamped tx, which breaks revertOccurrence.
          const { error: txErr } = await sb
            .from("transactions")
            .update(txEnrichment)
            .eq("id", selectedCandidateId)
            .eq("user_id", userId);
          if (txErr) throw new Error(txErr.message);

          const { error: occErr } = await sb
            .from("recurring_occurrences")
            .update({
              status: "paid",
              transaction_id: selectedCandidateId,
              paid_at: new Date().toISOString(),
              linked_manually: true,
            })
            .eq("id", occ.id)
            .eq("user_id", userId);
          if (occErr) throw new Error(occErr.message);
        }
      }

      // 2. Mark planning entry as COMPLETED (local + enqueued)
      await markEntryCompleted(entry.id);

      handleClose();
      onSuccess();
    } catch (err: any) {
      setError(err?.message ?? "Error al vincular transaccion");
    } finally {
      setSubmitting(false);
    }
  }, [selectedCandidateId, session?.user?.id, entry, handleClose, onSuccess]);

  // ── Create new transaction ──
  const handleCreatePayment = useCallback(async () => {
    if (!canSubmit || !session?.user?.id || resolvedAmount == null) return;

    setSubmitting(true);
    setError(null);

    try {
      const userId = session.user.id;
      const today = toLocalDateString();
      const outflowTxId = Crypto.randomUUID();
      const transferGroupId = debtAccount ? Crypto.randomUUID() : null;
      const sb = supabase as any;
      // OUTFLOW shows the entry label in the source ledger ("Netflix"),
      // INFLOW on the debt account shows "Pago: Netflix". Mirrors webapp
      // `cashflow-planner.ts:1305-1306` (OUTFLOW) and `:1366-1367` (INFLOW).
      const outflowDescription = entry.label;
      const inflowDescription = `Pago: ${entry.label}`;

      // Resolve the matching occurrence up-front so we can stamp
      // recurrence_group_id on the inserted transactions (mirrors webapp).
      let occurrenceRow: { id: string; occurrence_date: string } | null = null;
      let recurrenceGroupId: string | null = null;
      if (entry.recurring_template_id) {
        const monthPrefix = toLocalMonthString() + "%";
        const { data: occurrences } = await sb
          .from("recurring_occurrences")
          .select("id, occurrence_date")
          .eq("template_id", entry.recurring_template_id)
          .eq("user_id", userId)
          .eq("status", "pending")
          .like("occurrence_date", monthPrefix)
          .order("occurrence_date", { ascending: true })
          .limit(1);
        if (occurrences && occurrences.length > 0) {
          const occ = occurrences[0];
          occurrenceRow = occ;
          recurrenceGroupId = await computeRecurringGroupUuid(
            entry.recurring_template_id,
            occ.occurrence_date,
          );
        }
      }

      // 1. OUTFLOW from source
      const outflowKey = await buildIdempotencyKey({
        txId: outflowTxId,
        date: today,
        amount: resolvedAmount,
        description: outflowDescription,
      });
      const { error: outflowErr } = await sb
        .from("transactions")
        .insert({
          id: outflowTxId,
          user_id: userId,
          account_id: selectedSourceId,
          amount: resolvedAmount,
          currency_code: entry.currency_code,
          direction: "OUTFLOW",
          transaction_date: today,
          raw_description: outflowDescription,
          clean_description: outflowDescription,
          merchant_name: entry.label,
          capture_method: "MANUAL_FORM",
          category_id: entry.category_id,
          transfer_group_id: transferGroupId,
          idempotency_key: outflowKey,
          is_recurring: !!entry.recurring_template_id,
          recurrence_group_id: recurrenceGroupId,
        });

      if (outflowErr) throw new Error(outflowErr.message);

      // 2. INFLOW on debt account
      if (debtAccount && transferGroupId) {
        const inflowTxId = Crypto.randomUUID();
        const inflowKey = await buildIdempotencyKey({
          txId: inflowTxId,
          date: today,
          amount: resolvedAmount,
          description: inflowDescription,
        });
        const { error: inflowErr } = await sb
          .from("transactions")
          .insert({
            id: inflowTxId,
            user_id: userId,
            account_id: debtAccount.id,
            amount: resolvedAmount,
            currency_code: entry.currency_code,
            direction: "INFLOW",
            transaction_date: today,
            raw_description: inflowDescription,
            clean_description: inflowDescription,
            merchant_name: entry.label,
            capture_method: "MANUAL_FORM",
            category_id: entry.category_id,
            transfer_group_id: transferGroupId,
            idempotency_key: inflowKey,
            is_recurring: !!entry.recurring_template_id,
            recurrence_group_id: recurrenceGroupId,
          });
        if (inflowErr && !inflowErr.message?.includes("23505")) {
          throw new Error(inflowErr.message);
        }
      }

      // 3. Link to recurring occurrence (only after the OUTFLOW persisted).
      if (occurrenceRow) {
        const { error: occErr } = await sb
          .from("recurring_occurrences")
          .update({
            status: "paid",
            transaction_id: outflowTxId,
            paid_at: new Date().toISOString(),
          })
          .eq("id", occurrenceRow.id)
          .eq("user_id", userId);
        if (occErr) throw new Error(occErr.message);
      }

      // 4. Update account balances on Supabase so the webapp reflects the
      // payment immediately. Local SQLite reconciles on the next pull.
      await updateAccountBalanceRemote({
        accountId: selectedSourceId,
        userId,
        direction: "OUTFLOW",
        amount: resolvedAmount,
      });
      if (debtAccount) {
        await updateAccountBalanceRemote({
          accountId: debtAccount.id,
          userId,
          direction: "INFLOW",
          amount: resolvedAmount,
        });
      }

      // 5. Mark planning entry COMPLETED (local + enqueued)
      await markEntryCompleted(entry.id);

      handleClose();
      onSuccess();
    } catch (err: any) {
      const msg = err?.message ?? "Error al registrar el pago";
      if (msg.includes("23505") || msg.includes("duplicate")) {
        handleClose();
        onSuccess();
        return;
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, session?.user?.id, resolvedAmount, selectedSourceId, entry, debtAccount, handleClose, onSuccess]);

  // ── Account name lookup for candidates ──
  const allAccountMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of sourceAccounts) map.set(a.id, a.name);
    if (debtAccount) map.set(debtAccount.id, debtAccount.name);
    return map;
  }, [sourceAccounts, debtAccount]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <View className="flex-1 justify-end bg-black/60">
          <View className="rounded-t-3xl border-t border-white-6 bg-background">
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
              <Text className="text-[15px] font-inter-semibold text-foreground">
                {mode === "link" ? "Vincular pago existente" : "Registrar pago"}
              </Text>
              <Pressable onPress={handleClose} className="h-8 w-8 items-center justify-center rounded-full">
                <X size={16} color={COLORS.sageLight} />
              </Pressable>
            </View>

            <ScrollView
              className="max-h-[80%]"
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Entry info */}
              <View className={`${PANEL_INSET_CLASS} p-3 mb-4`}>
                <Text className="text-sm font-inter-semibold text-foreground">{entry.label}</Text>
                <Text className="text-[11px] font-inter text-muted-foreground mt-0.5">
                  {formatDate(entry.expected_date, "dd MMM yyyy")}
                  {debtAccount ? ` · ${debtAccount.name}` : ""}
                  {" · "}{formatCurrency(entry.amount, currency)}
                </Text>
              </View>

              {/* ── LOADING ── */}
              {mode === "loading" && (
                <View className="items-center py-8">
                  <ActivityIndicator size="small" color={COLORS.brass} />
                  <Text className="text-xs font-inter text-muted-foreground mt-2">
                    Buscando transacciones similares...
                  </Text>
                </View>
              )}

              {/* ── LINK MODE: show candidate transactions ── */}
              {mode === "link" && (
                <>
                  <Text className="text-xs font-inter-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                    ¿Ya hiciste este pago?
                  </Text>
                  <Text className="text-[11px] font-inter text-muted-fg-50 mb-3">
                    Encontramos transacciones que podrian ser este pago. Selecciona una para vincularla.
                  </Text>

                  {candidates.map((tx) => {
                    const isSelected = selectedCandidateId === tx.id;
                    return (
                      <Pressable
                        key={tx.id}
                        onPress={() => setSelectedCandidateId(isSelected ? null : tx.id)}
                        className={`${PANEL_INSET_CLASS} flex-row items-center p-3 mb-2 ${isSelected ? "border-z-brass" : ""}`}
                        style={isSelected ? { borderColor: COLORS.brass } : undefined}
                      >
                        <View className="flex-1">
                          <Text className="text-xs font-inter-semibold text-foreground">
                            {tx.merchant_name ?? tx.description}
                          </Text>
                          <Text className="text-[10px] font-inter text-muted-foreground">
                            {formatDate(tx.transaction_date, "dd MMM yyyy")}
                            {" · "}{allAccountMap.get(tx.account_id) ?? ""}
                          </Text>
                        </View>
                        <Text className={`text-sm font-inter-bold ${tx.direction === "INFLOW" ? "text-z-income" : "text-z-expense"}`}>
                          {tx.direction === "INFLOW" ? "+" : "-"}{formatCurrency(Math.abs(tx.amount), currency)}
                        </Text>
                        {isSelected && (
                          <View className="ml-2">
                            <Check size={16} color={COLORS.brass} />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}

                  {/* Error */}
                  {error && (
                    <View className="rounded-xl bg-z-debt/10 px-3 py-2 mb-2">
                      <Text className="text-xs font-inter-medium text-z-debt">{error}</Text>
                    </View>
                  )}

                  {/* Link button */}
                  <Pressable
                    onPress={handleLinkTransaction}
                    disabled={!selectedCandidateId || submitting}
                    className={`rounded-xl py-3 items-center mt-2 flex-row justify-center gap-2 ${selectedCandidateId ? "bg-z-brass" : "bg-z-brass/30"}`}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color={COLORS.ink} />
                    ) : (
                      <>
                        <Link2 size={14} color={COLORS.ink} />
                        <Text className={`text-sm font-inter-semibold ${selectedCandidateId ? "text-z-ink" : "text-z-ink/50"}`}>
                          Vincular transaccion
                        </Text>
                      </>
                    )}
                  </Pressable>

                  {/* Switch to create mode */}
                  <Pressable onPress={() => setMode("create")} className="items-center py-3 mt-1">
                    <Text className="text-sm font-inter-medium text-z-brass">
                      No, registrar nuevo pago
                    </Text>
                  </Pressable>
                </>
              )}

              {/* ── CREATE MODE: new payment form ── */}
              {mode === "create" && (
                <>
                  <Text className="text-xs font-inter-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                    Monto a pagar
                  </Text>

                  <RadioOption
                    selected={amountOption === "planned"}
                    onPress={() => setAmountOption("planned")}
                    label="Cuota planeada"
                    detail={formatCurrency(entry.amount, currency)}
                  />

                  {showTotalDebt && debtAccount && (
                    <RadioOption
                      selected={amountOption === "total_debt"}
                      onPress={() => setAmountOption("total_debt")}
                      label="Pago total deuda"
                      detail={formatCurrency(Math.abs(debtAccount.current_balance), currency)}
                    />
                  )}

                  <RadioOption
                    selected={amountOption === "custom"}
                    onPress={() => setAmountOption("custom")}
                    label="Otro monto"
                  />
                  {amountOption === "custom" && (
                    <View className="ml-8 mb-3">
                      <TextInput
                        className="rounded-xl border border-white-6 bg-black-10 px-3 py-2.5 text-sm font-inter-medium text-foreground"
                        placeholderTextColor="#938C7E"
                        placeholder="Ej: 150.000"
                        keyboardType="numeric"
                        value={customAmount}
                        onChangeText={setCustomAmount}
                        autoFocus
                      />
                    </View>
                  )}

                  {/* Source account */}
                  {sourceAccounts.length > 0 && (
                    <>
                      <Text className="text-xs font-inter-semibold text-muted-foreground mb-2 mt-3 uppercase tracking-wider">
                        Cuenta origen
                      </Text>
                      <Pressable
                        onPress={() => setShowSourcePicker(!showSourcePicker)}
                        className={`${PANEL_INSET_CLASS} flex-row items-center justify-between px-3 py-2.5 mb-1`}
                      >
                        <Text className="text-sm font-inter-medium text-foreground">
                          {selectedSource?.name ?? "Seleccionar cuenta"}
                        </Text>
                        <ChevronDown
                          size={14}
                          color={COLORS.sageDark}
                          style={{ transform: [{ rotate: showSourcePicker ? "180deg" : "0deg" }] }}
                        />
                      </Pressable>

                      {showSourcePicker && (
                        <View className={`${PANEL_INSET_CLASS} overflow-hidden mb-3`}>
                          {sourceAccounts.map((acc, i) => (
                            <Pressable
                              key={acc.id}
                              onPress={() => { setSelectedSourceId(acc.id); setShowSourcePicker(false); }}
                              className={`flex-row items-center justify-between px-3 py-2.5 active:bg-z-surface-2/5 ${i > 0 ? "border-t border-white-6" : ""}`}
                            >
                              <Text className="text-[13px] font-inter-medium text-foreground">{acc.name}</Text>
                              {acc.id === selectedSourceId && <Check size={14} color={COLORS.income} />}
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </>
                  )}

                  {/* Summary */}
                  {resolvedAmount != null && (
                    <View className="flex-row items-center justify-between mt-4 mb-2">
                      <Text className="text-xs font-inter text-muted-foreground">Total a pagar</Text>
                      <Text className="text-base font-inter-bold text-foreground">
                        {formatCurrency(resolvedAmount, currency)}
                      </Text>
                    </View>
                  )}

                  {/* Error */}
                  {error && (
                    <View className="rounded-xl bg-z-debt/10 px-3 py-2 mb-2">
                      <Text className="text-xs font-inter-medium text-z-debt">{error}</Text>
                    </View>
                  )}

                  {/* Confirm */}
                  <Pressable
                    onPress={handleCreatePayment}
                    disabled={!canSubmit}
                    className={`rounded-xl py-3 items-center mt-2 ${canSubmit ? "bg-z-brass" : "bg-z-brass/30"}`}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color={COLORS.ink} />
                    ) : (
                      <Text className={`text-sm font-inter-semibold ${canSubmit ? "text-z-ink" : "text-z-ink/50"}`}>
                        Confirmar pago
                      </Text>
                    )}
                  </Pressable>

                  {/* Back to link mode if candidates exist */}
                  {candidates.length > 0 && (
                    <Pressable onPress={() => setMode("link")} className="items-center py-3 mt-1">
                      <Text className="text-sm font-inter-medium text-z-brass">
                        Vincular pago existente
                      </Text>
                    </Pressable>
                  )}

                  <Pressable onPress={handleClose} className="items-center py-2">
                    <Text className="text-sm font-inter-medium text-muted-foreground">Cancelar</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Radio option row ──

function RadioOption({ selected, onPress, label, detail }: {
  selected: boolean;
  onPress: () => void;
  label: string;
  detail?: string;
}) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 py-2.5 mb-1">
      <View className={`h-5 w-5 rounded-full border-2 items-center justify-center ${selected ? "border-z-brass" : "border-white/20"}`}>
        {selected && <View className="h-2.5 w-2.5 rounded-full bg-z-brass" />}
      </View>
      <View className="flex-1 flex-row items-center justify-between">
        <Text className="text-sm font-inter-medium text-foreground">{label}</Text>
        {detail && <Text className="text-sm font-inter-semibold text-z-brass">{detail}</Text>}
      </View>
    </Pressable>
  );
}
