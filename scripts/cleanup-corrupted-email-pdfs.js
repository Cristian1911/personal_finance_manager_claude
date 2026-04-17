#!/usr/bin/env node
/**
 * Tech-debt Wave 3 — one-shot cleanup for corrupted pending_email_statements.
 *
 * Before commit 92555b4 (2026-04-17 01:54:49 UTC) the email-ingest webhook
 * uploaded `Buffer.from(...).buffer` to Supabase Storage. Node's Buffer pool
 * allocator made `.buffer` a reference to a shared 8KB pool, so small PDFs
 * became 8KB of mostly-zero pool garbage. The parser rejects them on the
 * %PDF magic-byte check, and retryPdfParsing() cannot recover because the
 * stored blob is not a PDF.
 *
 * Usage (from repo root):
 *   node scripts/cleanup-corrupted-email-pdfs.js            # dry-run
 *   node scripts/cleanup-corrupted-email-pdfs.js --execute  # apply
 *
 * Env: reads webapp/.env.local for NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY.
 */

const fs = require("node:fs");
const path = require("node:path");

const EXECUTE = process.argv.includes("--execute");
// Cutoff = actual deploy finish of aef4441 (PR #172), not the git author
// timestamp of 92555b4. The VPS deploy pipeline finished at 02:56:11Z per
// GitHub Actions run 24545240603 — emails processed between the author
// commit (01:54Z) and the deploy finish still hit the buggy code path.
// Round up one minute for safety.
const CUTOFF_ISO = "2026-04-17T02:57:00Z";
const CANDIDATE_STATUSES = ["pending", "parsing", "parse_failed", "needs_password"];
const ERROR_MESSAGE = "Archivo corrupto — vuelve a reenviar el correo";
// PostgREST default page size is 1000. Explicit generous cap makes the
// assumption visible; if you ever see this many rows something else is wrong.
const QUERY_LIMIT = 5000;

function loadEnv() {
  const envPath = path.resolve(__dirname, "..", "webapp", ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error(`[cleanup] Missing ${envPath}`);
    process.exit(1);
  }
  for (const rawLine of fs.readFileSync(envPath, "utf8").split("\n")) {
    // Strip `export KEY=value` shell-sourcing prefix, then trim.
    const trimmed = rawLine.replace(/^\s*export\s+/, "").trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("[cleanup] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY missing");
  process.exit(1);
}

const { createClient } = require(
  path.resolve(__dirname, "..", "webapp", "node_modules", "@supabase", "supabase-js"),
);

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function isRealPdf(storagePath) {
  // supabase-js storage.download() fetches the full object — there is no
  // Range-header API. `.slice(0, 5)` is an in-memory Blob operation. That's
  // fine here because corrupted blobs are ~8KB and real PDFs in the candidate
  // set are few.
  const { data, error } = await admin.storage.from("email-pdfs").download(storagePath);
  if (error || !data) return { exists: false, isPdf: false };
  const header = new Uint8Array(await data.slice(0, 5).arrayBuffer());
  // %PDF- = 0x25 0x50 0x44 0x46 0x2D
  const isPdf =
    header.length >= 5 &&
    header[0] === 0x25 && header[1] === 0x50 &&
    header[2] === 0x44 && header[3] === 0x46 &&
    header[4] === 0x2d;
  return { exists: true, isPdf };
}

async function main() {
  console.log(`[cleanup] mode=${EXECUTE ? "EXECUTE" : "DRY-RUN"} cutoff=${CUTOFF_ISO}`);

  const { data: rows, error } = await admin
    .from("pending_email_statements")
    .select("id, user_id, storage_path, status, created_at, original_filename")
    .in("status", CANDIDATE_STATUSES)
    .lt("created_at", CUTOFF_ISO)
    .limit(QUERY_LIMIT);

  if (error) {
    console.error("[cleanup] query failed:", error.message);
    process.exit(1);
  }

  const candidates = rows ?? [];
  console.log(`[cleanup] ${candidates.length} candidate row(s)`);

  const summary = { corrupted: 0, realPdf: 0, missingBlob: 0, updateErrors: 0, removeErrors: 0 };

  for (const row of candidates) {
    const { exists, isPdf } = await isRealPdf(row.storage_path);

    if (exists && isPdf) {
      summary.realPdf += 1;
      console.log(`  skip   ${row.id} (${row.status}, real PDF at ${row.storage_path}) — ${row.original_filename ?? "?"}`);
      continue;
    }

    summary.corrupted += 1;
    if (!exists) summary.missingBlob += 1;
    console.log(`  clean  ${row.id} (${row.status}, ${exists ? "corrupted blob" : "missing blob"}) — ${row.original_filename ?? "?"}`);

    if (!EXECUTE) continue;

    if (exists) {
      const { error: removeError } = await admin.storage
        .from("email-pdfs")
        .remove([row.storage_path]);
      if (removeError) {
        summary.removeErrors += 1;
        console.error(`         storage.remove failed for ${row.storage_path}: ${removeError.message}`);
      }
    }

    const { error: updateError } = await admin
      .from("pending_email_statements")
      .update({
        status: "parse_failed",
        error_message: ERROR_MESSAGE,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("user_id", row.user_id)
      // Race guard: if the webhook concurrently moved this row to 'imported'
      // or 'dismissed' we must not stomp it back to parse_failed.
      .in("status", CANDIDATE_STATUSES);
    if (updateError) {
      summary.updateErrors += 1;
      console.error(`         update failed for ${row.id}: ${updateError.message}`);
    }
  }

  console.log("[cleanup] summary", summary);
  if (!EXECUTE) {
    console.log("[cleanup] dry-run complete. Re-run with --execute to apply.");
  }
}

main().catch((err) => {
  console.error("[cleanup] unhandled:", err);
  process.exit(1);
});
