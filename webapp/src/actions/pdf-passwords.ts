"use server";

import { cacheTag, cacheLife, updateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import {
  pdfPasswordSchema,
  pdfPasswordUpdateSchema,
} from "@/lib/validators/pdf-password";
import { uuidStr } from "@/lib/validators/shared";
import type { ActionResult } from "@/types/actions";
import type { Database } from "@/types/database";

type PdfPasswordRow = Database["public"]["Tables"]["pdf_passwords"]["Row"];

export type PdfPasswordEntry = {
  id: string;
  alias: string;
  scope: "global" | "bank" | "account";
  bank_key: string | null;
  account_id: string | null;
  account_name?: string | null;
  has_password: boolean;
  updated_at: string;
};

export async function listPdfPasswordsCached(
  accessToken: string,
  userId: string
): Promise<PdfPasswordEntry[]> {
  "use cache";
  cacheTag("pdf-passwords");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const { data, error } = await supabase
    .from("pdf_passwords")
    .select(
      "id, alias, scope, bank_key, account_id, updated_at, accounts!pdf_passwords_enc_account_id_fkey(name)"
    )
    .eq("user_id", userId)
    .order("alias");

  if (error) {
    console.error("[pdf-passwords] list error:", error);
    return [];
  }

  return (data ?? []).map((row) => {
    const account = (row as { accounts?: { name: string | null } | null })
      .accounts;
    return {
      id: row.id,
      alias: row.alias,
      scope: row.scope as "global" | "bank" | "account",
      bank_key: row.bank_key,
      account_id: row.account_id,
      account_name: account?.name ?? null,
      has_password: true,
      updated_at: row.updated_at,
    };
  });
}

export async function listPdfPasswords(): Promise<PdfPasswordEntry[]> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return [];
  return listPdfPasswordsCached(accessToken, user.id);
}

export type PdfPasswordSuggestion = {
  id: string;
  alias: string;
  password: string;
  scope: "global" | "bank" | "account";
  bank_key: string | null;
  account_id: string | null;
};

export async function suggestPdfPasswordsForAccount(
  accountId: string | null,
  bankKey: string | null
): Promise<PdfPasswordSuggestion[]> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return [];

  const { data, error } = await supabase
    .from("pdf_passwords")
    .select("id, alias, password, scope, bank_key, account_id")
    .eq("user_id", user.id);

  if (error || !data) return [];

  const noContext = !accountId && !bankKey;
  const scored = data
    .map((row) => {
      let score = 0;
      if (row.scope === "account" && accountId && row.account_id === accountId)
        score = 3;
      else if (row.scope === "bank" && bankKey && row.bank_key === bankKey)
        score = 2;
      else if (row.scope === "global") score = 1;
      else if (noContext) score = 0.5;
      return { row, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.row.alias.localeCompare(b.row.alias));

  return scored.map(({ row }) => ({
    id: row.id,
    alias: row.alias,
    password: row.password,
    scope: row.scope as "global" | "bank" | "account",
    bank_key: row.bank_key,
    account_id: row.account_id,
  }));
}

export async function createPdfPassword(
  _prevState: ActionResult<PdfPasswordRow>,
  formData: FormData
): Promise<ActionResult<PdfPasswordRow>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = pdfPasswordSchema.safeParse({
    alias: formData.get("alias"),
    password: formData.get("password"),
    scope: formData.get("scope"),
    bank_key: formData.get("bank_key") || undefined,
    account_id: formData.get("account_id") || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { data, error } = await supabase
    .from("pdf_passwords")
    .insert({
      user_id: user.id,
      alias: parsed.data.alias,
      password: parsed.data.password,
      scope: parsed.data.scope,
      bank_key: parsed.data.bank_key,
      account_id: parsed.data.account_id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Ya existe una contraseña con ese alias o alcance." };
    }
    return { success: false, error: error.message };
  }

  if (parsed.data.scope === "account" && parsed.data.account_id) {
    await supabase
      .from("accounts")
      .update({ pdf_password: parsed.data.password })
      .eq("id", parsed.data.account_id)
      .eq("user_id", user.id);
    updateTag("accounts");
  }

  updateTag("pdf-passwords");
  return { success: true, data };
}

export async function updatePdfPassword(
  _prevState: ActionResult<PdfPasswordRow>,
  formData: FormData
): Promise<ActionResult<PdfPasswordRow>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = pdfPasswordUpdateSchema.safeParse({
    id: formData.get("id"),
    alias: formData.get("alias") || undefined,
    password: formData.get("password") || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const patch: Database["public"]["Tables"]["pdf_passwords"]["Update"] = {
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.alias) patch.alias = parsed.data.alias;
  if (parsed.data.password) patch.password = parsed.data.password;

  const { data, error } = await supabase
    .from("pdf_passwords")
    .update(patch)
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Ya existe una contraseña con ese alias." };
    }
    return { success: false, error: error.message };
  }

  if (parsed.data.password && data.scope === "account" && data.account_id) {
    await supabase
      .from("accounts")
      .update({ pdf_password: parsed.data.password })
      .eq("id", data.account_id)
      .eq("user_id", user.id);
    updateTag("accounts");
  }

  updateTag("pdf-passwords");
  return { success: true, data };
}

export async function deletePdfPassword(
  _prevState: ActionResult<{ id: string }>,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsedId = uuidStr().safeParse(formData.get("id"));
  if (!parsedId.success) {
    return { success: false, error: "ID inválido" };
  }

  const { error } = await supabase
    .from("pdf_passwords")
    .delete()
    .eq("id", parsedId.data)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  updateTag("pdf-passwords");
  return { success: true, data: { id: parsedId.data } };
}
