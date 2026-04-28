"use server";

import { cacheLife, cacheTag, updateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { parsePdfBuffer } from "@/lib/email-ingest/pdf-handler";
import { parseStatementFilename, matchAccountByLast4 } from "@/lib/email-ingest/statement-filename";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/types/actions";
import type { PendingEmailStatement } from "@/types/domain";
import type { Json } from "@/types/database";

// ── Read actions ─────────────────────────────────────────────────────────────

async function getPendingEmailStatementsCached(
  userId: string,
  accessToken: string,
): Promise<PendingEmailStatement[]> {
  "use cache";
  cacheTag("email-ingest");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const { data, error } = await supabase
    .from("pending_email_statements")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["pending", "parsing", "parsed", "needs_password", "parse_failed"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []) as unknown as PendingEmailStatement[];
}

export async function getPendingEmailStatements(): Promise<
  ActionResult<PendingEmailStatement[]>
> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };

  try {
    const data = await getPendingEmailStatementsCached(user.id, accessToken);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function getPendingEmailStatementCount(): Promise<ActionResult<number>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { count, error } = await supabase
    .from("pending_email_statements")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("status", ["parsed", "needs_password"]);

  if (error) return { success: false, error: error.message };
  return { success: true, data: count ?? 0 };
}

// ── Mutation actions ─────────────────────────────────────────────────────────

export async function dismissEmailPdfStatement(
  id: string,
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: row, error } = await supabase
    .from("pending_email_statements")
    .update({ status: "dismissed", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("storage_path")
    .single();

  if (error) return { success: false, error: error.message };

  // Clean up stored PDF
  if (row?.storage_path) {
    const admin = createAdminClient();
    await admin.storage.from("email-pdfs").remove([row.storage_path]);
  }

  updateTag("email-ingest");
  return { success: true, data: null };
}

export async function retryPdfParsing(
  id: string,
  password: string,
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Fetch the pending row
  const { data: row, error: fetchError } = await supabase
    .from("pending_email_statements")
    .select("storage_path, original_filename, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError) return { success: false, error: fetchError.message };
  if (!row) return { success: false, error: "Extracto no encontrado" };
  if (row.status !== "needs_password" && row.status !== "parse_failed") {
    return { success: false, error: "Este extracto no necesita reintento" };
  }

  // Download PDF from storage
  const admin = createAdminClient();
  const { data: fileData, error: downloadError } = await admin.storage
    .from("email-pdfs")
    .download(row.storage_path);

  if (downloadError || !fileData) {
    return { success: false, error: "No se pudo descargar el PDF" };
  }

  // Mark as parsing
  await supabase
    .from("pending_email_statements")
    .update({ status: "parsing", error_message: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  // Re-parse with password
  const buffer = await fileData.arrayBuffer();
  const result = await parsePdfBuffer({
    buffer,
    filename: row.original_filename ?? "statement.pdf",
    password,
  });

  if (result.success) {
    await supabase
      .from("pending_email_statements")
      .update({
        status: "parsed",
        parsed_data: result.statements as unknown as Json,
        error_message: null,
        parsed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id);

    // Save password on matched account for future auto-parsing
    const filenameInfo = parseStatementFilename(row.original_filename ?? "");
    if (filenameInfo) {
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, mask, pdf_password")
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (accounts) {
        const match = matchAccountByLast4(accounts, filenameInfo.last4);
        if (match) {
          await supabase
            .from("accounts")
            .update({ pdf_password: password })
            .eq("id", match.accountId)
            .eq("user_id", user.id);
        }
      }
    }
  } else {
    await supabase
      .from("pending_email_statements")
      .update({
        status: result.needsPassword ? "needs_password" : "parse_failed",
        error_message: result.error,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id);

    return { success: false, error: result.error };
  }

  updateTag("email-ingest");
  return { success: true, data: null };
}

/**
 * Mark a pending email statement as imported (called after the user completes
 * the import wizard flow using the existing importTransactions action).
 */
export async function markEmailPdfStatementImported(
  id: string,
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: row, error } = await supabase
    .from("pending_email_statements")
    .update({
      status: "imported",
      imported_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("storage_path")
    .single();

  if (error) return { success: false, error: error.message };

  // Clean up stored PDF
  const admin = createAdminClient();

  if (row?.storage_path) {
    await admin.storage.from("email-pdfs").remove([row.storage_path]);
  }

  // Note: `importTransactions` (the caller's preceding step) already fired
  // `revalidateFinancialViews()`. Only the email-ingest tag needs re-evicting
  // here for the status flip; doing it again would be redundant work.
  updateTag("email-ingest");
  return { success: true, data: null };
}
