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
import { parseISO } from "date-fns";
import { isDebtAccountType } from "@/lib/utils/account-balance";
import type { ActionResult } from "@/types/actions";
import type { TablesInsert } from "@/types/database";
import type {
  CurrencyCode,
  PlanningPeriod,
  PlanningEntry,
  PlanningAssignment,
} from "@/types/domain";
import type {
  PlanningEntryWithRelations,
  IncomeEnvelope,
  AssignmentDetail,
  PeriodPlanData,
} from "@/types/cashflow-planner";

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

  const [{ data: rawEntries }, { data: rawAssignments }] = await Promise.all([
    supabase
      .from("planning_entries")
      .select(
        `*,
         account:accounts!planning_entries_account_id_fkey(id, name, icon, color),
         category:categories!planning_entries_category_id_fkey(id, name, name_es, icon, color),
         recurring_template:recurring_transaction_templates!planning_entries_recurring_template_id_fkey(id, merchant_name, frequency)`
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
  ]);

  const rawEntriesTyped = (rawEntries ?? []) as unknown as (Omit<PlanningEntryWithRelations, "converted_amount">)[];
  const assignments = (rawAssignments ?? []) as unknown as PlanningAssignment[];

  const foreignCurrencies = new Set<CurrencyCode>();
  for (const e of rawEntriesTyped) {
    if (e.currency_code && e.currency_code !== periodCurrency) {
      foreignCurrencies.add(e.currency_code);
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

  const entries: PlanningEntryWithRelations[] = rawEntriesTyped.map((e) => {
    const amount = Number(e.amount);
    let convertedAmount = amount;
    if (e.currency_code && e.currency_code !== periodCurrency) {
      const rate = exchangeRates[e.currency_code];
      convertedAmount = rate != null ? amount * rate : amount;
    }
    return { ...e, converted_amount: convertedAmount };
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
    const assignedAmount = entryAssignments.reduce(
      (sum, a) => sum + Number(a.assigned_amount),
      0
    );

    const assignmentDetails: AssignmentDetail[] = entryAssignments
      .map((a) => {
        const expense = expenseById.get(a.expense_entry_id);
        if (!expense) return null;
        return { assignment: a, expense_entry: expense };
      })
      .filter(Boolean) as AssignmentDetail[];

    return {
      entry,
      // Use converted amount so assignments (in period currency) are comparable
      total_amount: entry.converted_amount,
      assigned_amount: assignedAmount,
      remaining_amount: entry.converted_amount - assignedAmount,
      assignments: assignmentDetails,
    };
  });

  const assignedPerExpense = new Map<string, number>();
  for (const a of assignments) {
    const prev = assignedPerExpense.get(a.expense_entry_id) ?? 0;
    assignedPerExpense.set(a.expense_entry_id, prev + Number(a.assigned_amount));
  }

  const unassignedExpenses = expenseEntries.filter((e) => {
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

  return {
    period,
    currency: periodCurrency,
    income_envelopes: incomeEnvelopes,
    expense_entries: expenseEntries,
    unassigned_expenses: unassignedExpenses,
    total_income: totalIncome,
    total_expenses: totalExpenses,
    total_assigned: totalAssigned,
    total_unassigned: totalExpenses - totalAssigned,
    exchange_rates: exchangeRates,
    is_multi_currency: isMultiCurrency,
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
        .select("recurring_template_id, expected_date")
        .eq("period_id", periodId)
        .eq("user_id", user.id)
        .not("recurring_template_id", "is", null),
      supabase
        .from("financial_reminders")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_completed", false)
        .gte("due_date", period.start_date)
        .lte("due_date", period.end_date),
    ]);

  const existingKeys = new Set(
    (existingEntries ?? []).map(
      (e) => `${e.recurring_template_id}|${e.expected_date}`
    )
  );

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
