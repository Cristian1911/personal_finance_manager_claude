"use server";

import { cacheTag, cacheLife, updateTag } from "next/cache";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import {
  destinatarioSchema,
  destinatarioRuleSchema,
} from "@/lib/validators/destinatario";
import { uuidStr } from "@/lib/validators/shared";
import type { ActionResult } from "@/types/actions";
import type { Database } from "@/types/database";
import {
  cleanDescription,
  matchDestinatario,
  prepareDestinatarioRules,
  type DestinatarioRule,
} from "@zeta/shared";

// ─── Types ────────────────────────────────────────────────────────────────────

type Destinatario = Database["public"]["Tables"]["destinatarios"]["Row"];
type DestinatarioRuleRow =
  Database["public"]["Tables"]["destinatario_rules"]["Row"];

type DestinatarioWithCounts = Destinatario & {
  rule_count: number;
  transaction_count: number;
};

export type DestinatarioWithRules = Destinatario & {
  rules: DestinatarioRuleRow[];
};

export type TransactionPreview = {
  id: string;
  transaction_date: string;
  clean_description: string | null;
  raw_description: string | null;
  amount: number;
  direction: Database["public"]["Enums"]["transaction_direction"];
  currency_code: Database["public"]["Enums"]["currency_code"];
  category_name: string | null;
  category_icon: string | null;
  account_name: string;
};

// ─── testDestinatarioPattern ──────────────────────────────────────────────────

export interface PatternTestResult {
  matchCount: number;
  samples: { id: string; rawDescription: string; date: string; amount: number; currencyCode: string }[];
}

export async function testDestinatarioPattern(
  pattern: string,
  matchType: "contains" | "exact"
): Promise<ActionResult<PatternTestResult>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Use server-side filtering via ilike instead of fetching 1000 rows
  const ilikePattern = matchType === "exact" ? pattern : `%${pattern}%`;

  // Count query (exact total) + sample query (5 rows) in parallel
  const [countResult, samplesResult] = await Promise.all([
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("destinatario_id", null)
      .not("raw_description", "is", null)
      .ilike("raw_description", ilikePattern),
    supabase
      .from("transactions")
      .select("id, raw_description, transaction_date, amount, currency_code")
      .eq("user_id", user.id)
      .is("destinatario_id", null)
      .not("raw_description", "is", null)
      .ilike("raw_description", ilikePattern)
      .order("transaction_date", { ascending: false })
      .limit(5),
  ]);

  if (countResult.error) return { success: false, error: countResult.error.message };
  if (samplesResult.error) return { success: false, error: samplesResult.error.message };

  return {
    success: true,
    data: {
      matchCount: countResult.count ?? 0,
      samples: (samplesResult.data ?? []).map((tx) => ({
        id: tx.id,
        rawDescription: tx.raw_description!,
        date: tx.transaction_date,
        amount: tx.amount,
        currencyCode: tx.currency_code,
      })),
    },
  };
}

// ─── Reads ───────────────────────────────────────────────────────────────────
// NOTE: These use the authenticated client (not admin) because the destinatarios
// and transactions views decrypt PII via zeta_decrypt(auth.uid()). The admin
// client has no JWT so encrypted columns would return NULL.

export async function fetchDestinatarioRules(
  supabase: import("@supabase/supabase-js").SupabaseClient<import("@/types/database").Database>,
  userId: string
): Promise<DestinatarioRule[]> {
  const { data, error } = await supabase
    .from("destinatario_rules")
    .select(
      "destinatario_id, match_type, pattern, priority, destinatarios!inner(name, default_category_id, is_active)"
    )
    .eq("user_id", userId)
    .order("priority", { ascending: true });

  if (error) throw error;

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

  return rules;
}

async function getRecentDestinatariosCached(
  userId: string,
  accessToken: string,
  limit: number
): Promise<Array<{ id: string; name: string }>> {
  "use cache";
  cacheTag("destinatarios");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const { data } = await supabase
    .from("transactions")
    .select("destinatario_id, destinatarios!transactions_destinatario_id_fkey(id, name)")
    .eq("user_id", userId)
    .not("destinatario_id", "is", null)
    .order("transaction_date", { ascending: false })
    .limit(50);

  if (!data) return [];

  const seen = new Set<string>();
  const result: Array<{ id: string; name: string }> = [];
  for (const row of data) {
    const dest = row.destinatarios as unknown as { id: string; name: string } | null;
    if (!dest || seen.has(dest.id)) continue;
    seen.add(dest.id);
    result.push({ id: dest.id, name: dest.name });
    if (result.length >= limit) break;
  }
  return result;
}

export async function getRecentDestinatarios(
  limit = 3
): Promise<Array<{ id: string; name: string }>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return [];
  return getRecentDestinatariosCached(user.id, accessToken, limit);
}

/**
 * Shared pipeline: fetch user's destinatario rules, match text against them.
 * Used by all transaction creation flows before falling back to autoCategorize().
 */
export async function matchTransactionToDestinatario(
  userId: string,
  text: string,
  supabaseClient?: import("@supabase/supabase-js").SupabaseClient<import("@/types/database").Database>,
): Promise<{ destinatario_id: string; category_id: string | null } | null> {
  const client = supabaseClient ?? (await getAuthenticatedClient()).supabase;
  const rules = await fetchDestinatarioRules(client, userId);
  if (rules.length === 0) return null;

  const prepared = prepareDestinatarioRules(rules);
  const match = matchDestinatario(text, prepared);
  if (!match) return null;

  return {
    destinatario_id: match.destinatario_id,
    category_id: match.category_id ?? null,
  };
}

// ─── getDestinatarios ─────────────────────────────────────────────────────────

async function getDestinatariosCached(
  userId: string,
  accessToken: string
): Promise<DestinatarioWithCounts[]> {
  "use cache";
  cacheTag("destinatarios");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const { data: destinatarios, error } = await supabase
    .from("destinatarios")
    .select("*, destinatario_rules!destinatario_rules_destinatario_id_fkey(count), transactions!transactions_destinatario_id_fkey(count)")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (error) throw error;
  return (destinatarios ?? []).map((d) => {
    const { destinatario_rules, transactions, ...rest } = d;
    return {
      ...rest,
      rule_count: (destinatario_rules as unknown as { count: number }[])?.[0]
        ?.count ?? 0,
      transaction_count: (transactions as unknown as { count: number }[])?.[0]
        ?.count ?? 0,
    };
  });
}

export async function getDestinatarios(): Promise<
  ActionResult<DestinatarioWithCounts[]>
> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    const data = await getDestinatariosCached(user.id, accessToken);
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al cargar los destinatarios";
    return { success: false, error: message };
  }
}

// ─── getDestinatariosWithSpend ────────────────────────────────────────────────

export async function getDestinatariosWithSpend(): Promise<
  ActionResult<(DestinatarioWithCounts & { avg_monthly_spend: number })[]>
> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Get 3-month spend per destinatario
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const since = threeMonthsAgo.toISOString().split("T")[0];

  // Run both queries in parallel
  const [baseResult, { data: spendData }] = await Promise.all([
    getDestinatarios(),
    supabase
      .from("transactions")
      .select("destinatario_id, amount")
      .eq("user_id", user.id)
      .eq("direction", "OUTFLOW")
      .eq("is_excluded", false)
      .is("reconciled_into_transaction_id", null)
      .gte("transaction_date", since)
      .not("destinatario_id", "is", null),
  ]);

  if (!baseResult.success) return baseResult as ActionResult<never>;

  const spendMap = new Map<string, number>();
  for (const tx of spendData ?? []) {
    if (!tx.destinatario_id) continue;
    spendMap.set(
      tx.destinatario_id,
      (spendMap.get(tx.destinatario_id) ?? 0) + tx.amount,
    );
  }

  const enriched = baseResult.data.map((d) => ({
    ...d,
    avg_monthly_spend: Math.round((spendMap.get(d.id) ?? 0) / 3),
  }));

  return { success: true, data: enriched };
}

// ─── getDestinatario ──────────────────────────────────────────────────────────

async function getDestinatarioCached(
  userId: string,
  id: string,
  accessToken: string
): Promise<DestinatarioWithRules> {
  "use cache";
  cacheTag("destinatarios");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const { data, error } = await supabase
    .from("destinatarios")
    .select("*, destinatario_rules!destinatario_rules_destinatario_id_fkey(*)")
    .eq("user_id", userId)
    .eq("id", id)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Destinatario no encontrado");
  const { destinatario_rules, ...rest } = data;
  return { ...rest, rules: destinatario_rules ?? [] };
}

export async function getDestinatario(
  id: string
): Promise<ActionResult<DestinatarioWithRules>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    const data = await getDestinatarioCached(user.id, id, accessToken);
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Destinatario no encontrado";
    return { success: false, error: message };
  }
}

// ─── getDestinatarioRules ─────────────────────────────────────────────────────

export async function getDestinatarioRules(): Promise<
  ActionResult<DestinatarioRule[]>
> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  try {
    const data = await fetchDestinatarioRules(supabase, user.id);
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al cargar las reglas";
    return { success: false, error: message };
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function parsePatternsList(raw: FormDataEntryValue | null): string[] {
  if (!raw || typeof raw !== "string" || !raw.trim()) return [];

  let patterns: string[] = [];
  try {
    const parsed = JSON.parse(raw);
    patterns = Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [raw];
  } catch {
    patterns = raw.split(",");
  }

  const seen = new Set<string>();
  return patterns
    .map((pattern) => pattern.trim())
    .filter((pattern) => {
      if (!pattern) return false;
      const key = pattern.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

// ─── createDestinatario ───────────────────────────────────────────────────────

export type CreateDestinatarioResult = Destinatario & { linked_count?: number };

export async function createDestinatario(
  _prevState: ActionResult<CreateDestinatarioResult>,
  formData: FormData
): Promise<ActionResult<CreateDestinatarioResult>> {
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

  // Parse patterns once — reused for rules insertion and transaction linking
  const patternsRaw = formData.get("patterns");
  const patterns = parsePatternsList(patternsRaw);

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
      updateTag("destinatarios");
      updateTag("attention");
      return { success: true, data: { ...data, linked_count: 0 } };
    }
  }

  // Link matching transactions if requested (from suggestions flow)
  let linkedCount = 0;
  const shouldLink = formData.get("link_matching_transactions") === "true";
  if (shouldLink && patterns.length > 0) {
    const lowerPatterns = patterns.map((pattern) => pattern.toLowerCase());
    const { data: unmatchedTxs, error: unmatchedTxsError } = await supabase
      .from("transactions")
      .select("id, raw_description, category_id")
      .eq("user_id", user.id)
      .is("destinatario_id", null)
      .not("raw_description", "is", null)
      .eq("is_excluded", false)
      .is("reconciled_into_transaction_id", null)
      .limit(2000);

    if (unmatchedTxsError) {
      console.error(
        "Error fetching unmatched transactions for destinatario linking:",
        unmatchedTxsError
      );
    } else if (unmatchedTxs && unmatchedTxs.length > 0) {
      const matchingIds: string[] = [];
      const uncategorizedIds: string[] = [];

      for (const tx of unmatchedTxs) {
        const cleaned = cleanDescription(tx.raw_description ?? "").toLowerCase();
        const raw = (tx.raw_description ?? "").toLowerCase();

        if (
          lowerPatterns.some(
            (pattern) => cleaned.includes(pattern) || raw.includes(pattern)
          )
        ) {
          matchingIds.push(tx.id);
          if (!tx.category_id) uncategorizedIds.push(tx.id);
        }
      }

      if (matchingIds.length > 0) {
        await supabase
          .from("transactions")
          .update({
            destinatario_id: data.id,
            merchant_name: data.name,
          })
          .eq("user_id", user.id)
          .in("id", matchingIds);

        if (parsed.data.default_category_id && uncategorizedIds.length > 0) {
          await supabase
            .from("transactions")
            .update({
              category_id: parsed.data.default_category_id,
              categorization_source: "USER_LEARNED",
            })
            .eq("user_id", user.id)
            .in("id", uncategorizedIds);
        }

        linkedCount = matchingIds.length;
      }
    }

    revalidateFinancialViews();
  }

  updateTag("destinatarios");
  updateTag("attention");
  return { success: true, data: { ...data, linked_count: linkedCount } };
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

  updateTag("destinatarios");
  updateTag("attention");
  return { success: true, data };
}

// ─── patchDestinatario (lightweight inline update) ───────────────────────────

export async function patchDestinatario(
  id: string,
  patch: { default_category_id?: string | null; is_active?: boolean },
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("destinatarios")
    .update(patch)
    .eq("user_id", user.id)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  updateTag("destinatarios");
  updateTag("attention");
  return { success: true, data: null };
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

  updateTag("destinatarios");
  updateTag("attention");
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

  revalidateFinancialViews();
  updateTag("destinatarios");
  return { success: true, data: undefined };
}

// ─── addDestinatarioRule ──────────────────────────────────────────────────────

export type AddRuleResult = ActionResult<DestinatarioRuleRow> & {
  conflicts?: { pattern: string; destinatarioId: string }[];
};

export async function addDestinatarioRule(
  destinatarioId: string,
  _prevState: AddRuleResult,
  formData: FormData
): Promise<AddRuleResult> {
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

  // Check for conflicting patterns
  const { data: existingRules } = await supabase
    .from("destinatario_rules")
    .select("pattern, destinatario_id")
    .eq("user_id", user.id);

  const newPatternLower = parsed.data.pattern.toLowerCase();
  const conflicts: { pattern: string; destinatarioId: string }[] = [];
  for (const rule of existingRules ?? []) {
    const existingLower = rule.pattern.toLowerCase();
    if (existingLower.includes(newPatternLower) || newPatternLower.includes(existingLower)) {
      conflicts.push({ pattern: rule.pattern, destinatarioId: rule.destinatario_id });
    }
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

  updateTag("destinatarios");
  updateTag("attention");
  return { success: true, data, conflicts };
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

  updateTag("destinatarios");
  updateTag("attention");
  return { success: true, data: undefined };
}

// ─── getUnmatchedDescriptions ─────────────────────────────────────────────────

async function getUnmatchedDescriptionsCached(
  userId: string,
  accessToken: string,
): Promise<string[]> {
  "use cache";
  cacheTag("destinatarios");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const { data, error } = await supabase
    .from("transactions")
    .select("raw_description")
    .eq("user_id", userId)
    .is("destinatario_id", null)
    .not("raw_description", "is", null)
    .order("transaction_date", { ascending: false })
    .limit(500);

  if (error) throw error;

  const seen = new Set<string>();
  const descriptions: string[] = [];
  for (const row of data ?? []) {
    if (row.raw_description && !seen.has(row.raw_description)) {
      seen.add(row.raw_description);
      descriptions.push(row.raw_description);
    }
  }
  return descriptions;
}

export async function getUnmatchedDescriptions(): Promise<
  ActionResult<string[]>
> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    const data = await getUnmatchedDescriptionsCached(user.id, accessToken);
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al cargar las descripciones";
    return { success: false, error: message };
  }
}

// ─── getDestinatarioSuggestions ──────────────────────────────────────────────

export type DestinatarioSuggestionResult = {
  cleanedPattern: string;
  count: number;
  dateRange: { from: string; to: string };
  sampleTransactions: { date: string; rawDescription: string; amount: number }[];
};

function groupSuggestionsByPrefix(
  suggestions: DestinatarioSuggestionResult[]
): DestinatarioSuggestionResult[] {
  if (suggestions.length <= 1) return suggestions;
  const sorted = [...suggestions].sort((a, b) =>
    a.cleanedPattern.localeCompare(b.cleanedPattern)
  );
  const groups: DestinatarioSuggestionResult[] = [];
  let current = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const tokensA = current.cleanedPattern.split(/\s+/);
    const tokensB = next.cleanedPattern.split(/\s+/);
    const common: string[] = [];
    for (let j = 0; j < Math.min(tokensA.length, tokensB.length); j++) {
      if (tokensA[j] === tokensB[j]) common.push(tokensA[j]);
      else break;
    }
    if (common.length >= 2) {
      current = {
        cleanedPattern: common.join(" "),
        count: current.count + next.count,
        dateRange: {
          from: current.dateRange.from < next.dateRange.from ? current.dateRange.from : next.dateRange.from,
          to: current.dateRange.to > next.dateRange.to ? current.dateRange.to : next.dateRange.to,
        },
        sampleTransactions: [...current.sampleTransactions, ...next.sampleTransactions].slice(0, 5),
      };
    } else {
      groups.push(current);
      current = next;
    }
  }
  groups.push(current);
  groups.sort((a, b) => b.count - a.count);
  return groups;
}

async function getDestinatarioSuggestionsCached(
  userId: string,
  accessToken: string,
): Promise<DestinatarioSuggestionResult[]> {
  "use cache";
  cacheTag("destinatarios");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const { data, error } = await supabase
    .from("transactions")
    .select("transaction_date, raw_description, amount")
    .eq("user_id", userId)
    .is("destinatario_id", null)
    .not("raw_description", "is", null)
    .order("transaction_date", { ascending: false })
    .limit(1000);

  if (error) throw error;

  const groups = new Map<
    string,
    {
      count: number;
      dates: string[];
      samples: { date: string; rawDescription: string; amount: number }[];
    }
  >();

  for (const row of data ?? []) {
    if (!row.raw_description) continue;
    const cleaned = cleanDescription(row.raw_description);
    if (cleaned.length === 0) continue;

    if (!groups.has(cleaned)) {
      groups.set(cleaned, { count: 0, dates: [], samples: [] });
    }
    const group = groups.get(cleaned)!;
    group.count++;
    group.dates.push(row.transaction_date);
    if (group.samples.length < 5) {
      group.samples.push({
        date: row.transaction_date,
        rawDescription: row.raw_description,
        amount: row.amount,
      });
    }
  }

  const suggestions: DestinatarioSuggestionResult[] = [];
  for (const [pattern, group] of groups) {
    if (group.count < 3) continue;
    const sortedDates = group.dates.sort();
    suggestions.push({
      cleanedPattern: pattern,
      count: group.count,
      dateRange: {
        from: sortedDates[0],
        to: sortedDates[sortedDates.length - 1],
      },
      sampleTransactions: group.samples,
    });
  }

  suggestions.sort((a, b) => b.count - a.count);
  return groupSuggestionsByPrefix(suggestions).slice(0, 20);
}

export async function getDestinatarioSuggestions(): Promise<
  ActionResult<DestinatarioSuggestionResult[]>
> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    const data = await getDestinatarioSuggestionsCached(user.id, accessToken);
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al cargar las sugerencias";
    return { success: false, error: message };
  }
}

// ─── getDestinatarioTransactions ──────────────────────────────────────────────

export async function getDestinatarioTransactions(
  destinatarioId: string,
  limit = 10
): Promise<ActionResult<TransactionPreview[]>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, transaction_date, clean_description, raw_description, amount, direction, currency_code, categories!transactions_category_id_fkey(name_es, name, icon), accounts!inner(name)"
    )
    .eq("user_id", user.id)
    .eq("destinatario_id", destinatarioId)
    .order("transaction_date", { ascending: false })
    .limit(limit);

  if (error) return { success: false, error: error.message };

  const result: TransactionPreview[] = (data ?? []).map((tx) => ({
    id: tx.id,
    transaction_date: tx.transaction_date,
    clean_description: tx.clean_description,
    raw_description: tx.raw_description,
    amount: tx.amount,
    direction: tx.direction,
    currency_code: tx.currency_code,
    category_name: tx.categories
      ? (tx.categories as { name_es: string | null; name: string }).name_es ??
        (tx.categories as { name: string }).name
      : null,
    category_icon: tx.categories
      ? (tx.categories as { icon: string }).icon
      : null,
    account_name: (tx.accounts as { name: string }).name,
  }));

  return { success: true, data: result };
}

// ─── getRulesForDestinatario ──────────────────────────────────────────────────

export async function getRulesForDestinatario(
  destinatarioId: string
): Promise<ActionResult<DestinatarioRuleRow[]>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("destinatario_rules")
    .select("*")
    .eq("user_id", user.id)
    .eq("destinatario_id", destinatarioId)
    .order("priority", { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, data: data ?? [] };
}

// ─── findUnlinkedMatches ──────────────────────────────────────────────────────

export type UnlinkedMatch = {
  id: string;
  transaction_date: string;
  raw_description: string;
  clean_description: string | null;
  amount: number;
  direction: Database["public"]["Enums"]["transaction_direction"];
  currency_code: Database["public"]["Enums"]["currency_code"];
  category_id: string | null;
  account_name: string;
};

/**
 * Find unmatched transactions that match a destinatario's rules.
 * Uses the same cleanDescription matching as the suggestion flow.
 */
export async function findUnlinkedMatches(
  destinatarioId: string
): Promise<ActionResult<UnlinkedMatch[]>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: rules } = await supabase
    .from("destinatario_rules")
    .select("pattern, match_type")
    .eq("user_id", user.id)
    .eq("destinatario_id", destinatarioId);

  if (!rules || rules.length === 0) {
    return { success: true, data: [] };
  }

  const { data: txs, error } = await supabase
    .from("transactions")
    .select(
      "id, transaction_date, raw_description, clean_description, amount, direction, currency_code, category_id, accounts!inner(name)"
    )
    .eq("user_id", user.id)
    .is("destinatario_id", null)
    .not("raw_description", "is", null)
    .eq("is_excluded", false)
    .is("reconciled_into_transaction_id", null)
    .order("transaction_date", { ascending: false })
    .limit(2000);

  if (error) return { success: false, error: error.message };
  if (!txs || txs.length === 0) return { success: true, data: [] };

  const matches: UnlinkedMatch[] = [];
  for (const tx of txs) {
    const cleaned = cleanDescription(tx.raw_description ?? "").toLowerCase();
    const raw = (tx.raw_description ?? "").toLowerCase();

    const isMatch = rules.some((rule) => {
      const pattern = rule.pattern.toLowerCase();
      if (rule.match_type === "exact") {
        return cleaned === pattern || raw === pattern;
      }
      return cleaned.includes(pattern) || raw.includes(pattern);
    });

    if (isMatch) {
      matches.push({
        id: tx.id,
        transaction_date: tx.transaction_date,
        raw_description: tx.raw_description!,
        clean_description: tx.clean_description,
        amount: tx.amount,
        direction: tx.direction,
        currency_code: tx.currency_code,
        category_id: tx.category_id,
        account_name: (tx.accounts as { name: string }).name,
      });
    }
  }

  return { success: true, data: matches };
}

// ─── bulkLinkToDestinatario ───────────────────────────────────────────────────

/**
 * Link multiple transactions to a destinatario, optionally applying category.
 */
export async function bulkLinkToDestinatario(
  destinatarioId: string,
  transactionIds: string[]
): Promise<ActionResult<{ linked: number; categorized: number }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  if (transactionIds.length === 0) {
    return { success: true, data: { linked: 0, categorized: 0 } };
  }

  // Fetch destinatario for name and default category
  const { data: dest } = await supabase
    .from("destinatarios")
    .select("name, default_category_id")
    .eq("user_id", user.id)
    .eq("id", destinatarioId)
    .single();

  if (!dest) return { success: false, error: "Destinatario no encontrado" };

  // Link all selected transactions
  const { error: linkError, count: linkedCount } = await supabase
    .from("transactions")
    .update({
      destinatario_id: destinatarioId,
      merchant_name: dest.name,
    }, { count: "exact" })
    .eq("user_id", user.id)
    .in("id", transactionIds);

  if (linkError) return { success: false, error: linkError.message };

  // If destinatario has default category, apply to uncategorized transactions
  let categorized = 0;
  if (dest.default_category_id) {
    const { error: categorizeError, count } = await supabase
      .from("transactions")
      .update({
        category_id: dest.default_category_id,
        categorization_source: "USER_LEARNED",
      }, { count: "exact" })
      .eq("user_id", user.id)
      .in("id", transactionIds)
      .is("category_id", null);

    if (categorizeError) {
      console.error(
        "Error applying default category while linking destinatario:",
        categorizeError
      );
    }

    categorized = count ?? 0;
  }

  revalidateFinancialViews();
  updateTag("destinatarios");
  return { success: true, data: { linked: linkedCount ?? transactionIds.length, categorized } };
}

// ─── Shared rule-matching helper for preview + apply ─────────────────────────

type RuleRow = { pattern: string; match_type: string };

function matchTransactionsAgainstRules<T extends { raw_description: string | null }>(
  transactions: T[],
  rules: RuleRow[]
): T[] {
  const lowerRules = rules.map((r) => ({
    pattern: r.pattern.toLowerCase(),
    matchType: r.match_type as "contains" | "exact",
  }));

  return transactions.filter((tx) => {
    const cleaned = cleanDescription(tx.raw_description ?? "").toLowerCase();
    const raw = (tx.raw_description ?? "").toLowerCase();
    return lowerRules.some((rule) => {
      if (rule.matchType === "exact") return cleaned === rule.pattern || raw === rule.pattern;
      return cleaned.includes(rule.pattern) || raw.includes(rule.pattern);
    });
  });
}

// ─── previewDestinatarioRuleImpact ────────────────────────────────────────────

export type RuleImpactPreview = {
  matchCount: number;
  sampleTransactions: Array<{
    id: string;
    clean_description: string;
    transaction_date: string;
    amount: number;
    currency_code: string;
  }>;
};

/**
 * Preview how many unmatched transactions would be linked by a destinatario's rules.
 * Returns match count and first 10 sample transactions.
 */
export async function previewDestinatarioRuleImpact(
  destinatarioId: string
): Promise<ActionResult<RuleImpactPreview>> {
  if (!uuidStr().safeParse(destinatarioId).success) {
    return { success: false, error: "ID inválido" };
  }

  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Fetch rules + unmatched transactions in parallel
  const [rulesResult, txsResult] = await Promise.all([
    supabase
      .from("destinatario_rules")
      .select("pattern, match_type")
      .eq("user_id", user.id)
      .eq("destinatario_id", destinatarioId),
    supabase
      .from("transactions")
      .select("id, raw_description, clean_description, transaction_date, amount, currency_code")
      .eq("user_id", user.id)
      .is("destinatario_id", null)
      .eq("is_excluded", false)
      .is("reconciled_into_transaction_id", null)
      .not("raw_description", "is", null)
      .limit(2000),
  ]);

  if (rulesResult.error) return { success: false, error: rulesResult.error.message };
  if (txsResult.error) return { success: false, error: txsResult.error.message };

  const rules = rulesResult.data;
  const txs = txsResult.data;

  if (!rules?.length || !txs?.length) {
    return { success: true, data: { matchCount: 0, sampleTransactions: [] } };
  }

  const matching = matchTransactionsAgainstRules(txs, rules);

  return {
    success: true,
    data: {
      matchCount: matching.length,
      sampleTransactions: matching.slice(0, 10).map((tx) => ({
        id: tx.id,
        clean_description: tx.clean_description ?? tx.raw_description ?? "",
        transaction_date: tx.transaction_date,
        amount: tx.amount,
        currency_code: tx.currency_code,
      })),
    },
  };
}

// ─── applyDestinatarioRules ───────────────────────────────────────────────────

/**
 * Apply a destinatario's rules to all unmatched transactions in bulk.
 * Sets destinatario_id + merchant_name on all matches, and applies default
 * category (as USER_LEARNED) to any previously uncategorized matches.
 */
export async function applyDestinatarioRules(
  destinatarioId: string
): Promise<ActionResult<{ linked: number; categorized: number }>> {
  if (!uuidStr().safeParse(destinatarioId).success) {
    return { success: false, error: "ID inválido" };
  }

  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Fetch destinatario + rules in parallel
  const [destResult, rulesResult] = await Promise.all([
    supabase
      .from("destinatarios")
      .select("name, default_category_id")
      .eq("user_id", user.id)
      .eq("id", destinatarioId)
      .single(),
    supabase
      .from("destinatario_rules")
      .select("pattern, match_type")
      .eq("user_id", user.id)
      .eq("destinatario_id", destinatarioId),
  ]);

  if (destResult.error || !destResult.data) {
    return { success: false, error: "Destinatario no encontrado" };
  }
  if (rulesResult.error) return { success: false, error: rulesResult.error.message };

  const dest = destResult.data;
  const rules = rulesResult.data;
  if (!rules?.length) {
    return { success: true, data: { linked: 0, categorized: 0 } };
  }

  // Fetch unmatched transactions (only after confirming rules exist)
  const { data: txs, error: txsError } = await supabase
    .from("transactions")
    .select("id, raw_description, category_id")
    .eq("user_id", user.id)
    .is("destinatario_id", null)
    .eq("is_excluded", false)
    .is("reconciled_into_transaction_id", null)
    .not("raw_description", "is", null)
    .limit(2000);

  if (txsError) return { success: false, error: txsError.message };
  if (!txs?.length) {
    return { success: true, data: { linked: 0, categorized: 0 } };
  }

  const matching = matchTransactionsAgainstRules(txs, rules);
  const matchingIds = matching.map((tx) => tx.id);
  const uncategorizedIds = matching.filter((tx) => !tx.category_id).map((tx) => tx.id);

  if (matchingIds.length === 0) {
    return { success: true, data: { linked: 0, categorized: 0 } };
  }

  // Bulk update: set destinatario_id + merchant_name
  const { error: linkError } = await supabase
    .from("transactions")
    .update({
      destinatario_id: destinatarioId,
      merchant_name: dest.name,
    })
    .eq("user_id", user.id)
    .in("id", matchingIds);

  if (linkError) return { success: false, error: linkError.message };

  // Apply default category to uncategorized matches if available
  let categorized = 0;
  if (dest.default_category_id && uncategorizedIds.length > 0) {
    const { error: catError, count } = await supabase
      .from("transactions")
      .update({
        category_id: dest.default_category_id,
        categorization_source: "USER_LEARNED",
      }, { count: "exact" })
      .eq("user_id", user.id)
      .in("id", uncategorizedIds);

    if (catError) {
      console.error("Error applying default category in applyDestinatarioRules:", catError);
    } else {
      categorized = count ?? 0;
    }
  }

  revalidateFinancialViews();
  updateTag("destinatarios");

  return { success: true, data: { linked: matchingIds.length, categorized } };
}
