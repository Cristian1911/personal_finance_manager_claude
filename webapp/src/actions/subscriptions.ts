"use server";

import { cacheTag, cacheLife, updateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import {
  subscriptionIdSchema,
  updateSubscriptionSchema,
} from "@/lib/validators/subscription";
import { ensureCurrentOccurrences } from "@/actions/occurrences";
import { toColombiaDateString } from "@/lib/utils/date";
import type { ActionResult } from "@/types/actions";
import type { SubscriptionWithDetails } from "@/types/domain";
import type { Database } from "@/types/database";
import { detectSubscriptions, type DetectorTransaction } from "@zeta/shared";

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
      id, status, recurring_template_id, estimated_amount,
      destinatario_id, currency_code, trial_ends_on, cancel_url,
      created_at, updated_at, detected_at, dismissed_at,
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
 * Returns true if there is an active (non-cancelled, non-dismissed) subscription
 * linked to the given recurring template.
 */
export async function getSubscriptionForTemplate(templateId: string): Promise<boolean> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return false;
  const { data } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .eq("recurring_template_id", templateId)
    .not("status", "in", "(cancelled,dismissed)")
    .maybeSingle();
  return !!data;
}

/**
 * Runs subscription auto-detection over the last 12 months of OUTFLOW transactions.
 * Called after every PDF/email import — best-effort, failures never surface to the user.
 * Destinatarios that already have ANY subscriptions row (any status) are excluded so
 * dismissed/cancelled suggestions are never re-surfaced and active ones are not duplicated.
 */
export async function runSubscriptionDetection(): Promise<ActionResult<{ created: number }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const since = new Date();
  since.setMonth(since.getMonth() - 12);

  const { data: txs } = await supabase
    .from("transactions")
    .select("destinatario_id, transaction_date, amount, currency_code, direction")
    .eq("user_id", user.id)
    .eq("direction", "OUTFLOW")
    .not("destinatario_id", "is", null)
    .gte("transaction_date", toColombiaDateString(since));

  // Destinatarios that already have ANY subscriptions row (any status) — never re-suggest
  // (preserves sticky dismissal AND avoids duplicating active/cancelled ones).
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("destinatario_id")
    .eq("user_id", user.id);
  const excluded = new Set((existing ?? []).map((r) => r.destinatario_id));

  const candidates = detectSubscriptions((txs ?? []) as DetectorTransaction[], excluded);
  if (candidates.length === 0) return { success: true, data: { created: 0 } };

  const rows = candidates.map((c) => ({
    user_id: user.id,
    destinatario_id: c.destinatario_id,
    status: "suggested" as const,
    estimated_amount: c.median_amount,
    currency_code: c.currency_code,
    detected_at: new Date().toISOString(),
  }));

  const { data: inserted, error } = await supabase
    .from("subscriptions")
    .insert(rows)
    .select("id");
  if (error && error.code !== "23505")
    return { success: false, error: error.message };

  updateTag("subscriptions");
  return { success: true, data: { created: inserted?.length ?? 0 } };
}

export async function confirmSubscription(
  id: string,
): Promise<ActionResult<undefined>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  if (!subscriptionIdSchema.safeParse(id).success)
    return { success: false, error: "ID inválido" };
  const { data, error } = await supabase
    .from("subscriptions")
    .update({ status: "active" })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "suggested")
    .select("id");
  if (error) return { success: false, error: error.message };
  if (!data || data.length === 0)
    return { success: false, error: "La sugerencia ya no está disponible" };
  updateTag("subscriptions");
  return { success: true, data: undefined };
}

export async function formalizeSubscription(
  id: string,
): Promise<ActionResult<undefined>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  if (!subscriptionIdSchema.safeParse(id).success)
    return { success: false, error: "ID inválido" };

  const { data: sub } = await supabase
    .from("subscriptions")
    .select(`
      id, destinatario_id, estimated_amount, currency_code, recurring_template_id,
      destinatario:destinatarios!subscriptions_destinatario_id_fkey ( name, default_category_id )
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!sub) return { success: false, error: "Suscripción no encontrada" };
  if (sub.recurring_template_id) return { success: true, data: undefined };

  // If the user already has an active recurring template for this destinatario, link it
  // instead of creating a second one (which would double the occurrence generation).
  // Skip templates that already back a live subscription — a merchant can have
  // several subscriptions, but each is anchored to a distinct template, so
  // re-using one would collide with subscriptions_one_live_per_template.
  const { data: liveSubs } = await supabase
    .from("subscriptions")
    .select("recurring_template_id")
    .eq("user_id", user.id)
    .eq("destinatario_id", sub.destinatario_id)
    .not("recurring_template_id", "is", null)
    .not("status", "in", "(cancelled,dismissed)");
  const usedTemplateIds = new Set(
    (liveSubs ?? []).map((r) => r.recurring_template_id),
  );
  const { data: activeTpls } = await supabase
    .from("recurring_transaction_templates")
    .select("id")
    .eq("user_id", user.id)
    .eq("destinatario_id", sub.destinatario_id)
    .eq("is_active", true);
  const existingTpl = (activeTpls ?? []).find(
    (t) => !usedTemplateIds.has(t.id),
  );
  if (existingTpl) {
    const { error: linkExistingErr } = await supabase
      .from("subscriptions")
      .update({ recurring_template_id: existingTpl.id, status: "active" })
      .eq("id", id)
      .eq("user_id", user.id);
    if (linkExistingErr)
      return { success: false, error: linkExistingErr.message };
    await ensureCurrentOccurrences();
    updateTag("subscriptions");
    revalidateFinancialViews();
    return { success: true, data: undefined };
  }

  // Prefer a non-debt account: an OUTFLOW subscription template on a CREDIT_CARD/LOAN
  // would be misread as a debt payment.
  let { data: acct } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .not("account_type", "in", "(CREDIT_CARD,LOAN)")
    .limit(1)
    .maybeSingle();
  // Fall back to any active account if the user only has debt accounts.
  if (!acct) {
    const { data: fallbackAcct } = await supabase
      .from("accounts")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    acct = fallbackAcct;
  }
  if (!acct)
    return {
      success: false,
      error: "No hay una cuenta disponible para programar la suscripción",
    };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dest = sub.destinatario as any;
  const today = toColombiaDateString(new Date());
  const { data: tpl, error: tErr } = await supabase
    .from("recurring_transaction_templates")
    .insert({
      user_id: user.id,
      account_id: acct.id,
      destinatario_id: sub.destinatario_id,
      category_id: (dest?.default_category_id ?? null) as string | null,
      merchant_name: (dest?.name ?? "Suscripción") as string,
      amount: sub.estimated_amount ?? 0,
      currency_code: sub.currency_code as Database["public"]["Enums"]["currency_code"],
      direction: "OUTFLOW" as Database["public"]["Enums"]["transaction_direction"],
      frequency: "MONTHLY" as Database["public"]["Enums"]["recurrence_frequency"],
      start_date: today,
      is_active: true,
    })
    .select("id")
    .single();
  if (tErr || !tpl)
    return { success: false, error: tErr?.message ?? "Error al crear la plantilla" };

  const { error: linkErr } = await supabase
    .from("subscriptions")
    .update({ recurring_template_id: tpl.id, status: "active" })
    .eq("id", id)
    .eq("user_id", user.id);
  if (linkErr) return { success: false, error: linkErr.message };

  await ensureCurrentOccurrences();
  updateTag("subscriptions");
  revalidateFinancialViews();
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

    // A subscription is anchored to its recurring template, not the merchant —
    // one merchant (destinatario) can bill several distinct products, each its
    // own template + subscription (e.g. Google Play: YouTube Premium + One).

    // 1. This template already has a live subscription — keep it active.
    const { data: byTemplate } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("recurring_template_id", template.id)
      .not("status", "in", "(cancelled,dismissed)")
      .maybeSingle();
    if (byTemplate) {
      await supabase
        .from("subscriptions")
        .update({ status: "active" })
        .eq("id", byTemplate.id)
        .eq("user_id", userId);
    } else {
      // 2. Adopt an un-linked detection suggestion for this merchant (if any)
      //    so a detected charge becomes this template's subscription instead of
      //    leaving a duplicate suggestion behind.
      const { data: orphan } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", userId)
        .eq("destinatario_id", template.destinatario_id)
        .is("recurring_template_id", null)
        .not("status", "in", "(cancelled,dismissed)")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (orphan) {
        await supabase
          .from("subscriptions")
          .update({ recurring_template_id: template.id, status: "active" })
          .eq("id", orphan.id)
          .eq("user_id", userId);
      } else {
        // 3. Fresh subscription row for this template.
        const { error: insertErr } = await supabase.from("subscriptions").insert({
          user_id: userId,
          destinatario_id: template.destinatario_id,
          recurring_template_id: template.id,
          status: "active",
          currency_code: template.currency_code,
        });
        // 23505 = a concurrent write already created the live row for this
        // template — benign, the row we wanted exists.
        if (insertErr && insertErr.code !== "23505") {
          console.error(
            "[upsertSubscriptionFromTemplate] insert failed",
            insertErr.message,
          );
        }
      }
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
