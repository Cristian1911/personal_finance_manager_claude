import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { ArrowLeft, Check, ChevronDown, Banknote } from "lucide-react-native";
import { formatCurrency, formatDate, type CurrencyCode } from "@zeta/shared";
import { useAuth } from "../lib/auth";
import { COLORS } from "../lib/constants/colors";
import { isDebtAccountType } from "../lib/constants/accounts";
import { MOBILE_TAB_BAR_CLEARANCE, PANEL_INSET_CLASS, SECTION_EYEBROW_CLASS } from "../lib/constants/styles";
import { getActivePeriodWithEntries } from "../lib/repositories/planning";
import { getAllAccounts } from "../lib/repositories/accounts";
import { getTemplatesByIds } from "../lib/repositories/recurring";
import {
  PaymentSheet,
  type PaymentEntry,
  type PaymentAccount,
} from "../components/plan/PaymentSheet";
import {
  ReassignSheet,
  type ReassignTarget,
} from "../components/plan/ReassignSheet";

import { ENVELOPE_COLORS } from "../lib/constants/envelope-colors";

interface PlanningPeriod {
  id: string;
  start_date: string;
  end_date: string;
  currency_code: string;
  is_active: boolean;
}

interface PlanningEntry {
  id: string;
  label: string;
  amount: number;
  currency_code: string;
  entry_type: "INCOME" | "EXPENSE";
  status: "PLANNED" | "COMPLETED" | "SKIPPED";
  expected_date: string;
  account_id: string | null;
  account_name?: string | null;
  recurring_template_id: string | null;
  category_id: string | null;
  /** Resolved debt account ID from template (when entry.account_id is the source account) */
  debt_account_id?: string | null;
}

interface PlanningAssignment {
  id: string;
  income_entry_id: string;
  expense_entry_id: string;
  assigned_amount: number;
}

interface IncomeEnvelope {
  entry: PlanningEntry;
  totalAmount: number;
  assignedAmount: number;
  remainingAmount: number;
  assignments: Array<{ assignment: PlanningAssignment; expenseLabel: string }>;
}

interface AccountDetail {
  id: string;
  name: string;
  account_type: string;
  current_balance: number;
  currency_code: string;
}

interface PeriodoData {
  period: PlanningPeriod;
  currency: CurrencyCode;
  incomeEnvelopes: IncomeEnvelope[];
  expenseEntries: Array<PlanningEntry & { assignmentChips: Array<{ colorIndex: number; amount: number; assignmentId: string; incomeEntryId: string }> }>;
  totalExpenses: number;
  totalAssigned: number;
  accountDetails: Map<string, AccountDetail>;
}

export default function PeriodoScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PeriodoData | null>(null);
  const requestIdRef = useRef(0);
  const [expandedIncome, setExpandedIncome] = useState<string | null>(null);
  const [paymentEntry, setPaymentEntry] = useState<PaymentEntry | null>(null);
  const [reassignTarget, setReassignTarget] = useState<ReassignTarget | null>(null);

  const loadData = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) { setLoading(false); return; }
    const requestId = ++requestIdRef.current;

    try {
      const [periodBundle, accounts] = await Promise.all([
        getActivePeriodWithEntries(userId),
        getAllAccounts(),
      ]);

      if (!periodBundle) {
        if (requestId === requestIdRef.current) {
          setData(null);
          setLoading(false);
        }
        return;
      }

      const { period, entries, assignments } = periodBundle;

      const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
      const accountDetailMap = new Map<string, AccountDetail>(
        accounts.map((a) => [a.id, {
          id: a.id,
          name: a.name,
          account_type: a.account_type,
          current_balance: a.current_balance ?? 0,
          currency_code: a.currency_code,
        }])
      );

      // Resolve debt-payment templates to find the actual debt account
      // (entry.account_id may be the source account when transfer_source_account_id is set)
      const templateIds = Array.from(
        new Set(entries.filter((e) => e.recurring_template_id).map((e) => e.recurring_template_id!))
      );
      const templates = await getTemplatesByIds(templateIds);
      const templateMap = new Map<string, { account_id: string; transfer_source_account_id: string | null }>();
      for (const t of templates) {
        templateMap.set(t.id, {
          account_id: t.account_id,
          transfer_source_account_id: t.transfer_source_account_id,
        });
      }

      // Enrich entries with account names + resolve debt account from template
      const enrichedEntries: PlanningEntry[] = entries.map((e) => {
        const next: PlanningEntry = {
          id: e.id,
          label: e.label,
          amount: e.amount,
          currency_code: e.currency_code,
          entry_type: e.entry_type,
          status: e.status,
          expected_date: e.expected_date,
          account_id: e.account_id,
          account_name: accountMap.get(e.account_id ?? "") ?? null,
          recurring_template_id: e.recurring_template_id,
          category_id: e.category_id,
        };
        if (e.recurring_template_id) {
          const template = templateMap.get(e.recurring_template_id);
          if (template) {
            const templateAccount = accountDetailMap.get(template.account_id);
            if (templateAccount && isDebtAccountType(templateAccount.account_type)) {
              next.debt_account_id = template.account_id;
            }
          }
        }
        return next;
      });

      // Build income envelopes
      const incomeEntries = enrichedEntries.filter((e) => e.entry_type === "INCOME");
      const expenseEntries = enrichedEntries.filter((e) => e.entry_type === "EXPENSE");
      const expenseMap = new Map(expenseEntries.map((e) => [e.id, e]));

      const incomeEnvelopes: IncomeEnvelope[] = incomeEntries.map((entry) => {
        const entryAssignments = assignments.filter((a) => a.income_entry_id === entry.id);
        const assignedAmount = entryAssignments.reduce((s, a) => s + a.assigned_amount, 0);
        return {
          entry,
          totalAmount: entry.amount,
          assignedAmount,
          remainingAmount: entry.amount - assignedAmount,
          assignments: entryAssignments.map((a) => ({
            assignment: a,
            expenseLabel: expenseMap.get(a.expense_entry_id)?.label ?? "Gasto",
          })),
        };
      });

      // Build assignment chips per expense
      const incomeIndexMap = new Map(incomeEntries.map((e, i) => [e.id, i]));
      const expenseWithChips = expenseEntries.map((entry) => {
        const chips = assignments
          .filter((a) => a.expense_entry_id === entry.id)
          .map((a) => ({
            colorIndex: incomeIndexMap.get(a.income_entry_id) ?? 0,
            amount: a.assigned_amount,
            assignmentId: a.id,
            incomeEntryId: a.income_entry_id,
          }));
        return { ...entry, assignmentChips: chips };
      });

      const totalExpenses = expenseEntries.reduce((s, e) => s + e.amount, 0);
      const totalAssigned = assignments.reduce((s, a) => s + a.assigned_amount, 0);

      const fresh: PeriodoData = {
        period: {
          id: period.id,
          start_date: period.start_date,
          end_date: period.end_date,
          currency_code: period.currency_code,
          is_active: period.is_active === 1,
        },
        currency: period.currency_code as CurrencyCode,
        incomeEnvelopes,
        expenseEntries: expenseWithChips,
        totalExpenses,
        totalAssigned,
        accountDetails: accountDetailMap,
      };
      if (requestId === requestIdRef.current) {
        setData(fresh);
      }
    } catch (error) {
      console.error("Failed to load periodo:", error);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [session?.user?.id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={COLORS.brass} />
      </View>
    );
  }

  if (!data) {
    return (
      <View className="flex-1 bg-background">
        <Header onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-foreground font-inter-semibold text-base text-center">
            No hay periodo activo
          </Text>
          <Text className="text-muted-foreground font-inter text-sm text-center mt-2">
            Crea un periodo desde la web para empezar a planificar tus ingresos y gastos del mes.
          </Text>
        </View>
      </View>
    );
  }

  const percentAssigned = data.totalExpenses > 0
    ? Math.round((data.totalAssigned / data.totalExpenses) * 100) : 0;

  return (
    <View className="flex-1 bg-background">
      <Header onBack={() => router.back()} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: MOBILE_TAB_BAR_CLEARANCE }}
      >
        {/* Period summary */}
        <View className={`${PANEL_INSET_CLASS} flex-row items-center justify-between px-4 py-2.5`}>
          <Text className="text-xs font-inter text-muted-foreground">
            {formatDate(data.period.start_date, "dd MMM")} — {formatDate(data.period.end_date, "dd MMM yyyy")}
          </Text>
          <View className={`rounded-md px-2 py-0.5 ${percentAssigned >= 100 ? "bg-z-income/10" : "bg-z-brass/10"}`}>
            <Text className={`text-[10px] font-inter-semibold ${percentAssigned >= 100 ? "text-z-income" : "text-z-brass"}`}>
              {percentAssigned}% asignado
            </Text>
          </View>
        </View>

        {/* ── INGRESOS ── */}
        <Text className={SECTION_EYEBROW_CLASS}>Ingresos</Text>
        {data.incomeEnvelopes.map((envelope, idx) => (
          <IncomeCard
            key={envelope.entry.id}
            envelope={envelope}
            colorIndex={idx}
            currency={data.currency}
            isExpanded={expandedIncome === envelope.entry.id}
            onToggle={() => setExpandedIncome(expandedIncome === envelope.entry.id ? null : envelope.entry.id)}
          />
        ))}

        {/* ── GASTOS ── */}
        <Text className={`${SECTION_EYEBROW_CLASS} mt-2`}>Gastos</Text>
        {data.expenseEntries.length > 0 && (
          <View className={`${PANEL_INSET_CLASS} overflow-hidden`}>
            {data.expenseEntries.map((entry, i) => (
              <View key={entry.id} className={`px-3.5 py-3 ${i > 0 ? "border-t border-white-6" : ""}`}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-xs font-inter-medium text-foreground">{entry.label}</Text>
                    <Text className="text-[10px] font-inter text-muted-foreground">
                      {formatDate(entry.expected_date, "dd MMM yyyy")}
                      {entry.account_name ? ` · ${entry.account_name}` : ""}
                    </Text>
                    {/* Assignment chips — tappable to reassign */}
                    {entry.assignmentChips.length > 0 && (
                      <View className="flex-row flex-wrap gap-1 mt-1">
                        {entry.assignmentChips.map((chip, ci) => (
                          <Pressable
                            key={ci}
                            onPress={() => setReassignTarget({
                              assignmentId: chip.assignmentId,
                              expenseEntryId: entry.id,
                              expenseLabel: entry.label,
                              currentIncomeEntryId: chip.incomeEntryId,
                              currentAmount: chip.amount,
                            })}
                            className="flex-row items-center gap-1 rounded-md px-1.5 py-0.5 active:opacity-70"
                            style={{ backgroundColor: ENVELOPE_COLORS[chip.colorIndex % ENVELOPE_COLORS.length] + "15" }}
                          >
                            <View
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: ENVELOPE_COLORS[chip.colorIndex % ENVELOPE_COLORS.length] }}
                            />
                            <Text
                              className="text-[9px] font-inter-medium"
                              style={{ color: ENVELOPE_COLORS[chip.colorIndex % ENVELOPE_COLORS.length] }}
                            >
                              {formatCurrency(chip.amount, data.currency)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                  <View className="flex-row items-center gap-2">
                    {entry.status !== "COMPLETED" && (
                      <Pressable
                        onPress={() =>
                          setPaymentEntry({
                            id: entry.id,
                            label: entry.label,
                            amount: entry.amount,
                            currency_code: entry.currency_code,
                            expected_date: entry.expected_date,
                            account_id: entry.account_id,
                            recurring_template_id: entry.recurring_template_id,
                            category_id: entry.category_id,
                            debt_account_id: entry.debt_account_id ?? null,
                          })
                        }
                        className="flex-row items-center gap-1 rounded-lg border border-z-brass-20 bg-z-brass-8 px-2 py-1"
                      >
                        <Banknote size={12} color={COLORS.brass} />
                        <Text className="text-[10px] font-inter-semibold text-z-brass">
                          Pagar
                        </Text>
                      </Pressable>
                    )}
                    <Text className="text-sm font-inter-semibold text-z-debt">
                      {formatCurrency(entry.amount, data.currency)}
                    </Text>
                    <StatusBadge status={entry.status} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Payment sheet */}
      {paymentEntry && data && (() => {
        // Resolve debt account: prefer debt_account_id from template, fallback to entry's account_id
        const debtAccountId = paymentEntry.debt_account_id ?? paymentEntry.account_id;
        const debtAcc = debtAccountId ? data.accountDetails.get(debtAccountId) ?? null : null;
        const debtAccount = debtAcc && isDebtAccountType(debtAcc.account_type)
          ? (debtAcc as PaymentAccount)
          : null;

        return (
          <PaymentSheet
            visible={!!paymentEntry}
            entry={paymentEntry}
            debtAccount={debtAccount}
            sourceAccounts={Array.from(data.accountDetails.values())
              .filter(
                (a) =>
                  !isDebtAccountType(a.account_type) &&
                  (a.account_type === "CHECKING" || a.account_type === "SAVINGS")
              )
              .map((a) => a as PaymentAccount)}
            currency={data.currency}
            onClose={() => setPaymentEntry(null)}
            onSuccess={() => {
              setPaymentEntry(null);
              loadData();
            }}
          />
        );
      })()}

      {/* Reassign sheet */}
      <ReassignSheet
        visible={!!reassignTarget}
        target={reassignTarget}
        incomeOptions={data.incomeEnvelopes.map((env, idx) => ({
          entryId: env.entry.id,
          label: env.entry.label,
          remainingAmount: env.remainingAmount,
          colorIndex: idx,
        }))}
        currency={data.currency}
        periodId={data.period.id}
        onClose={() => setReassignTarget(null)}
        onSuccess={() => {
          setReassignTarget(null);
          loadData();
        }}
      />
    </View>
  );
}

// ── Header ──
function Header({ onBack }: { onBack: () => void }) {
  return (
    <View className="flex-row items-center px-4 pt-14 pb-2">
      <Pressable onPress={onBack} className="mr-3 p-1">
        <ArrowLeft size={20} color={COLORS.sageLight} />
      </Pressable>
      <Text className="text-lg font-inter-bold text-foreground">Plan del periodo</Text>
    </View>
  );
}

// ── Status badge ──
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; bg: string; text: string }> = {
    PLANNED: { label: "Pendiente", bg: "bg-z-alert/10", text: "text-z-alert" },
    COMPLETED: { label: "Pagado", bg: "bg-z-income/10", text: "text-z-income" },
    SKIPPED: { label: "Omitido", bg: "bg-z-surface-2/5", text: "text-muted-foreground" },
  };
  const c = config[status] ?? config.PLANNED;
  return (
    <View className={`rounded-md px-2 py-0.5 ${c.bg}`}>
      <Text className={`text-[10px] font-inter-medium ${c.text}`}>{c.label}</Text>
    </View>
  );
}

// ── Income envelope card ──
function IncomeCard({
  envelope,
  colorIndex,
  currency,
  isExpanded,
  onToggle,
}: {
  envelope: IncomeEnvelope;
  colorIndex: number;
  currency: CurrencyCode;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { entry, totalAmount, assignedAmount, remainingAmount, assignments } = envelope;
  const pct = totalAmount > 0 ? Math.min(100, (assignedAmount / totalAmount) * 100) : 0;
  const color = ENVELOPE_COLORS[colorIndex % ENVELOPE_COLORS.length];

  return (
    <Pressable onPress={onToggle}>
      <View
        className={`${PANEL_INSET_CLASS} overflow-hidden`}
        style={{ borderLeftWidth: 2, borderLeftColor: color }}
      >
        <View className="p-3.5 gap-2">
          {/* Name + amount + status */}
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1">
              <Text className="text-sm font-inter-semibold text-foreground">{entry.label}</Text>
              <Text className="text-[10px] font-inter text-muted-foreground">
                {formatDate(entry.expected_date, "dd MMM yyyy")}
                {entry.account_name ? ` · ${entry.account_name}` : ""}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-sm font-inter-semibold" style={{ color }}>
                {formatCurrency(totalAmount, currency)}
              </Text>
              {entry.status === "COMPLETED" ? (
                <View className="h-5 w-5 items-center justify-center rounded-md" style={{ backgroundColor: color + "20", borderColor: color + "50", borderWidth: 1 }}>
                  <Check size={12} color={color} />
                </View>
              ) : (
                <View className="h-5 w-5 rounded-md border border-white/10 bg-z-surface-2/5" />
              )}
            </View>
          </View>

          {/* Progress bar */}
          <View className="h-1.5 w-full rounded-full bg-z-surface-2-6 overflow-hidden">
            <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
          </View>

          {/* Disponible + expand arrow */}
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-inter text-muted-foreground">
              Disponible:{" "}
              <Text className={`font-inter-semibold ${remainingAmount > 0 ? "text-z-brass" : "text-z-income"}`}>
                {formatCurrency(remainingAmount, currency)}
              </Text>
            </Text>
            <ChevronDown
              size={14}
              color={COLORS.sageDark}
              style={{ transform: [{ rotate: isExpanded ? "180deg" : "0deg" }] }}
            />
          </View>
        </View>

        {/* Expanded assignments */}
        {isExpanded && assignments.length > 0 && (
          <View className="border-t border-white-6">
            {assignments.map(({ assignment, expenseLabel }) => (
              <View key={assignment.id} className="flex-row items-center justify-between px-3.5 py-2 border-b border-white-6">
                <Text className="text-[11px] font-inter-medium text-muted-foreground">{expenseLabel}</Text>
                <Text className="text-[11px] font-inter-semibold text-z-debt">
                  {formatCurrency(assignment.assigned_amount, currency)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );
}
