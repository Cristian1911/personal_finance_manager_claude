"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { recurringTemplateSchema } from "@/lib/validators/recurring-template";
import { getNextOccurrence, getOccurrencesBetween } from "@venti5/shared";
import { addDays } from "date-fns";
import type { ActionResult } from "@/types/actions";
import type {
  RecurringTemplate,
  RecurringTemplateWithRelations,
  UpcomingRecurrence,
} from "@/types/domain";

const TEMPLATE_SELECT = `
  *,
  account:accounts!recurring_transaction_templates_account_id_fkey(id, name, icon, color),
  category:categories!recurring_transaction_templates_category_id_fkey(id, name, name_es, icon, color)
`;

export async function getRecurringTemplates(): Promise<
  ActionResult<RecurringTemplateWithRelations[]>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("recurring_transaction_templates")
    .select(TEMPLATE_SELECT)
    .order("is_active", { ascending: false })
    .order("merchant_name");

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as RecurringTemplateWithRelations[] };
}

export async function getRecurringTemplate(
  id: string
): Promise<ActionResult<RecurringTemplateWithRelations>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("recurring_transaction_templates")
    .select(TEMPLATE_SELECT)
    .eq("id", id)
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as RecurringTemplateWithRelations };
}

export async function createRecurringTemplate(
  _prevState: ActionResult<RecurringTemplate>,
  formData: FormData
): Promise<ActionResult<RecurringTemplate>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  const parsed = recurringTemplateSchema.safeParse({
    account_id: formData.get("account_id"),
    amount: formData.get("amount"),
    currency_code: formData.get("currency_code"),
    direction: formData.get("direction"),
    frequency: formData.get("frequency"),
    merchant_name: formData.get("merchant_name"),
    description: formData.get("description") || undefined,
    category_id: formData.get("category_id") || undefined,
    day_of_month: formData.get("day_of_month") || undefined,
    day_of_week: formData.get("day_of_week") || undefined,
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date") || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { data, error } = await supabase
    .from("recurring_transaction_templates")
    .insert({
      user_id: user.id,
      ...parsed.data,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/recurrentes");
  revalidatePath("/dashboard");
  return { success: true, data };
}

export async function updateRecurringTemplate(
  id: string,
  _prevState: ActionResult<RecurringTemplate>,
  formData: FormData
): Promise<ActionResult<RecurringTemplate>> {
  const supabase = await createClient();

  const parsed = recurringTemplateSchema.safeParse({
    account_id: formData.get("account_id"),
    amount: formData.get("amount"),
    currency_code: formData.get("currency_code"),
    direction: formData.get("direction"),
    frequency: formData.get("frequency"),
    merchant_name: formData.get("merchant_name"),
    description: formData.get("description") || undefined,
    category_id: formData.get("category_id") || undefined,
    day_of_month: formData.get("day_of_month") || undefined,
    day_of_week: formData.get("day_of_week") || undefined,
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date") || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { data, error } = await supabase
    .from("recurring_transaction_templates")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/recurrentes");
  revalidatePath("/dashboard");
  return { success: true, data };
}

export async function deleteRecurringTemplate(
  id: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("recurring_transaction_templates")
    .delete()
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/recurrentes");
  revalidatePath("/dashboard");
  return { success: true, data: undefined };
}

export async function toggleRecurringTemplate(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("recurring_transaction_templates")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/recurrentes");
  revalidatePath("/dashboard");
  return { success: true, data: undefined };
}

/**
 * Get upcoming recurring payments for the next N days.
 * Computes occurrences on the fly from active templates.
 */
export async function getUpcomingRecurrences(
  days: number = 30
): Promise<UpcomingRecurrence[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: templates } = await supabase
    .from("recurring_transaction_templates")
    .select(TEMPLATE_SELECT)
    .eq("is_active", true);

  if (!templates || templates.length === 0) return [];

  const now = new Date();
  const rangeEnd = addDays(now, days);

  const upcoming: UpcomingRecurrence[] = [];

  for (const template of templates as RecurringTemplateWithRelations[]) {
    const dates = getOccurrencesBetween(
      template.start_date,
      template.frequency,
      template.end_date,
      now,
      rangeEnd
    );

    for (const date of dates) {
      upcoming.push({ template, next_date: date });
    }
  }

  // Sort by date ascending
  upcoming.sort((a, b) => a.next_date.localeCompare(b.next_date));

  return upcoming;
}

/**
 * Get monthly totals for active recurring templates.
 */
export async function getRecurringSummary(): Promise<{
  totalMonthlyExpenses: number;
  totalMonthlyIncome: number;
  activeCount: number;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user)
    return { totalMonthlyExpenses: 0, totalMonthlyIncome: 0, activeCount: 0 };

  const { data: templates } = await supabase
    .from("recurring_transaction_templates")
    .select("amount, direction, frequency")
    .eq("is_active", true);

  if (!templates)
    return { totalMonthlyExpenses: 0, totalMonthlyIncome: 0, activeCount: 0 };

  let totalMonthlyExpenses = 0;
  let totalMonthlyIncome = 0;

  for (const t of templates) {
    // Normalize to monthly equivalent
    const monthlyAmount = toMonthlyAmount(t.amount, t.frequency);
    if (t.direction === "OUTFLOW") {
      totalMonthlyExpenses += monthlyAmount;
    } else {
      totalMonthlyIncome += monthlyAmount;
    }
  }

  return {
    totalMonthlyExpenses,
    totalMonthlyIncome,
    activeCount: templates.length,
  };
}

function toMonthlyAmount(
  amount: number,
  frequency: string
): number {
  switch (frequency) {
    case "WEEKLY":
      return amount * 4.33;
    case "BIWEEKLY":
      return amount * 2.17;
    case "MONTHLY":
      return amount;
    case "QUARTERLY":
      return amount / 3;
    case "ANNUAL":
      return amount / 12;
    default:
      return amount;
  }
}
