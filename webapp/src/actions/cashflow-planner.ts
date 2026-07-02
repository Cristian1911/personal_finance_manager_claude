"use server";

import { updateTag, cacheTag, cacheLife } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import {
  planningPeriodSchema,
  planningEntrySchema,
  planningAssignmentSchema,
} from "@/lib/validators/cashflow-planner";
import { getExchangeRate } from "@/actions/exchange-rate";
import { getOccurrencesBetween } from "@zeta/shared";
import { parseISO, endOfMonth } from "date-fns";
import { isDebtAccountType } from "@/lib/utils/account-balance";
import { toColombiaDateString } from "@/lib/utils/date";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import type { ActionResult } from "@/types/actions";
import type { TablesInsert, Database } from "@/types/database";
import type {
  CurrencyCode,
  PlanningPeriod,
  PlanningEntry,
  PlanningAssignment,
} from "@/types/domain";
import {
  BALANCE_SEED_NOTES,
  isCardChargeEntry,
  type PlanningEntryWithRelations,
  type IncomeEnvelope,
  type AssignmentDetail,
  type PeriodPlanData,
} from "@/types/cashflow-planner";
import {
  deriveIncomeState,
  classifyCommitments,
  type CommitmentIncomeRef,
  type CommitmentExpenseInput,
} from "@/lib/utils/plan-commitments";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TAG = "cashflow-planner";

// ─── Cached queries ──────────────────────────────────────────────────────────

async function getPlanningPeriodsCached(
  userId: string,
  accessToken: string
): Promise<PlanningPeriod[]> {
  "use cache";
  cacheTag(TAG);
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const { data, error } = await supabase
    .from("planning_periods")
    .select("*")
    .eq("user_id", userId)
    .order("start_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as PlanningPeriod[];
}

export async function getPlanningPeriods(): Promise<
  ActionResult<PlanningPeriod[]>
> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };

  const periods = await getPlanningPeriodsCached(user.id, accessToken);
  return { success: true, data: periods };
}

// ─── Hydrate period with entries & assignments ───────────────────────────────

async function hydratePeriodData(
  userId: string,
  period: PlanningPeriod,
  accessToken: string
): Promise<PeriodPlanData> {
  const supabase = createCachedClient(accessToken);
  const periodCurrency = period.currency_code;

  const [
    { data: rawEntries },
    { data: rawAssignments },
    { data: rawOccurrences },
    { data: spendAccounts },
  ] = await Promise.all([
    supabase
      .from("planning_entries")
      .select(
        `*,
         account:accounts!planning_entries_account_id_fkey(id, name, icon, color, account_type),
         category:categories!planning_entries_category_id_fkey(id, name, name_es, icon, color),
         recurring_template:recurring_transaction_templates!planning_entries_recurring_template_id_fkey(id, merchant_name, frequency, direction)`
      )
      .eq("period_id", period.id)
      .eq("user_id", userId)
      .order("expected_date")
      .order("sort_order"),
    supabase
      .from("planning_assignments")
      .select("*")
      .eq("period_id", period.id)
      .eq("user_id", userId),
    // recurring_occurrences is the source of truth for recurring obligations.
    // We reconcile each planning_entry's status with its matching occurrence
    // so payments recorded outside the planning UI (PDF import, email,
    // recurrentes tab, manual transactions) immediately reflect here.
    supabase
      .from("recurring_occurrences")
      .select("template_id, occurrence_date, status")
      .eq("user_id", userId)
      .gte("occurrence_date", period.start_date)
      .lte("occurrence_date", period.end_date),
    // Live spendable balances for "Saldo actual" — read directly from accounts,
    // independent of the frozen opening-balance envelope. Filters match
    // `upsertBalanceEnvelopes` (incl. show_in_dashboard) so saldo_actual
    // reconciles with the opening-balance seed.
    supabase
      .from("accounts")
      .select("id, current_balance, currency_code")
      .eq("user_id", userId)
      .eq("is_active", true)
      .eq("show_in_dashboard", true)
      .in("account_type", MAIN_ACCOUNT_TYPES),
  ]);

  const rawEntriesTyped = (rawEntries ?? []) as unknown as (Omit<PlanningEntryWithRelations, "converted_amount">)[];
  const assignments = (rawAssignments ?? []) as unknown as PlanningAssignment[];

  const occurrenceStatusByKey = new Map<
    string,
    Database["public"]["Enums"]["occurrence_status"]
  >();
  for (const occ of rawOccurrences ?? []) {
    occurrenceStatusByKey.set(`${occ.template_id}|${occ.occurrence_date}`, occ.status);
  }

  const foreignCurrencies = new Set<CurrencyCode>();
  for (const e of rawEntriesTyped) {
    if (e.currency_code && e.currency_code !== periodCurrency) {
      foreignCurrencies.add(e.currency_code);
    }
  }
  for (const a of spendAccounts ?? []) {
    if (a.currency_code && a.currency_code !== periodCurrency) {
      foreignCurrencies.add(a.currency_code);
    }
  }

  const exchangeRates: Partial<Record<CurrencyCode, number>> = {};
  if (foreignCurrencies.size > 0) {
    const rateResults = await Promise.all(
      [...foreignCurrencies].map(async (fc) => {
        const result = await getExchangeRate(fc, periodCurrency);
        return [fc, result?.rate ?? null] as const;
      })
    );
    for (const [fc, rate] of rateResults) {
      if (rate != null) exchangeRates[fc] = rate;
    }
  }

  const isMultiCurrency = foreignCurrencies.size > 0;

  const convertToPeriod = (amount: number, cur: CurrencyCode | null) => {
    if (!cur || cur === periodCurrency) return amount;
    const rate = exchangeRates[cur];
    return rate != null ? amount * rate : amount;
  };

  // Live "Saldo actual": real spendable balance, in period currency.
  // Also keep a per-account map so the opening-balance "Saldo" envelope can
  // mirror its account's live balance (instead of the frozen seed amount).
  const todayISO = toColombiaDateString(new Date());
  const liveBalanceById = new Map<string, number>();
  let saldoActual = 0;
  for (const a of spendAccounts ?? []) {
    const bal = convertToPeriod(
      Number(a.current_balance ?? 0),
      a.currency_code as CurrencyCode
    );
    liveBalanceById.set(a.id, bal);
    saldoActual += bal;
  }

  const entries: PlanningEntryWithRelations[] = rawEntriesTyped.map((e) => {
    const amount = Number(e.amount);
    let convertedAmount = amount;
    if (e.currency_code && e.currency_code !== periodCurrency) {
      const rate = exchangeRates[e.currency_code];
      convertedAmount = rate != null ? amount * rate : amount;
    }
    // For recurring entries, occurrence status overrides the entry's stored
    // status — paid/skipped occurrences must not show as Pendiente.
    let status = e.status;
    if (e.recurring_template_id) {
      const occStatus = occurrenceStatusByKey.get(
        `${e.recurring_template_id}|${e.expected_date}`
      );
      if (occStatus === "paid") status = "COMPLETED";
      else if (occStatus === "skipped") status = "SKIPPED";
    }
    return { ...e, status, converted_amount: convertedAmount };
  });

  const incomeEntries = entries.filter((e) => e.entry_type === "INCOME");
  const expenseEntries = entries.filter((e) => e.entry_type === "EXPENSE");

  const assignmentsByIncome = new Map<string, PlanningAssignment[]>();
  for (const a of assignments) {
    const list = assignmentsByIncome.get(a.income_entry_id) ?? [];
    list.push(a);
    assignmentsByIncome.set(a.income_entry_id, list);
  }

  const expenseById = new Map(expenseEntries.map((e) => [e.id, e]));

  const incomeEnvelopes: IncomeEnvelope[] = incomeEntries.map((entry) => {
    const entryAssignments = assignmentsByIncome.get(entry.id) ?? [];
    // Only assignments to still-pending expenses commit this income — paid /
    // skipped expenses already settled, so they free up the envelope. (Keeps
    // the card, the assign dialog, and "Disponible" consistent.)
    const assignedAmount = entryAssignments.reduce((sum, a) => {
      const exp = expenseById.get(a.expense_entry_id);
      const counts = !exp || (exp.status !== "COMPLETED" && exp.status !== "SKIPPED");
      return counts ? sum + Number(a.assigned_amount) : sum;
    }, 0);

    const assignmentDetails: AssignmentDetail[] = entryAssignments
      .map((a) => {
        const expense = expenseById.get(a.expense_entry_id);
        if (!expense) return null;
        return { assignment: a, expense_entry: expense };
      })
      .filter(Boolean) as AssignmentDetail[];

    const isOpening = entry.notes === BALANCE_SEED_NOTES;
    const state = isOpening
      ? ("confirmado" as const)
      : deriveIncomeState(entry.status, entry.expected_date, todayISO);

    // Opening-balance "Saldo" envelopes display the LIVE account balance (so
    // they mirror the hero's saldo_actual), not the frozen seed amount. The
    // stored entry.converted_amount stays frozen → total_income isn't doubled.
    const displayAmount =
      isOpening && entry.account_id != null && liveBalanceById.has(entry.account_id)
        ? liveBalanceById.get(entry.account_id)!
        : entry.converted_amount;

    return {
      entry,
      // Use converted amount so assignments (in period currency) are comparable
      total_amount: displayAmount,
      assigned_amount: assignedAmount,
      remaining_amount: displayAmount - assignedAmount,
      assignments: assignmentDetails,
      state,
      is_opening_balance: isOpening,
    };
  });

  const assignedPerExpense = new Map<string, number>();
  for (const a of assignments) {
    const prev = assignedPerExpense.get(a.expense_entry_id) ?? 0;
    assignedPerExpense.set(a.expense_entry_id, prev + Number(a.assigned_amount));
  }

  // Card charges never need income assignment — cash leaves when the
  // card-payment entry is settled, not when the charge posts.
  const unassignedExpenses = expenseEntries.filter((e) => {
    if (isCardChargeEntry(e)) return false;
    const assigned = assignedPerExpense.get(e.id) ?? 0;
    return assigned < e.converted_amount;
  });

  const totalIncome = incomeEntries.reduce(
    (sum, e) => sum + e.converted_amount,
    0
  );
  const totalExpenses = expenseEntries.reduce(
    (sum, e) => sum + e.converted_amount,
    0
  );
  const totalAssigned = assignments.reduce(
    (sum, a) => sum + Number(a.assigned_amount),
    0
  );
  // Sum of what's still missing per assignable expense. NOT totalExpenses −
  // totalAssigned: that would count card charges (never assignable) and keep
  // the "sin asignar" banner from ever reaching 0.
  const totalUnassigned = unassignedExpenses.reduce(
    (sum, e) => sum + (e.converted_amount - (assignedPerExpense.get(e.id) ?? 0)),
    0
  );

  // Time-aware commitments (cuenta ahora vs cubierto) over unpaid expenses.
  const incomeRefs: CommitmentIncomeRef[] = incomeEnvelopes.map((env) => ({
    entryId: env.entry.id,
    state: env.state,
    expectedDate: env.entry.expected_date,
    isOpeningBalance: env.is_opening_balance,
  }));

  const assignmentsByExpense = new Map<
    string,
    { incomeEntryId: string; amount: number }[]
  >();
  for (const a of assignments) {
    const list = assignmentsByExpense.get(a.expense_entry_id) ?? [];
    list.push({ incomeEntryId: a.income_entry_id, amount: Number(a.assigned_amount) });
    assignmentsByExpense.set(a.expense_entry_id, list);
  }

  // Card charges are excluded: they bill to the card, not to cash in hand, so
  // counting them in "cuenta ahora" would double-count against the separate
  // card-payment entry.
  const commitmentInputs: CommitmentExpenseInput[] = expenseEntries
    .filter((e) => e.status !== "COMPLETED" && e.status !== "SKIPPED" && !isCardChargeEntry(e))
    .map((e) => ({
      entryId: e.id,
      dueDate: e.expected_date,
      unpaidAmount: e.converted_amount,
      assignments: assignmentsByExpense.get(e.id) ?? [],
    }));

  const commitmentSummary = classifyCommitments(
    commitmentInputs,
    incomeRefs,
    saldoActual,
    todayISO
  );

  return {
    period,
    currency: periodCurrency,
    income_envelopes: incomeEnvelopes,
    expense_entries: expenseEntries,
    unassigned_expenses: unassignedExpenses,
    total_income: totalIncome,
    total_expenses: totalExpenses,
    total_assigned: totalAssigned,
    total_unassigned: totalUnassigned,
    exchange_rates: exchangeRates,
    is_multi_currency: isMultiCurrency,
    saldo_actual: saldoActual,
    puedo_gastar: commitmentSummary.puedoGastar,
    comprometido_ahora: commitmentSummary.comprometidoAhora,
    comprometido_cubierto: commitmentSummary.comprometidoCubierto,
    next_income_date: commitmentSummary.nextIncomeDate,
    commitments: commitmentSummary.perExpense,
  };
}

// ─── Get active period ───────────────────────────────────────────────────────

export async function getActivePeriod(): Promise<
  ActionResult<PeriodPlanData | null>
> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };

  const supabase = createCachedClient(accessToken);
  const { data: period } = await supabase
    .from("planning_periods")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!period) return { success: true, data: null };

  const planData = await hydratePeriodData(
    user.id,
    period as PlanningPeriod,
    accessToken
  );
  return { success: true, data: planData };
}

export async function getPeriodPlanData(
  periodId: string
): Promise<ActionResult<PeriodPlanData>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };

  const supabase = createCachedClient(accessToken);
  const { data: period, error } = await supabase
    .from("planning_periods")
    .select("*")
    .eq("id", periodId)
    .eq("user_id", user.id)
    .single();

  if (error || !period)
    return { success: false, error: "Periodo no encontrado" };

  const planData = await hydratePeriodData(
    user.id,
    period as PlanningPeriod,
    accessToken
  );
  return { success: true, data: planData };
}

// ─── Create period ───────────────────────────────────────────────────────────

export async function createPlanningPeriod(
  _prevState: ActionResult<PlanningPeriod> | null,
  formData: FormData
): Promise<ActionResult<PlanningPeriod>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = planningPeriodSchema.safeParse({
    name: formData.get("name") || undefined,
    preset: formData.get("preset"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
    currency_code: formData.get("currency_code") || "COP",
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  await supabase
    .from("planning_periods")
    .update({ is_active: false })
    .eq("user_id", user.id)
    .eq("is_active", true);

  const { data, error } = await supabase
    .from("planning_periods")
    .insert({
      user_id: user.id,
      name: parsed.data.name ?? null,
      preset: parsed.data.preset,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      currency_code: parsed.data.currency_code as CurrencyCode,
      is_active: true,
      notes: parsed.data.notes ?? null,
    })
    .select("*")
    .single();

  if (error) return { success: false, error: error.message };

  updateTag(TAG);
  return { success: true, data: data as PlanningPeriod };
}

// ─── Delete period ───────────────────────────────────────────────────────────

export async function deletePlanningPeriod(
  id: string
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("planning_periods")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  updateTag(TAG);
  return { success: true, data: null };
}

// ─── Seed from recurring templates ───────────────────────────────────────────

export async function seedPeriodFromRecurring(
  periodId: string
): Promise<ActionResult<{ created: number }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: period, error: periodErr } = await supabase
    .from("planning_periods")
    .select("*")
    .eq("id", periodId)
    .eq("user_id", user.id)
    .single();

  if (periodErr || !period)
    return { success: false, error: "Periodo no encontrado" };

  const [{ data: templates }, { data: existingEntries }, { data: reminders }] =
    await Promise.all([
      supabase
        .from("recurring_transaction_templates")
        .select(`*, account:accounts!recurring_transaction_templates_account_id_fkey(id, account_type)`)
        .eq("user_id", user.id)
        .eq("is_active", true),
      supabase
        .from("planning_entries")
        .select("recurring_template_id, expected_date, label, amount")
        .eq("period_id", periodId)
        .eq("user_id", user.id),
      supabase
        .from("financial_reminders")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_completed", false)
        .gte("due_date", period.start_date)
        .lte("due_date", period.end_date),
    ]);

  // Templates dedup by (template_id, date); reminders have no FK so we
  // signature them by (label, date, amount) against template-less rows.
  const existingKeys = new Set<string>();
  const existingReminderKeys = new Set<string>();
  for (const e of existingEntries ?? []) {
    if (e.recurring_template_id) {
      existingKeys.add(`${e.recurring_template_id}|${e.expected_date}`);
    } else {
      existingReminderKeys.add(`${e.label}|${e.expected_date}|${e.amount}`);
    }
  }

  const rangeStart = parseISO(period.start_date);
  const rangeEnd = parseISO(period.end_date);

  const entriesToInsert: TablesInsert<"planning_entries">[] = [];

  for (const template of templates ?? []) {
    const occurrences = getOccurrencesBetween(
      template.start_date,
      template.frequency,
      template.end_date,
      rangeStart,
      rangeEnd
    );

    const acctType = (template.account as { account_type?: string } | null)?.account_type;
    const isDebtPayment =
      template.direction === "INFLOW" && acctType != null && isDebtAccountType(acctType);

    for (const date of occurrences) {
      const dedupKey = `${template.id}|${date}`;
      if (existingKeys.has(dedupKey)) continue;

      entriesToInsert.push({
        user_id: user.id,
        period_id: periodId,
        // Debt payments flow INTO the debt account but are outflows from the user's budget
        entry_type: isDebtPayment
          ? "EXPENSE"
          : template.direction === "INFLOW" ? "INCOME" : "EXPENSE",
        label: template.merchant_name || template.description || "Sin nombre",
        amount: template.amount,
        currency_code: template.currency_code,
        expected_date: date,
        recurring_template_id: template.id,
        // For debt payments, use the source account (where money leaves from)
        account_id: isDebtPayment
          ? (template.transfer_source_account_id ?? template.account_id)
          : template.account_id,
        category_id: template.category_id,
      });
    }
  }

  for (const reminder of reminders ?? []) {
    if (!reminder.due_date || !reminder.amount || reminder.amount <= 0) continue;
    const dedupKey = `${reminder.title}|${reminder.due_date}|${reminder.amount}`;
    if (existingReminderKeys.has(dedupKey)) continue;
    entriesToInsert.push({
      user_id: user.id,
      period_id: periodId,
      entry_type: "EXPENSE",
      label: reminder.title,
      amount: reminder.amount,
      currency_code: period.currency_code,
      expected_date: reminder.due_date,
    });
  }

  if (entriesToInsert.length > 0) {
    const { error: insertErr } = await supabase
      .from("planning_entries")
      .insert(entriesToInsert);

    if (insertErr) return { success: false, error: insertErr.message };
  }

  updateTag(TAG);
  return { success: true, data: { created: entriesToInsert.length } };
}

// ─── Balance envelopes (seed + refresh) ──────────────────────────────────────

const MAIN_ACCOUNT_TYPES: Database["public"]["Enums"]["account_type"][] = [
  "CHECKING",
  "SAVINGS",
  "CASH",
];

/**
 * Seeds (first run) or refreshes (subsequent runs) one INCOME planning entry
 * per main liquid account (`CHECKING`/`SAVINGS`/`CASH` with
 * `show_in_dashboard = true`). Each entry captures the account's
 * `current_balance` AT SEED TIME — the period's opening balance.
 *
 * The amount is FROZEN: refreshes only update label/currency, never the
 * amount. The live balance is surfaced separately as `saldo_actual` (read
 * from `accounts`). Freezing prevents double-counting income — once a
 * paycheck lands and raises `current_balance`, the opening envelope must not
 * grow with it while the paycheck entry also counts. To "promote" an entry to
 * user-managed, change its notes to anything other than `[saldo]`.
 */
export async function upsertBalanceEnvelopes(
  periodId: string
): Promise<ActionResult<{ created: number; updated: number }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: period, error: periodErr } = await supabase
    .from("planning_periods")
    .select("id, start_date, currency_code")
    .eq("id", periodId)
    .eq("user_id", user.id)
    .single();

  if (periodErr || !period)
    return { success: false, error: "Periodo no encontrado" };

  // Accounts and existing seed entries are independent reads — fetch in parallel.
  const [
    { data: accounts, error: accErr },
    { data: existing, error: existingErr },
  ] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, current_balance, currency_code, account_type")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .eq("show_in_dashboard", true)
      .in("account_type", MAIN_ACCOUNT_TYPES),
    supabase
      .from("planning_entries")
      .select("id, account_id")
      .eq("period_id", periodId)
      .eq("user_id", user.id)
      .eq("entry_type", "INCOME")
      .eq("notes", BALANCE_SEED_NOTES),
  ]);

  if (accErr) return { success: false, error: accErr.message };
  if (existingErr) return { success: false, error: existingErr.message };

  if (!accounts || accounts.length === 0) {
    return { success: true, data: { created: 0, updated: 0 } };
  }

  const existingByAccount = new Map<string, string>();
  for (const row of existing ?? []) {
    if (row.account_id) existingByAccount.set(row.account_id, row.id);
  }

  let created = 0;
  let updated = 0;
  let firstError: string | null = null;

  const toInsert: TablesInsert<"planning_entries">[] = [];
  const updatePromises: PromiseLike<void>[] = [];

  for (const account of accounts) {
    const balance = Number(account.current_balance ?? 0);
    const label = `Saldo · ${account.name}`;
    const existingId = existingByAccount.get(account.id);

    if (existingId) {
      updatePromises.push(
        supabase
          .from("planning_entries")
          // amount frozen — opening balance is set once at insert (below).
          .update({
            label,
            currency_code: account.currency_code,
          })
          .eq("id", existingId)
          .eq("user_id", user.id)
          .then(({ error }) => {
            if (error) firstError ??= error.message;
            else updated += 1;
          })
      );
    } else {
      toInsert.push({
        user_id: user.id,
        period_id: periodId,
        entry_type: "INCOME",
        label,
        amount: balance,
        currency_code: account.currency_code,
        expected_date: period.start_date,
        account_id: account.id,
        status: "PLANNED",
        notes: BALANCE_SEED_NOTES,
      });
    }
  }

  // Bulk insert in one round trip; updates remain per-row but run in parallel.
  const insertPromise =
    toInsert.length > 0
      ? supabase
          .from("planning_entries")
          .insert(toInsert)
          .then(({ error }) => {
            if (error) firstError ??= error.message;
            else created = toInsert.length;
          })
      : Promise.resolve();

  await Promise.all([insertPromise, ...updatePromises]);

  if (firstError) {
    return { success: false, error: firstError };
  }
  updateTag(TAG);
  return { success: true, data: { created, updated } };
}

// ─── Entry CRUD ──────────────────────────────────────────────────────────────

export async function createPlanningEntry(
  _prevState: ActionResult<PlanningEntry> | null,
  formData: FormData
): Promise<ActionResult<PlanningEntry>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = planningEntrySchema.safeParse({
    period_id: formData.get("period_id"),
    entry_type: formData.get("entry_type"),
    label: formData.get("label"),
    amount: Number(formData.get("amount")),
    currency_code: formData.get("currency_code") || undefined,
    expected_date: formData.get("expected_date"),
    account_id: formData.get("account_id") || undefined,
    category_id: formData.get("category_id") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const { data, error } = await supabase
    .from("planning_entries")
    .insert({
      user_id: user.id,
      period_id: parsed.data.period_id,
      entry_type: parsed.data.entry_type,
      label: parsed.data.label,
      amount: parsed.data.amount,
      currency_code: parsed.data.currency_code as CurrencyCode,
      expected_date: parsed.data.expected_date,
      account_id: parsed.data.account_id || null,
      category_id: parsed.data.category_id || null,
      notes: parsed.data.notes ?? null,
    })
    .select("*")
    .single();

  if (error) return { success: false, error: error.message };

  updateTag(TAG);
  return { success: true, data: data as PlanningEntry };
}

export async function updatePlanningEntry(
  id: string,
  _prevState: ActionResult<PlanningEntry> | null,
  formData: FormData
): Promise<ActionResult<PlanningEntry>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = planningEntrySchema.safeParse({
    period_id: formData.get("period_id"),
    entry_type: formData.get("entry_type"),
    label: formData.get("label"),
    amount: Number(formData.get("amount")),
    currency_code: formData.get("currency_code") || undefined,
    expected_date: formData.get("expected_date"),
    account_id: formData.get("account_id") || undefined,
    category_id: formData.get("category_id") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const { data, error } = await supabase
    .from("planning_entries")
    .update({
      label: parsed.data.label,
      amount: parsed.data.amount,
      currency_code: parsed.data.currency_code as CurrencyCode,
      expected_date: parsed.data.expected_date,
      account_id: parsed.data.account_id || null,
      category_id: parsed.data.category_id || null,
      notes: parsed.data.notes ?? null,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) return { success: false, error: error.message };

  updateTag(TAG);
  return { success: true, data: data as PlanningEntry };
}

export async function deletePlanningEntry(
  id: string
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("planning_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  updateTag(TAG);
  return { success: true, data: null };
}

export async function toggleEntryStatus(
  id: string,
  status: "PLANNED" | "COMPLETED" | "SKIPPED"
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("planning_entries")
    .update({
      status,
      completed_at: status === "COMPLETED" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  updateTag(TAG);
  return { success: true, data: null };
}

// ─── Assignment CRUD ─────────────────────────────────────────────────────────

export async function createAssignment(
  incomeEntryId: string,
  expenseEntryId: string,
  amount: number
): Promise<ActionResult<PlanningAssignment>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = planningAssignmentSchema.safeParse({
    income_entry_id: incomeEntryId,
    expense_entry_id: expenseEntryId,
    assigned_amount: amount,
  });

  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const [{ data: incomeEntry }, { data: expenseEntry }] = await Promise.all([
    supabase
      .from("planning_entries")
      .select("id, period_id, amount, currency_code, entry_type, planning_periods!inner(currency_code)")
      .eq("id", incomeEntryId)
      .eq("user_id", user.id)
      .eq("entry_type", "INCOME")
      .single(),
    supabase
      .from("planning_entries")
      .select("id, period_id, amount, currency_code, entry_type, planning_periods!inner(currency_code)")
      .eq("id", expenseEntryId)
      .eq("user_id", user.id)
      .eq("entry_type", "EXPENSE")
      .single(),
  ]);

  if (!incomeEntry)
    return { success: false, error: "Ingreso no encontrado" };
  if (!expenseEntry)
    return { success: false, error: "Gasto no encontrado" };
  if (incomeEntry.period_id !== expenseEntry.period_id)
    return { success: false, error: "El ingreso y el gasto deben estar en el mismo periodo" };

  // Convert entry amounts to period currency for capacity checks
  const periodCurrencyCode = (incomeEntry.planning_periods as { currency_code: string }).currency_code as CurrencyCode;

  async function toConverted(entryAmount: number, entryCurrency: string): Promise<number> {
    if (entryCurrency === periodCurrencyCode) return entryAmount;
    const result = await getExchangeRate(entryCurrency as CurrencyCode, periodCurrencyCode);
    return result?.rate != null ? entryAmount * result.rate : entryAmount;
  }

  const [incomeConverted, expenseConverted] = await Promise.all([
    toConverted(Number(incomeEntry.amount), incomeEntry.currency_code),
    toConverted(Number(expenseEntry.amount), expenseEntry.currency_code),
  ]);

  // Validate capacity on both sides in parallel
  const [{ data: incomeAssignments }, { data: expenseAssignments }] =
    await Promise.all([
      supabase
        .from("planning_assignments")
        .select("assigned_amount")
        .eq("income_entry_id", incomeEntryId)
        .eq("user_id", user.id),
      supabase
        .from("planning_assignments")
        .select("assigned_amount")
        .eq("expense_entry_id", expenseEntryId)
        .eq("user_id", user.id),
    ]);

  const incomeUsed = (incomeAssignments ?? []).reduce(
    (sum, a) => sum + Number(a.assigned_amount),
    0
  );
  if (incomeUsed + amount > incomeConverted)
    return {
      success: false,
      error: "El monto excede el saldo disponible del ingreso",
    };

  const expenseAssigned = (expenseAssignments ?? []).reduce(
    (sum, a) => sum + Number(a.assigned_amount),
    0
  );
  if (expenseAssigned + amount > expenseConverted)
    return {
      success: false,
      error: "El monto excede lo que falta por asignar del gasto",
    };

  const { data, error } = await supabase
    .from("planning_assignments")
    .insert({
      user_id: user.id,
      period_id: incomeEntry.period_id,
      income_entry_id: incomeEntryId,
      expense_entry_id: expenseEntryId,
      assigned_amount: amount,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505")
      return { success: false, error: "Ya existe una asignación para esta combinación" };
    return { success: false, error: error.message };
  }

  updateTag(TAG);
  return { success: true, data: data as PlanningAssignment };
}

export async function updateAssignment(
  id: string,
  amount: number
): Promise<ActionResult<PlanningAssignment>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  if (amount <= 0)
    return { success: false, error: "El monto debe ser mayor a cero" };

  const { data: assignment } = await supabase
    .from("planning_assignments")
    .select(`*,
      income_entry:planning_entries!planning_assignments_income_entry_id_fkey(amount, currency_code, period_id),
      expense_entry:planning_entries!planning_assignments_expense_entry_id_fkey(amount, currency_code)`)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!assignment)
    return { success: false, error: "Asignación no encontrada" };

  const typedAssignment = assignment as Record<string, unknown> & {
    income_entry: { amount: number; currency_code: string; period_id: string };
    expense_entry: { amount: number; currency_code: string };
    income_entry_id: string;
    expense_entry_id: string;
  };

  // Fetch period currency for conversion
  const { data: periodData } = await supabase
    .from("planning_periods")
    .select("currency_code")
    .eq("id", typedAssignment.income_entry.period_id)
    .single();
  const pCurrency = (periodData?.currency_code ?? "COP") as CurrencyCode;

  async function toConv(entryAmount: number, entryCurrency: string): Promise<number> {
    if (entryCurrency === pCurrency) return entryAmount;
    const result = await getExchangeRate(entryCurrency as CurrencyCode, pCurrency);
    return result?.rate != null ? entryAmount * result.rate : entryAmount;
  }

  const [incomeConv, expenseConv] = await Promise.all([
    toConv(Number(typedAssignment.income_entry.amount), typedAssignment.income_entry.currency_code),
    toConv(Number(typedAssignment.expense_entry.amount), typedAssignment.expense_entry.currency_code),
  ]);

  const [{ data: otherIncomeAssignments }, { data: otherExpenseAssignments }] =
    await Promise.all([
      supabase
        .from("planning_assignments")
        .select("assigned_amount")
        .eq("income_entry_id", typedAssignment.income_entry_id)
        .eq("user_id", user.id)
        .neq("id", id),
      supabase
        .from("planning_assignments")
        .select("assigned_amount")
        .eq("expense_entry_id", typedAssignment.expense_entry_id)
        .eq("user_id", user.id)
        .neq("id", id),
    ]);

  const incomeOthersTotal = (otherIncomeAssignments ?? []).reduce(
    (sum, a) => sum + Number(a.assigned_amount),
    0
  );
  if (incomeOthersTotal + amount > incomeConv)
    return {
      success: false,
      error: "El monto excede el saldo disponible del ingreso",
    };

  const expenseOthersTotal = (otherExpenseAssignments ?? []).reduce(
    (sum, a) => sum + Number(a.assigned_amount),
    0
  );
  if (expenseOthersTotal + amount > expenseConv)
    return {
      success: false,
      error: "El monto excede lo que falta por asignar del gasto",
    };

  const { data, error } = await supabase
    .from("planning_assignments")
    .update({ assigned_amount: amount })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) return { success: false, error: error.message };

  updateTag(TAG);
  return { success: true, data: data as PlanningAssignment };
}

export async function deleteAssignment(
  id: string
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("planning_assignments")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  updateTag(TAG);
  return { success: true, data: null };
}

// ─── Auto-assign expenses chronologically ────────────────────────────────────

export async function autoAssignExpenses(
  periodId: string
): Promise<ActionResult<{ assigned: number }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const result = await getPeriodPlanData(periodId);
  if (!result.success) return result;

  const { income_envelopes, expense_entries } = result.data;

  const remaining = new Map(
    income_envelopes.map((env) => [env.entry.id, env.remaining_amount])
  );

  const sortedIncomes = [...income_envelopes].sort(
    (a, b) => a.entry.expected_date.localeCompare(b.entry.expected_date)
  );

  // Build lookup of existing assignments per (income, expense) pair
  const existingPairAmounts = new Map<string, number>();
  const assignedPerExpense = new Map<string, number>();
  for (const env of income_envelopes) {
    for (const { assignment } of env.assignments) {
      const pairKey = `${assignment.income_entry_id}|${assignment.expense_entry_id}`;
      existingPairAmounts.set(pairKey, Number(assignment.assigned_amount));
      const prev = assignedPerExpense.get(assignment.expense_entry_id) ?? 0;
      assignedPerExpense.set(assignment.expense_entry_id, prev + Number(assignment.assigned_amount));
    }
  }

  const sortedExpenses = [...expense_entries].sort(
    (a, b) => a.expected_date.localeCompare(b.expected_date)
  );

  const newAssignments: TablesInsert<"planning_assignments">[] = [];
  let assignedCount = 0;

  for (const expense of sortedExpenses) {
    if (isCardChargeEntry(expense)) continue; // billed to the card — no income envelope needed
    const alreadyAssigned = assignedPerExpense.get(expense.id) ?? 0;
    let needsAssignment = expense.converted_amount - alreadyAssigned;
    if (needsAssignment <= 0) continue;

    for (const income of sortedIncomes) {
      const available = remaining.get(income.entry.id) ?? 0;
      if (available <= 0) continue;

      const pairKey = `${income.entry.id}|${expense.id}`;
      const existingAmount = existingPairAmounts.get(pairKey) ?? 0;

      const assignAmount = Math.min(available, needsAssignment);

      // Upsert replaces — write existing + new so we don't lose prior amounts
      newAssignments.push({
        user_id: user.id,
        period_id: periodId,
        income_entry_id: income.entry.id,
        expense_entry_id: expense.id,
        assigned_amount: existingAmount + assignAmount,
      });

      remaining.set(income.entry.id, available - assignAmount);
      needsAssignment -= assignAmount;
      assignedCount++;

      if (needsAssignment <= 0) break;
    }
  }

  if (newAssignments.length > 0) {
    const { error } = await supabase
      .from("planning_assignments")
      .upsert(newAssignments, { onConflict: "income_entry_id,expense_entry_id" });

    if (error) return { success: false, error: error.message };
  }

  updateTag(TAG);
  return { success: true, data: { assigned: assignedCount } };
}

// ─── Candidate Transactions for Planning Entry ──────────────────────────────

export interface PlanCandidateTransaction {
  id: string;
  description: string;
  merchant_name: string | null;
  amount: number;
  currency_code: string;
  transaction_date: string;
  account_name: string;
}

/**
 * Find candidate transactions for linking to a planning entry's "Pagar" flow.
 * Searches this month's OUTFLOW transactions (unlinked, not excluded, no transfer group).
 * Also checks for INFLOW on a debt account if debtAccountId is provided.
 */
export async function findCandidateTransactions(params: {
  entryLabel: string;
  entryAmount: number;
  debtAccountId?: string | null;
  month: string; // YYYY-MM
}): Promise<ActionResult<PlanCandidateTransaction[]>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const monthDate = parseISO(`${params.month}-01`);
  const monthStart = `${params.month}-01`;
  const monthEnd = endOfMonth(monthDate).toISOString().split("T")[0];

  // Fetch OUTFLOW transactions this month
  const { data: outflows, error: outflowErr } = await supabase
    .from("transactions")
    .select(
      `id, clean_description, merchant_name, raw_description, amount, currency_code,
       transaction_date, direction, account_id, is_excluded, transfer_group_id,
       account:accounts!transactions_account_id_fkey(name)`
    )
    .eq("user_id", user.id)
    .eq("direction", "OUTFLOW")
    .eq("is_excluded", false)
    .is("transfer_group_id", null)
    .is("recurrence_group_id", null)
    .gte("transaction_date", monthStart)
    .lte("transaction_date", monthEnd)
    .order("transaction_date", { ascending: false })
    .limit(100);

  if (outflowErr) return { success: false, error: outflowErr.message };

  let allTxs = outflows ?? [];

  // If there's a debt account, also find INFLOW transactions on it (payments)
  if (params.debtAccountId) {
    const { data: debtInflows } = await supabase
      .from("transactions")
      .select(
        `id, clean_description, merchant_name, raw_description, amount, currency_code,
         transaction_date, direction, account_id, is_excluded, transfer_group_id,
         account:accounts!transactions_account_id_fkey(name)`
      )
      .eq("user_id", user.id)
      .eq("account_id", params.debtAccountId)
      .eq("direction", "INFLOW")
      .eq("is_excluded", false)
      .is("transfer_group_id", null)
      .is("recurrence_group_id", null)
      .gte("transaction_date", monthStart)
      .lte("transaction_date", monthEnd)
      .order("transaction_date", { ascending: false })
      .limit(20);

    if (debtInflows) allTxs = [...allTxs, ...debtInflows];
  }

  // Score & filter: amount ±50% OR merchant matching label
  const labelLower = params.entryLabel.toLowerCase();
  const amountMin = params.entryAmount * 0.5;
  const amountMax = params.entryAmount * 1.5;

  const scored = allTxs
    .map((tx) => {
      const desc = tx.clean_description ?? tx.merchant_name ?? tx.raw_description ?? "";
      const merchantMatch = desc.toLowerCase().includes(labelLower) ||
        labelLower.includes((tx.merchant_name ?? "").toLowerCase());
      const amountMatch = tx.amount >= amountMin && tx.amount <= amountMax;
      if (!merchantMatch && !amountMatch) return null;

      const accountName = (tx.account as { name: string } | null)?.name ?? "";

      return {
        id: tx.id,
        description: tx.clean_description ?? tx.merchant_name ?? tx.raw_description ?? "Sin descripción",
        merchant_name: tx.merchant_name,
        amount: tx.amount,
        currency_code: String(tx.currency_code),
        transaction_date: tx.transaction_date,
        account_name: accountName,
      } satisfies PlanCandidateTransaction;
    })
    .filter((x): x is PlanCandidateTransaction => x !== null);

  // Return top 5
  return { success: true, data: scored.slice(0, 5) };
}

// ─── Pay Planning Entry ─────────────────────────────────────────────────────

/**
 * Pay a planning entry by either linking an existing transaction or creating a new one.
 * Handles recurring occurrence linking when the entry has a recurring_template_id.
 */
export async function payPlanningEntry(params: {
  entryId: string;
  // Link mode: connect existing transaction
  existingTransactionId?: string;
  // Create mode: record a new payment
  amount?: number;
  sourceAccountId?: string;
  debtAccountId?: string;
  currencyCode?: string;
  categoryId?: string | null;
  recurringTemplateId?: string | null;
  label?: string;
}): Promise<ActionResult<{ transactionId: string }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Fetch the planning entry
  const { data: entry, error: entryErr } = await supabase
    .from("planning_entries")
    .select("*, period:planning_periods!inner(start_date, end_date)")
    .eq("id", params.entryId)
    .eq("user_id", user.id)
    .single();

  if (entryErr || !entry) {
    return { success: false, error: "Entrada del plan no encontrada" };
  }

  const period = entry.period as { start_date: string; end_date: string };

  // ── LINK MODE: connect existing transaction ──
  if (params.existingTransactionId) {
    // If the entry has a recurring template, delegate to occurrence linking
    if (entry.recurring_template_id) {
      // Find the pending occurrence for this template in the period
      const { data: occurrences } = await supabase
        .from("recurring_occurrences")
        .select("id")
        .eq("template_id", entry.recurring_template_id)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .gte("occurrence_date", period.start_date)
        .lte("occurrence_date", period.end_date)
        .limit(1);

      if (occurrences && occurrences.length > 0) {
        const { linkExistingTransactionToOccurrence } = await import("@/actions/occurrences");
        const linkResult = await linkExistingTransactionToOccurrence(
          occurrences[0].id,
          params.existingTransactionId,
        );
        if (!linkResult.success) return { success: false, error: linkResult.error };
      }
    }

    // Mark planning entry as completed
    const { error: updateErr } = await supabase
      .from("planning_entries")
      .update({ status: "COMPLETED", completed_at: new Date().toISOString() })
      .eq("id", params.entryId)
      .eq("user_id", user.id);

    if (updateErr) return { success: false, error: updateErr.message };

    updateTag(TAG);
    updateTag("occurrences");
    revalidateFinancialViews();
    return { success: true, data: { transactionId: params.existingTransactionId } };
  }

  // ── CREATE MODE: record a new payment ──
  if (!params.amount) {
    return { success: false, error: "El monto es requerido" };
  }

  // If the entry has a recurring template, delegate to the full payment
  // infrastructure. It enforces source-account rules itself: required only for
  // INFLOW "abono a deuda" templates; an OUTFLOW "Gasto con la tarjeta" charge
  // bills the card directly and takes no source account.
  if (entry.recurring_template_id) {
    const { recordRecurringOccurrencePayment } = await import("@/actions/recurring-templates");
    const payResult = await recordRecurringOccurrencePayment({
      templateId: entry.recurring_template_id,
      occurrenceDate: entry.expected_date,
      paymentDate: toColombiaDateString(new Date()),
      actualAmount: params.amount,
      sourceAccountId: params.sourceAccountId ?? null,
    });

    if (!payResult.success) return { success: false, error: payResult.error };

    // Mark planning entry as completed
    const { error: updateErr } = await supabase
      .from("planning_entries")
      .update({ status: "COMPLETED", completed_at: new Date().toISOString() })
      .eq("id", params.entryId)
      .eq("user_id", user.id);

    if (updateErr) return { success: false, error: updateErr.message };

    // Get the created transaction ID
    const { data: createdTx } = await supabase
      .from("transactions")
      .select("id")
      .eq("user_id", user.id)
      .eq("amount", params.amount)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    updateTag(TAG);
    return { success: true, data: { transactionId: createdTx?.id ?? "" } };
  }

  // Standalone entry (no recurring template) — settled from a liquid account.
  if (!params.sourceAccountId) {
    return { success: false, error: "Monto y cuenta origen son requeridos" };
  }
  const today = toColombiaDateString(new Date());
  const txId = crypto.randomUUID();
  const transferGroupId = params.debtAccountId ? crypto.randomUUID() : null;
  const currencyCode = params.currencyCode ?? entry.currency_code ?? "COP";
  const idempotencyKey = await (async () => {
    const { computeIdempotencyKey } = await import("@/lib/utils/idempotency");
    return computeIdempotencyKey({
      provider: "MANUAL_FORM",
      providerTransactionId: txId,
      transactionDate: today,
      amount: params.amount!,
      rawDescription: params.label ?? entry.label,
    });
  })();

  // OUTFLOW from source account
  const { error: txErr } = await supabase
    .from("transactions")
    .insert({
      id: txId,
      user_id: user.id,
      account_id: params.sourceAccountId,
      direction: "OUTFLOW",
      amount: params.amount,
      currency_code: currencyCode as any,
      transaction_date: today,
      raw_description: params.label ?? entry.label,
      clean_description: params.label ?? entry.label,
      capture_method: "MANUAL_FORM",
      idempotency_key: idempotencyKey,
      transfer_group_id: transferGroupId,
      category_id: params.categoryId ?? entry.category_id ?? null,
    } as any)
    .single();

  if (txErr) {
    if (txErr.code === "23505") return { success: false, error: "Este pago ya fue registrado" };
    return { success: false, error: txErr.message };
  }

  // Update source account balance
  const { data: sourceAcct } = await supabase
    .from("accounts")
    .select("current_balance, account_type")
    .eq("id", params.sourceAccountId)
    .eq("user_id", user.id)
    .single();

  if (sourceAcct) {
    const { applyAccountBalanceDelta } = await import("@/lib/utils/account-balance");
    const newBalance = applyAccountBalanceDelta({
      currentBalance: sourceAcct.current_balance,
      accountType: sourceAcct.account_type,
      direction: "OUTFLOW",
      amount: params.amount,
    });
    await supabase
      .from("accounts")
      .update({ current_balance: newBalance })
      .eq("id", params.sourceAccountId)
      .eq("user_id", user.id);
  }

  // If debt account, create INFLOW on the debt account
  if (params.debtAccountId) {
    const debtTxId = crypto.randomUUID();
    const debtIdempotencyKey = await (async () => {
      const { computeIdempotencyKey } = await import("@/lib/utils/idempotency");
      return computeIdempotencyKey({
        provider: "MANUAL_FORM",
        providerTransactionId: debtTxId,
        transactionDate: today,
        amount: params.amount!,
        rawDescription: `Pago: ${params.label ?? entry.label}`,
      });
    })();

    const { error: debtTxErr } = await supabase
      .from("transactions")
      .insert({
        id: debtTxId,
        user_id: user.id,
        account_id: params.debtAccountId,
        direction: "INFLOW",
        amount: params.amount,
        currency_code: currencyCode as any,
        transaction_date: today,
        raw_description: `Pago: ${params.label ?? entry.label}`,
        clean_description: `Pago: ${params.label ?? entry.label}`,
        capture_method: "MANUAL_FORM",
        idempotency_key: debtIdempotencyKey,
        transfer_group_id: transferGroupId,
        category_id: params.categoryId ?? entry.category_id ?? null,
      } as any)
      .single();

    if (debtTxErr && debtTxErr.code !== "23505") {
      console.error("Debt INFLOW insert error:", debtTxErr.message);
    }

    // Update debt account balance
    const { data: debtAcct } = await supabase
      .from("accounts")
      .select("current_balance, account_type")
      .eq("id", params.debtAccountId)
      .eq("user_id", user.id)
      .single();

    if (debtAcct) {
      const { applyAccountBalanceDelta } = await import("@/lib/utils/account-balance");
      const newBalance = applyAccountBalanceDelta({
        currentBalance: debtAcct.current_balance,
        accountType: debtAcct.account_type,
        direction: "INFLOW",
        amount: params.amount,
      });
      await supabase
        .from("accounts")
        .update({ current_balance: newBalance })
        .eq("id", params.debtAccountId)
        .eq("user_id", user.id);
    }
  }

  // Mark planning entry as completed
  const { error: entryUpdateErr } = await supabase
    .from("planning_entries")
    .update({ status: "COMPLETED", completed_at: new Date().toISOString() })
    .eq("id", params.entryId)
    .eq("user_id", user.id);

  if (entryUpdateErr) {
    console.error("Entry update error:", entryUpdateErr.message);
  }

  updateTag(TAG);
  updateTag("occurrences");
  updateTag("recurring");
  revalidateFinancialViews();
  return { success: true, data: { transactionId: txId } };
}

// ─── Confirm income received (INFLOW) ────────────────────────────────────────

/**
 * Confirms an INCOME planning entry as received. Mirrors `payPlanningEntry`
 * but records an INFLOW so the real account balance rises (→ `saldo_actual`).
 * LINK mode connects an already-imported transaction; CREATE mode inserts a
 * new INFLOW into the target account. Recurring entries link to their pending
 * occurrence so the recurrentes view stays consistent.
 */
export async function confirmIncomeReceived(params: {
  entryId: string;
  existingTransactionId?: string; // LINK mode
  amount?: number; // CREATE mode
  accountId?: string; // CREATE mode (INFLOW target)
  currencyCode?: string;
  label?: string;
}): Promise<ActionResult<{ transactionId: string }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: entry, error: entryErr } = await supabase
    .from("planning_entries")
    .select("*, period:planning_periods!inner(start_date, end_date)")
    .eq("id", params.entryId)
    .eq("user_id", user.id)
    .single();

  if (entryErr || !entry) {
    return { success: false, error: "Entrada del plan no encontrada" };
  }
  if (entry.entry_type !== "INCOME") {
    return { success: false, error: "Esta entrada no es un ingreso" };
  }

  const period = entry.period as { start_date: string; end_date: string };

  const markCompleted = async () => {
    const { error } = await supabase
      .from("planning_entries")
      .update({ status: "COMPLETED", completed_at: new Date().toISOString() })
      .eq("id", params.entryId)
      .eq("user_id", user.id);
    return error?.message ?? null;
  };

  // Returns an error message on failure, or null on success.
  const linkOccurrence = async (transactionId: string): Promise<string | null> => {
    if (!entry.recurring_template_id) return null;
    const { data: occurrences, error: occErr } = await supabase
      .from("recurring_occurrences")
      .select("id")
      .eq("template_id", entry.recurring_template_id)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .gte("occurrence_date", period.start_date)
      .lte("occurrence_date", period.end_date)
      .limit(1);
    if (occErr) return occErr.message;
    if (occurrences && occurrences.length > 0) {
      const { linkExistingTransactionToOccurrence } = await import("@/actions/occurrences");
      const res = await linkExistingTransactionToOccurrence(occurrences[0].id, transactionId);
      if (!res.success) return res.error;
    }
    return null;
  };

  // ── LINK MODE: connect an already-imported transaction ──
  if (params.existingTransactionId) {
    // Sequential: don't mark the entry completed if the occurrence link failed
    // (nothing else happened in LINK mode — avoids a completed-but-unlinked entry).
    const linkErr = await linkOccurrence(params.existingTransactionId);
    if (linkErr) return { success: false, error: linkErr };
    const markErr = await markCompleted();
    if (markErr) return { success: false, error: markErr };

    updateTag(TAG);
    updateTag("occurrences");
    revalidateFinancialViews();
    return { success: true, data: { transactionId: params.existingTransactionId } };
  }

  // ── CREATE MODE: record a new INFLOW ──
  if (!params.amount || !params.accountId) {
    return { success: false, error: "Monto y cuenta son requeridos" };
  }

  // Load the target account up front — income must land in a spendable account.
  // INFLOW to a debt account would wrongly REDUCE the debt, not record income.
  const { data: acct, error: acctErr } = await supabase
    .from("accounts")
    .select("current_balance, account_type")
    .eq("id", params.accountId)
    .eq("user_id", user.id)
    .single();

  if (acctErr || !acct) return { success: false, error: "Cuenta no encontrada" };
  if (isDebtAccountType(acct.account_type)) {
    return { success: false, error: "No puedes registrar un ingreso en una cuenta de deuda" };
  }

  const today = toColombiaDateString(new Date());
  const txId = crypto.randomUUID();
  const currencyCode = params.currencyCode ?? entry.currency_code ?? "COP";
  const idempotencyKey = await (async () => {
    const { computeIdempotencyKey } = await import("@/lib/utils/idempotency");
    return computeIdempotencyKey({
      provider: "MANUAL_FORM",
      providerTransactionId: txId,
      transactionDate: today,
      amount: params.amount!,
      rawDescription: params.label ?? entry.label,
    });
  })();

  const { error: txErr } = await supabase
    .from("transactions")
    .insert({
      id: txId,
      user_id: user.id,
      account_id: params.accountId,
      direction: "INFLOW",
      amount: params.amount,
      currency_code: currencyCode as any,
      transaction_date: today,
      raw_description: params.label ?? entry.label,
      clean_description: params.label ?? entry.label,
      capture_method: "MANUAL_FORM",
      idempotency_key: idempotencyKey,
      category_id: entry.category_id ?? null,
    } as any)
    .single();

  if (txErr) {
    if (txErr.code === "23505") return { success: false, error: "Este ingreso ya fue registrado" };
    return { success: false, error: txErr.message };
  }

  // Raise the target account balance (acct already loaded + validated above).
  {
    const { applyAccountBalanceDelta } = await import("@/lib/utils/account-balance");
    const newBalance = applyAccountBalanceDelta({
      currentBalance: acct.current_balance,
      accountType: acct.account_type,
      direction: "INFLOW",
      amount: params.amount,
    });
    await supabase
      .from("accounts")
      .update({ current_balance: newBalance })
      .eq("id", params.accountId)
      .eq("user_id", user.id);
  }

  // CREATE: the INFLOW + balance are already recorded, so marking is correct
  // regardless of link success. Parallel + log (non-blocking secondary writes).
  const [linkErr, markErr] = await Promise.all([linkOccurrence(txId), markCompleted()]);
  if (linkErr) console.error("Income confirm link occurrence error:", linkErr);
  if (markErr) console.error("Income confirm entry update error:", markErr);

  updateTag(TAG);
  updateTag("occurrences");
  revalidateFinancialViews();
  return { success: true, data: { transactionId: txId } };
}
