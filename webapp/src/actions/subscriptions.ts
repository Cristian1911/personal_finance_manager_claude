"use server";

import { cacheTag, cacheLife, updateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import {
  subscriptionIdSchema,
  updateSubscriptionSchema,
} from "@/lib/validators/subscription";
import type { ActionResult } from "@/types/actions";
import type { SubscriptionWithDetails } from "@/types/domain";

async function getSubscriptionsCached(
  accessToken: string,
  userId: string,
): Promise<SubscriptionWithDetails[]> {
  "use cache";
  cacheTag("subscriptions");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const { data, error } = await supabase
    .from("subscriptions")
    .select(`
      *,
      destinatario:destinatarios!subscriptions_destinatario_id_fkey ( name, default_category_id ),
      template:recurring_transaction_templates!subscriptions_recurring_template_id_fkey ( amount, frequency )
    `)
    .eq("user_id", userId)
    .not("status", "in", "(dismissed,cancelled)")
    .order("created_at", { ascending: false });

  if (error) throw error; // surfaces to getSubscriptions() catch -> Spanish error
  if (!data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => ({
    ...row,
    destinatario_name: row.destinatario?.name ?? "—",
    default_category_id: row.destinatario?.default_category_id ?? null,
    category_name: null,
    template_amount: row.template?.amount ?? null,
    template_frequency: row.template?.frequency ?? null,
    next_occurrence_date: null,
    monthly_expected: null,
  })) as SubscriptionWithDetails[];
}

export async function getSubscriptions(): Promise<
  ActionResult<SubscriptionWithDetails[]>
> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    const data = await getSubscriptionsCached(accessToken, user.id);
    return { success: true, data };
  } catch {
    return { success: false, error: "Error al cargar las suscripciones" };
  }
}

export async function dismissSubscription(
  id: string,
): Promise<ActionResult<undefined>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  if (!subscriptionIdSchema.safeParse(id).success)
    return { success: false, error: "ID inválido" };
  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "dismissed",
      dismissed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { success: false, error: error.message };
  updateTag("subscriptions");
  return { success: true, data: undefined };
}

export async function markForCancellation(
  id: string,
): Promise<ActionResult<undefined>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  if (!subscriptionIdSchema.safeParse(id).success)
    return { success: false, error: "ID inválido" };
  const { data, error } = await supabase
    .from("subscriptions")
    .update({ status: "marked_for_cancellation" })
    .eq("id", id)
    .eq("user_id", user.id)
    .in("status", ["active", "trial"])
    .select("id");
  if (error) return { success: false, error: error.message };
  if (!data || data.length === 0)
    return { success: false, error: "La suscripción no está activa" };
  updateTag("subscriptions");
  return { success: true, data: undefined };
}

export async function cancelSubscription(
  id: string,
): Promise<ActionResult<undefined>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  if (!subscriptionIdSchema.safeParse(id).success)
    return { success: false, error: "ID inválido" };
  const { data: sub, error: readErr } = await supabase
    .from("subscriptions")
    .select("id, recurring_template_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (readErr || !sub) return { success: false, error: "Suscripción no encontrada" };
  if (sub.recurring_template_id) {
    const { error: tErr } = await supabase
      .from("recurring_transaction_templates")
      .update({ is_active: false })
      .eq("id", sub.recurring_template_id)
      .eq("user_id", user.id);
    if (tErr) return { success: false, error: tErr.message };
    // DB trigger sets subscriptions.status = 'cancelled'
  } else {
    const { error: sErr } = await supabase
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("user_id", user.id);
    if (sErr) return { success: false, error: sErr.message };
  }
  updateTag("subscriptions");
  revalidateFinancialViews();
  return { success: true, data: undefined };
}

export async function updateSubscription(
  id: string,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  if (!subscriptionIdSchema.safeParse(id).success)
    return { success: false, error: "ID inválido" };
  const parsed = updateSubscriptionSchema.safeParse({
    trial_ends_on: formData.get("trial_ends_on"),
    cancel_url: formData.get("cancel_url"),
  });
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };
  const status = parsed.data.trial_ends_on ? "trial" : undefined;
  const { error } = await supabase
    .from("subscriptions")
    .update({
      trial_ends_on: parsed.data.trial_ends_on ?? null,
      cancel_url: parsed.data.cancel_url ?? null,
      ...(status ? { status } : {}),
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { success: false, error: error.message };
  updateTag("subscriptions");
  return { success: true, data: undefined };
}

/**
 * Helper called from recurring-templates.ts (Task 5).
 * NOT a form-action target.
 */
export async function upsertSubscriptionFromTemplate(
  supabase: Awaited<ReturnType<typeof getAuthenticatedClient>>["supabase"],
  userId: string,
  template: {
    id: string;
    destinatario_id: string | null;
    currency_code: string;
  },
  isSubscription: boolean,
): Promise<void> {
  if (isSubscription) {
    if (!template.destinatario_id) return;
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("id, status")
      .eq("user_id", userId)
      .eq("destinatario_id", template.destinatario_id)
      .not("status", "in", "(cancelled,dismissed)")
      .maybeSingle();
    if (existing) {
      await supabase
        .from("subscriptions")
        .update({ recurring_template_id: template.id, status: "active" })
        .eq("id", existing.id)
        .eq("user_id", userId);
    } else {
      await supabase.from("subscriptions").insert({
        user_id: userId,
        destinatario_id: template.destinatario_id,
        recurring_template_id: template.id,
        status: "active",
        currency_code: template.currency_code,
      });
    }
  } else {
    await supabase
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("user_id", userId)
      .eq("recurring_template_id", template.id)
      .not("status", "in", "(cancelled,dismissed)");
  }
  updateTag("subscriptions");
}
