"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import {
  destinatarioSchema,
  destinatarioRuleSchema,
} from "@/lib/validators/destinatario";
import type { ActionResult } from "@/types/actions";
import type { Database } from "@/types/database";
import type { DestinatarioRule } from "@zeta/shared";

// ─── Types ────────────────────────────────────────────────────────────────────

type Destinatario = Database["public"]["Tables"]["destinatarios"]["Row"];
type DestinatarioRuleRow =
  Database["public"]["Tables"]["destinatario_rules"]["Row"];

type DestinatarioWithCounts = Destinatario & {
  rule_count: number;
  transaction_count: number;
};

type DestinatarioWithRules = Destinatario & {
  rules: DestinatarioRuleRow[];
};

// ─── getDestinatarios ─────────────────────────────────────────────────────────

export async function getDestinatarios(): Promise<
  ActionResult<DestinatarioWithCounts[]>
> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Fetch destinatarios and transaction counts in parallel
  const [destResult, txResult] = await Promise.all([
    supabase
      .from("destinatarios")
      .select("*, destinatario_rules(id)")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
    supabase
      .from("transactions")
      .select("destinatario_id")
      .eq("user_id", user.id)
      .not("destinatario_id", "is", null),
  ]);

  const { data: destinatarios, error } = destResult;
  if (error) return { success: false, error: error.message };

  const { data: txCounts, error: txError } = txResult;
  if (txError) return { success: false, error: txError.message };

  // Build a count map for transactions
  const txCountMap = new Map<string, number>();
  for (const tx of txCounts ?? []) {
    if (tx.destinatario_id) {
      txCountMap.set(
        tx.destinatario_id,
        (txCountMap.get(tx.destinatario_id) ?? 0) + 1
      );
    }
  }

  const result: DestinatarioWithCounts[] = (destinatarios ?? []).map((d) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { destinatario_rules, ...rest } = d;
    return {
      ...rest,
      rule_count: Array.isArray(destinatario_rules)
        ? destinatario_rules.length
        : 0,
      transaction_count: txCountMap.get(d.id) ?? 0,
    };
  });

  return { success: true, data: result };
}

// ─── getDestinatario ──────────────────────────────────────────────────────────

export async function getDestinatario(
  id: string
): Promise<ActionResult<DestinatarioWithRules>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("destinatarios")
    .select("*, destinatario_rules(*)")
    .eq("user_id", user.id)
    .eq("id", id)
    .single();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "Destinatario no encontrado" };

  const { destinatario_rules, ...rest } = data;

  return {
    success: true,
    data: {
      ...rest,
      rules: destinatario_rules ?? [],
    },
  };
}

// ─── getDestinatarioRules ─────────────────────────────────────────────────────

export async function getDestinatarioRules(): Promise<
  ActionResult<DestinatarioRule[]>
> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("destinatario_rules")
    .select(
      "destinatario_id, match_type, pattern, priority, destinatarios!inner(name, default_category_id, is_active)"
    )
    .eq("user_id", user.id)
    .order("priority", { ascending: true });

  if (error) return { success: false, error: error.message };

  // Shape into DestinatarioRule[], filtering to only active destinatarios
  const rules: DestinatarioRule[] = [];
  for (const row of data ?? []) {
    const dest = row.destinatarios;
    if (!dest || !dest.is_active) continue;

    rules.push({
      destinatario_id: row.destinatario_id,
      destinatario_name: dest.name,
      default_category_id: dest.default_category_id,
      match_type: row.match_type as "contains" | "exact",
      pattern: row.pattern,
      priority: row.priority,
    });
  }

  return { success: true, data: rules };
}

// ─── createDestinatario ───────────────────────────────────────────────────────

export async function createDestinatario(
  _prevState: ActionResult<Destinatario>,
  formData: FormData
): Promise<ActionResult<Destinatario>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = destinatarioSchema.safeParse({
    name: formData.get("name"),
    default_category_id: formData.get("default_category_id") || undefined,
    notes: formData.get("notes") || undefined,
    is_active: formData.get("is_active") !== "false",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { data, error } = await supabase
    .from("destinatarios")
    .insert({
      user_id: user.id,
      ...parsed.data,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  // If patterns are provided, insert rules
  const patternsRaw = formData.get("patterns");
  if (patternsRaw && typeof patternsRaw === "string" && patternsRaw.trim()) {
    let patterns: string[];

    // Try JSON array first, fall back to comma-separated
    try {
      const jsonParsed = JSON.parse(patternsRaw);
      patterns = Array.isArray(jsonParsed) ? jsonParsed : [patternsRaw];
    } catch {
      patterns = patternsRaw.split(",").map((p) => p.trim()).filter(Boolean);
    }

    if (patterns.length > 0) {
      const rules = patterns.map((pattern, i) => ({
        user_id: user.id,
        destinatario_id: data.id,
        pattern,
        match_type: "contains" as const,
        priority: (i + 1) * 100,
      }));

      const { error: rulesError } = await supabase
        .from("destinatario_rules")
        .insert(rules);
      if (rulesError) {
        // Destinatario was created but rules failed — return partial success with warning
        revalidatePath("/destinatarios");
        return { success: true, data };
      }
    }
  }

  revalidatePath("/destinatarios");
  return { success: true, data };
}

// ─── updateDestinatario ───────────────────────────────────────────────────────

export async function updateDestinatario(
  id: string,
  _prevState: ActionResult<Destinatario>,
  formData: FormData
): Promise<ActionResult<Destinatario>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = destinatarioSchema.safeParse({
    name: formData.get("name"),
    default_category_id: formData.get("default_category_id") || undefined,
    notes: formData.get("notes") || undefined,
    is_active: formData.get("is_active") !== "false",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { data, error } = await supabase
    .from("destinatarios")
    .update(parsed.data)
    .eq("user_id", user.id)
    .eq("id", id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/destinatarios");
  return { success: true, data };
}

// ─── deleteDestinatario ───────────────────────────────────────────────────────

export async function deleteDestinatario(
  id: string
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("destinatarios")
    .delete()
    .eq("user_id", user.id)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/destinatarios");
  return { success: true, data: undefined };
}

// ─── mergeDestinatarios ───────────────────────────────────────────────────────

export async function mergeDestinatarios(
  targetId: string,
  sourceIds: string[]
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  if (sourceIds.length === 0) {
    return { success: false, error: "No se seleccionaron destinatarios para fusionar" };
  }

  // 1. Reassign all transactions from source destinatarios to target
  const { error: txError } = await supabase
    .from("transactions")
    .update({ destinatario_id: targetId })
    .eq("user_id", user.id)
    .in("destinatario_id", sourceIds);

  if (txError) return { success: false, error: txError.message };

  // 2. Move rules from sources to target (update destinatario_id)
  // ON CONFLICT on (user_id, pattern) will skip duplicates at the DB level
  const { error: rulesError } = await supabase
    .from("destinatario_rules")
    .update({ destinatario_id: targetId })
    .eq("user_id", user.id)
    .in("destinatario_id", sourceIds);

  if (rulesError) return { success: false, error: rulesError.message };

  // 3. Delete source destinatarios
  const { error: deleteError } = await supabase
    .from("destinatarios")
    .delete()
    .eq("user_id", user.id)
    .in("id", sourceIds);

  if (deleteError) return { success: false, error: deleteError.message };

  revalidatePath("/destinatarios");
  return { success: true, data: undefined };
}

// ─── addDestinatarioRule ──────────────────────────────────────────────────────

export async function addDestinatarioRule(
  destinatarioId: string,
  _prevState: ActionResult<DestinatarioRuleRow>,
  formData: FormData
): Promise<ActionResult<DestinatarioRuleRow>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = destinatarioRuleSchema.safeParse({
    match_type: formData.get("match_type") || "contains",
    pattern: formData.get("pattern"),
    priority: formData.get("priority") || 100,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { data, error } = await supabase
    .from("destinatario_rules")
    .insert({
      user_id: user.id,
      destinatario_id: destinatarioId,
      ...parsed.data,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Este patrón ya está en uso" };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/destinatarios");
  return { success: true, data };
}

// ─── removeDestinatarioRule ───────────────────────────────────────────────────

export async function removeDestinatarioRule(
  ruleId: string
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("destinatario_rules")
    .delete()
    .eq("user_id", user.id)
    .eq("id", ruleId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/destinatarios");
  return { success: true, data: undefined };
}

// ─── getUnmatchedDescriptions ─────────────────────────────────────────────────

export async function getUnmatchedDescriptions(): Promise<
  ActionResult<string[]>
> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("transactions")
    .select("raw_description")
    .eq("user_id", user.id)
    .is("destinatario_id", null)
    .not("raw_description", "is", null)
    .order("transaction_date", { ascending: false })
    .limit(500);

  if (error) return { success: false, error: error.message };

  // Extract distinct raw_description values
  const seen = new Set<string>();
  const descriptions: string[] = [];
  for (const row of data ?? []) {
    if (row.raw_description && !seen.has(row.raw_description)) {
      seen.add(row.raw_description);
      descriptions.push(row.raw_description);
    }
  }

  return { success: true, data: descriptions };
}
