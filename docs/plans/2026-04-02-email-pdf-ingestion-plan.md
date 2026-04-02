# Email PDF Statement Ingestion — Implementation Plan

**Date:** 2026-04-02
**Status:** Draft
**Effort:** ~3-4 weeks (v1)

---

## 1. Overview

Enable users to receive bank statement PDFs via email and have them automatically parsed, queued for review, and imported — reusing the existing PDF parser service and email webhook infrastructure.

**Current state:**
- Email ingestion exists for **single-transaction text alerts** (Bancolombia only) via Resend webhooks
- PDF import exists as an **interactive 6-step wizard** (14 bank parsers) via manual file upload
- These two flows are completely separate

**Goal:** Bridge them — when an email arrives with a PDF attachment, extract it, parse it through the existing PDF parser, and queue the resulting statement for user review.

---

## 2. Architecture Decision: Where Does PDF Extraction Happen?

### Recommended: Extend the existing webhook handler

**Why not a separate service/worker queue:**
- Volume is low (~1-5 PDFs/user/month for statements)
- The webhook handler already fetches email content from Resend API — adding attachment extraction is incremental
- No need for Redis/SQS infrastructure
- The PDF parser service already handles the heavy lifting asynchronously

**Flow:**
```
Bank sends statement email with PDF attachment
    ↓
Resend captures → webhooks to /api/webhooks/email-ingest
    ↓
Webhook detects PDF attachment(s) in Resend API response
    ↓
For each PDF: POST to pdf-parser service /parse endpoint
    ↓
Store ParsedStatement[] in email_pdf_statements table (status: pending)
    ↓
User reviews in UI → approves → reuses importTransactions() logic
```

**Key difference from text email flow:** Text emails produce 1 transaction → auto-import or queue individually. PDF statements produce N transactions + metadata → always queue for review (too complex for auto-import).

---

## 3. Resend API: How Attachments Work

The current webhook handler (`route.ts:107-125`) already fetches email content via:
```
GET https://api.resend.com/emails/receiving/{emailId}
```

This response includes an `attachments` array (when present):
```typescript
type ResendEmailDetail = {
  text: string | null;
  html: string | null;
  attachments?: Array<{
    filename: string;
    content_type: string;    // e.g. "application/pdf"
    content: string;         // base64-encoded content
  }>;
};
```

**Implications:**
- No separate API call needed — attachments come with the same fetch we already make
- Content is base64-encoded, needs decoding to `Buffer` before sending to parser
- Size limit: Resend accepts inbound emails up to **40 MB** (sufficient for bank PDFs, typically 200KB-2MB)
- The webhook payload itself (`email.received` event) does NOT contain attachments — only the API fetch does

**No infrastructure changes needed.** Just extend `fetchEmailContent()` to also return attachments.

---

## 4. Database Schema Changes

### 4a. New table: `email_pdf_statements`

Stores parsed PDF statements received via email, pending user review.

```sql
CREATE TABLE email_pdf_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_ingest_id UUID REFERENCES email_ingest_addresses(id) ON DELETE SET NULL,

  -- Parsed data from pdf-parser service
  parsed_statements JSONB NOT NULL,         -- Full ParsedStatement[] array
  statement_count INTEGER NOT NULL DEFAULT 1,

  -- Email metadata
  from_address TEXT NOT NULL,
  email_subject TEXT,
  filename TEXT,                            -- Original PDF filename
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Account matching (best guess from card_last_four / account_number)
  suggested_account_mappings JSONB,         -- [{statementIndex, accountId, autoMatched}]

  -- Processing state
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'imported', 'dismissed', 'parse_failed')),
  error_message TEXT,
  imported_at TIMESTAMPTZ,

  -- Idempotency: prevent re-processing same statement
  content_hash TEXT NOT NULL,               -- SHA-256 of PDF content
  UNIQUE(user_id, content_hash),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE email_pdf_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own email PDF statements"
  ON email_pdf_statements FOR SELECT
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can update their own email PDF statements"
  ON email_pdf_statements FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);

-- Index for listing pending statements
CREATE INDEX idx_email_pdf_statements_user_status
  ON email_pdf_statements(user_id, status)
  WHERE status = 'pending';
```

### 4b. Extend `email_ingest_addresses`

```sql
ALTER TABLE email_ingest_addresses
  ADD COLUMN pdf_import_enabled BOOLEAN NOT NULL DEFAULT false;
```

### 4c. Extend `email_ingest_logs`

```sql
-- Add a new log status value for PDF processing
-- Current CHECK: ('parsed','imported','queued','duplicate','parse_failed','sender_rejected','rate_limited')
-- Add: 'pdf_queued', 'pdf_parse_failed'
ALTER TABLE email_ingest_logs
  DROP CONSTRAINT IF EXISTS email_ingest_logs_status_check;
ALTER TABLE email_ingest_logs
  ADD CONSTRAINT email_ingest_logs_status_check
  CHECK (status IN (
    'parsed', 'imported', 'queued', 'duplicate',
    'parse_failed', 'sender_rejected', 'rate_limited',
    'pdf_queued', 'pdf_parse_failed'
  ));
```

---

## 5. Implementation Phases

### Phase 1: Backend — Attachment Extraction & Parsing (~1 week)

#### 1a. Extend `fetchEmailContent()` to return attachments

**File:** `webapp/src/app/api/webhooks/email-ingest/route.ts`

```typescript
// Extend the type
type ResendEmailContent = {
  text: string | null;
  html: string | null;
  attachments: Array<{
    filename: string;
    content_type: string;
    content: string; // base64
  }>;
};

// In fetchEmailContent(), add:
attachments: (data.attachments ?? []).map((a: any) => ({
  filename: a.filename ?? "attachment.pdf",
  content_type: a.content_type ?? a.contentType ?? "",
  content: a.content ?? "",
})),
```

#### 1b. Create PDF extraction handler

**New file:** `webapp/src/lib/email-ingest/pdf-handler.ts`

Responsibilities:
- Filter attachments to only PDFs (`content_type === "application/pdf"` or filename ends `.pdf`)
- Decode base64 content to `Buffer`
- Compute SHA-256 content hash (for idempotency)
- POST to PDF parser service as `multipart/form-data`
- Return `ParsedStatement[]` or error

```typescript
export async function extractAndParsePdfAttachments(
  attachments: ResendAttachment[],
  parserUrl: string,
  parserApiKey: string,
): Promise<PdfExtractionResult[]>

type PdfExtractionResult = {
  filename: string;
  contentHash: string;
  statements: ParsedStatement[];  // from pdf-parser
} | {
  filename: string;
  contentHash: string;
  error: string;
}
```

**Key detail:** The parser expects `multipart/form-data` with a `file` field (UploadFile). To send from the webhook handler:
```typescript
const formData = new FormData();
formData.append("file", new Blob([pdfBuffer], { type: "application/pdf" }), filename);
const res = await fetch(`${parserUrl}/parse`, {
  method: "POST",
  headers: { "X-Parser-Key": parserApiKey },
  body: formData,
});
```

#### 1c. Add PDF branch to webhook handler

**File:** `webapp/src/app/api/webhooks/email-ingest/route.ts`

After fetching email content (line ~189), before text parsing (line ~302):

```typescript
// NEW: Check for PDF attachments
const pdfAttachments = emailContent?.attachments?.filter(
  a => a.content_type === "application/pdf" ||
       a.filename?.toLowerCase().endsWith(".pdf")
) ?? [];

if (pdfAttachments.length > 0 && ingestAddress.pdf_import_enabled) {
  // Process PDF attachments (see Phase 1b)
  // Store results in email_pdf_statements
  // Log as 'pdf_queued' or 'pdf_parse_failed'
  // IMPORTANT: Still process text body too — email may contain both
  //   a summary text AND a PDF attachment
}

// Existing text parsing continues below...
```

**Decision:** When an email has both text content AND a PDF attachment:
- If `pdf_import_enabled`: process the PDF, skip text parsing (PDF has more complete data)
- If not `pdf_import_enabled`: process text only (current behavior, unchanged)

#### 1d. Store parsed PDF statements

**New file:** `webapp/src/actions/email-pdf-ingest.ts`

Server actions for the new table:
- `getEmailPdfStatements()` — list pending PDF statements for current user
- `getEmailPdfStatementCount()` — count for badge/notification
- `approveEmailPdfStatement(id, accountMappings, reconciliationDecisions)` — import via existing `importTransactions()` logic
- `dismissEmailPdfStatement(id)` — mark as dismissed

The approve action should reuse the core import logic from `importTransactions()`. Consider extracting the shared insert/reconciliation logic into a helper:

**Refactor:** `webapp/src/actions/import-transactions.ts`
- Extract `insertTransactionsWithReconciliation(transactions, statementMeta, reconciliationDecisions, userId)` as a shared function
- Both `importTransactions()` and `approveEmailPdfStatement()` call it

---

### Phase 2: Auto Account Matching (~2-3 days)

When a PDF statement is parsed, auto-match to existing accounts — same logic the import wizard uses.

**Reuse:** `webapp/src/components/import/import-wizard.tsx` lines 79-117 (`autoMatchAccounts()`)

**Refactor:** Move `autoMatchAccounts()` to a shared utility:
```
webapp/src/lib/utils/account-matching.ts (or extend existing email-ingest/account-matching.ts)
```

This function takes `ParsedStatement[]` + `Account[]` and returns `StatementAccountMapping[]`. Currently it's embedded in the client component — extract it as a pure function usable from both:
1. The import wizard (client component)
2. The webhook handler (server-side, for `suggested_account_mappings`)

---

### Phase 3: UI — Review & Approve Flow (~1-1.5 weeks)

#### 3a. Settings toggle

**File:** `webapp/src/components/settings/email-ingest-card.tsx`

Add a toggle: "Importar extractos PDF adjuntos" (Import PDF statement attachments)
- Only visible when email ingest is active
- Calls `updateIngestSettings({ pdfImportEnabled: true/false })`
- Show explanatory text: "Cuando un correo llega con un PDF adjunto de extracto bancario, se procesará automáticamente"

#### 3b. Pending PDF statements list

**New route:** `webapp/src/app/(dashboard)/importar/email-pdf/page.tsx`

Or add as a tab within the existing import page. Shows:
- List of pending PDF statements with:
  - Bank name (from parser detection), filename, date received
  - Number of transactions found
  - Auto-matched account (if any)
  - Status badge (pending / imported / error)
- Actions: "Revisar" (opens review) / "Descartar" (dismiss)

#### 3c. PDF statement review component

**New file:** `webapp/src/components/import/email-pdf-review.tsx`

A simplified version of the import wizard, skipping step 1 (upload) since the PDF is already parsed. Flow:

1. **Review** — Show parsed statements, confirm account mappings (reuse `StepReview`)
2. **Destinatarios** — Match merchants (reuse `StepDestinatarios`)
3. **Confirm** — Show transaction list (reuse `StepConfirm`)
4. **Reconcile** — Check for duplicates (reuse `ReconciliationStep`)
5. **Results** — Show import results (reuse `StepResults`)

**Key insight:** The existing wizard steps are already separate components that accept data as props. The `email-pdf-review` component just needs to:
1. Load the `ParsedStatement[]` from the `email_pdf_statements` row
2. Feed it into the same steps, starting from step 2 (review)

This is essentially `ImportWizard` without `StepUpload`, initialized with pre-parsed data.

#### 3d. Notification badge

Show a count badge on the import page/nav item when there are pending PDF statements.

**File:** `webapp/src/components/layout/sidebar.tsx` (or wherever nav lives)
- Call `getEmailPdfStatementCount()` and show badge if > 0

---

### Phase 4: Edge Cases & Hardening (~3-5 days)

#### 4a. Password-protected PDFs

**Problem:** Can't prompt the user at email-receive time.

**Solution:**
1. Parser returns 422 with `type: "password_required"` for encrypted PDFs
2. Store in `email_pdf_statements` with `status: 'needs_password'`
3. In the review UI, show a password input field
4. User enters password → client calls a new action that re-submits to parser with password
5. On success, update the stored `parsed_statements` and change status to `pending`

Add to schema:
```sql
-- Extend status CHECK
CHECK (status IN ('pending', 'imported', 'dismissed', 'parse_failed', 'needs_password'))
```

#### 4b. Idempotency (same PDF forwarded twice)

Already handled by `content_hash` UNIQUE constraint on `email_pdf_statements`. On conflict:
- Log as `duplicate`
- Return 200 (don't fail the webhook)

#### 4c. Multi-PDF emails

Some banks send multiple PDFs (e.g., statement + fee schedule). Handle:
- Process each PDF attachment independently
- Each gets its own `email_pdf_statements` row
- If a PDF fails to parse (not a recognized bank format), store with `status: 'parse_failed'` and log — don't block other PDFs

#### 4d. Non-statement PDFs (receipts, terms & conditions)

The parser's `detect_and_parse()` already raises `ValueError` for unrecognized formats. This is the natural filter:
- Recognized bank statement → store as pending
- Unrecognized PDF → log as `pdf_parse_failed`, optionally store in `unrecognized_emails` for training

#### 4e. Timeout handling

PDF parsing can be slow (up to 120s for complex statements). The webhook handler has a short response window.

**Solution:** The Resend webhook expects a 200 response within ~30s. If parsing takes longer:
- Option A: Fire-and-forget — respond 200 immediately, process PDF in background via `waitUntil()` (Next.js edge runtime) or a separate API route
- Option B: Quick check — if PDF is small (<1MB), parse inline; if large, queue for later processing
- **Recommended:** Use Next.js `after()` (available in App Router) to run PDF parsing after the response is sent

```typescript
import { after } from "next/server";

// In the webhook handler:
after(async () => {
  // Parse PDF attachments here — runs after 200 response is sent
  await processPdfAttachments(pdfAttachments, userId, emailIngestId, from);
});
return NextResponse.json({ ok: true });
```

#### 4f. Allowed senders for PDF emails

Banks that send statement PDFs use different sender addresses than alert emails. Need to:
- Extend `allowed_sender` to support multiple senders, OR
- Add a separate `pdf_allowed_senders` field (array or comma-separated)
- Common Colombian bank statement senders:
  - Bancolombia: `extractos@bancolombia.com.co`
  - Davivienda: `notificaciones@davivienda.com`
  - Nu: `no-reply@nu.com.co`

---

## 6. Files Summary

### New files
| File | Purpose |
|------|---------|
| `webapp/src/lib/email-ingest/pdf-handler.ts` | PDF extraction from email attachments, parser service call |
| `webapp/src/actions/email-pdf-ingest.ts` | Server actions for `email_pdf_statements` CRUD |
| `webapp/src/app/(dashboard)/importar/email-pdf/page.tsx` | Pending PDF statements list page |
| `webapp/src/components/import/email-pdf-review.tsx` | Review/approve wizard for email PDF statements |
| `supabase/migrations/YYYYMMDD_email_pdf_statements.sql` | Schema migration |

### Modified files
| File | Change |
|------|--------|
| `webapp/src/app/api/webhooks/email-ingest/route.ts` | Add attachment extraction branch, extend `fetchEmailContent()` |
| `webapp/src/components/settings/email-ingest-card.tsx` | Add PDF toggle |
| `webapp/src/actions/email-ingest.ts` | Add `updateIngestSettings` param for `pdfImportEnabled` |
| `webapp/src/actions/import-transactions.ts` | Extract shared import logic into reusable helper |
| `webapp/src/types/domain.ts` | Add `EmailPdfStatement` type |
| `webapp/src/types/import.ts` | Extend types if needed |
| `webapp/src/lib/utils/account-matching.ts` | Extract `autoMatchAccounts()` from wizard |

### No changes needed
| Component | Why |
|-----------|-----|
| PDF parser service (`services/pdf_parser/`) | Already accepts any PDF via `/parse` — no changes |
| Docker/CI/CD | No new services, no new secrets |
| `importTransactions()` core logic | Reused as-is via extracted helper |

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Resend API changes attachment format | Parsing breaks | Type-check attachment structure, log unrecognized shapes |
| PDF parsing timeout exceeds webhook window | Statement never processed | Use `after()` for async processing |
| Password-protected PDFs pile up | User confusion | Clear UI state + notification, auto-dismiss after 30 days |
| Large PDFs (>10MB) | Memory pressure in webhook handler | Skip PDFs over threshold, log warning |
| User forwards non-bank PDFs | Parser errors, noise | Graceful handling — `parse_failed` status, don't surface errors prominently |
| Duplicate imports (email + manual upload) | Double transactions | Content hash dedup for email PDFs; reconciliation engine catches cross-flow duplicates |

---

## 8. What This Does NOT Cover (Future Scope)

- **Auto-import for PDFs** — Always requires user review (too many transactions + metadata to auto-import safely)
- **ZIP extraction** — Some banks send PDFs inside ZIPs (Davivienda). Needs `unzipper` or similar
- **Scheduled email fetching** — IMAP/POP3 direct connection to user's mailbox (much more complex than Resend webhooks)
- **Mobile app** — Review/approve flow on mobile
- **Multi-bank sender allowlist UI** — Builder for managing allowed senders per bank

---

## 9. User Flow (End to End)

### Setup (one-time)
1. User goes to Settings → Email Import
2. Generates ingest email address (already exists): `u_abc123@ingest.zetafinanzas.com`
3. **NEW:** Enables "Importar extractos PDF" toggle
4. Sets up Gmail filter to forward bank statement emails to ingest address
   - `From: extractos@bancolombia.com.co` → Forward to ingest address
   - `Has attachment: true` (optional, for precision)

### Ongoing flow
1. Bank sends monthly statement email with PDF attachment
2. Gmail auto-forwards to Zeta ingest address
3. Resend captures → webhook fires → PDF extracted & parsed
4. User sees notification: "1 extracto pendiente de revisión"
5. User clicks → sees parsed statement with transactions
6. Reviews account mapping, destinatarios, categories (same wizard steps)
7. Confirms import → transactions added to database
8. Dashboard updates with new data

### Time: ~2 minutes per statement (vs. ~5 minutes for manual PDF upload + wizard)
