"use server";

import { cache } from "react";
import { revalidateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { reminderSchema } from "@/lib/validators/reminders";
import type { ActionResult } from "@/types/actions";
import type { FinancialReminder } from "@/types/domain";

// ── Queries ───────────────────────────────────────────────

export const getReminders = cache(
  async (filter?: "pending" | "completed"): Promise<FinancialReminder[]> => {
    const { supabase, user } = await getAuthenticatedClient();
    if (!user) return [];

    if (filter === "completed") {
      const { data } = await supabase
        .from("financial_reminders")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_completed", true)
        .order("completed_at", { ascending: false });

      return data ?? [];
    }

    // Default: pending — overdue first (due_date asc, nulls last), then created_at desc
    if (filter === "pending") {
      const { data } = await supabase
        .from("financial_reminders")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_completed", false)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      return data ?? [];
    }

    // No filter — return all, pending first
    const [{ data: pending }, { data: completed }] = await Promise.all([
      supabase
        .from("financial_reminders")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_completed", false)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("financial_reminders")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_completed", true)
        .order("completed_at", { ascending: false }),
    ]);

    return [...(pending ?? []), ...(completed ?? [])];
  }
);

// ── Mutations ─────────────────────────────────────────────

export async function createReminder(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = reminderSchema.safeParse({
    title: formData.get("title"),
    amount: formData.get("amount"),
    currency_code: formData.get("currency_code") || "COP",
    due_date: formData.get("due_date"),
  });

  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const { data, error } = await supabase
    .from("financial_reminders")
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      amount: parsed.data.amount ?? null,
      currency_code: parsed.data.currency_code,
      due_date: parsed.data.due_date ?? null,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidateTag("reminders", "zeta");
  revalidateTag("attention", "zeta");
  return { success: true, data: { id: data.id } };
}

export async function toggleReminder(
  id: string
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Fetch current state
  const { data: current, error: fetchError } = await supabase
    .from("financial_reminders")
    .select("is_completed")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !current)
    return { success: false, error: "Recordatorio no encontrado" };

  const nowCompleted = !current.is_completed;

  const { error } = await supabase
    .from("financial_reminders")
    .update({
      is_completed: nowCompleted,
      completed_at: nowCompleted ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidateTag("reminders", "zeta");
  revalidateTag("attention", "zeta");
  return { success: true, data: null };
}

export async function updateReminder(
  id: string,
  formData: FormData
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = reminderSchema.safeParse({
    title: formData.get("title"),
    amount: formData.get("amount"),
    currency_code: formData.get("currency_code") || "COP",
    due_date: formData.get("due_date"),
  });

  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const { error } = await supabase
    .from("financial_reminders")
    .update({
      title: parsed.data.title,
      amount: parsed.data.amount ?? null,
      currency_code: parsed.data.currency_code,
      due_date: parsed.data.due_date ?? null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidateTag("reminders", "zeta");
  revalidateTag("attention", "zeta");
  return { success: true, data: null };
}

export async function postponeReminder(
  id: string
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const newDate = tomorrow.toISOString().slice(0, 10);

  const { error } = await supabase
    .from("financial_reminders")
    .update({ due_date: newDate })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidateTag("reminders", "zeta");
  revalidateTag("attention", "zeta");
  return { success: true, data: null };
}

export async function deleteReminder(
  id: string
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("financial_reminders")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidateTag("reminders", "zeta");
  revalidateTag("attention", "zeta");
  return { success: true, data: null };
}
