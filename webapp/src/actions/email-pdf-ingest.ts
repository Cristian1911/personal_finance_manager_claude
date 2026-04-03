"use server";

import { revalidateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { parsePdfBuffer } from "@/lib/email-ingest/pdf-handler";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/types/actions";
import type { Json } from "@/types/database";

// ── Types ────────────────────────────────────────────────────────────────────

export type PendingEmailStatement = {
  id: string;
  user_id: string;
  email_ingest_id: string;
  from_address: string;
  subject: string | null;
  original_filename: string | null;
  storage_path: string;
  file_size_bytes: number | null;
  status: string;
  error_message: string | null;
  parsed_data: unknown;
  idempotency_hash: string;
  parsed_at: string | null;
  imported_at: string | null;
  created_at: string;
  updated_at: string;
};

// ── Read actions ─────────────────────────────────────────────────────────────

export async function getPendingEmailStatements(): Promise<
  ActionResult<PendingEmailStatement[]>
> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("pending_email_statements")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["pending", "parsing", "parsed", "needs_password", "parse_failed"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as unknown as PendingEmailStatement[] };
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

  // Get storage path before dismissing
  const { data: row } = await supabase
    .from("pending_email_statements")
    .select("storage_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  const { error } = await supabase
    .from("pending_email_statements")
    .update({ status: "dismissed", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  // Clean up stored PDF
  if (row?.storage_path) {
    const admin = createAdminClient();
    await admin.storage.from("email-pdfs").remove([row.storage_path]);
  }

  revalidateTag("email-ingest", "zeta");
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

  revalidateTag("email-ingest", "zeta");
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

  const { error } = await supabase
    .from("pending_email_statements")
    .update({
      status: "imported",
      imported_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  // Clean up stored PDF
  const admin = createAdminClient();
  const { data: row } = await supabase
    .from("pending_email_statements")
    .select("storage_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (row?.storage_path) {
    await admin.storage.from("email-pdfs").remove([row.storage_path]);
  }

  revalidateTag("email-ingest", "zeta");
  return { success: true, data: null };
}
