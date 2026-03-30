# Email-to-Transaction Ingestion — Design Spec

**Date:** 2026-03-30
**Status:** Draft
**Scope:** Bancolombia email notifications → automatic transaction import

## Overview

Capture Bancolombia transaction notification emails and convert them into Zeta transactions automatically. Users forward bank notification emails to a generated Zeta ingest address; a webhook receives, parses, and imports (or queues for review) each transaction.

## Architecture

```
User's Gmail/Outlook
  │ forwarding rule (alertasynotificaciones@an.notificacionesbancolombia.com
  │                  → u_<nanoid>@ingest.zeta.domain.com)
  ▼
Resend Inbound Email (MX records on ingest.zeta.domain.com)
  │ POST webhook with signature
  ▼
/api/webhooks/email-ingest (Next.js route handler)
  │ 1. Verify Resend webhook signature (HMAC)
  │ 2. Extract: to address, from address, subject, plain-text body
  │ 3. Validate sender = alertasynotificaciones@an.notificacionesbancolombia.com
  │ 4. Look up user by ingest address (u_<nanoid> → user_id)
  │ 5. Rate limit check (100/day/user)
  │ 6. Pass body to email parser
  ▼
Email Parser (in-process TypeScript function)
  │ Regex matches against 9 known Bancolombia patterns
  │ Returns ParsedEmailTransaction
  ▼
Import Logic
  │ - Compute idempotency key
  │ - Auto-categorize + destinatario match
  │ - If user preference = auto → insert via existing import pipeline
  │ - If user preference = review → insert into pending_email_transactions
  ▼
Done (revalidate tags if auto-imported)
```

### Key decisions

- **Email parser lives in the webapp** (TypeScript), not the Python PDF parser service. It's regex against a known single-line format — no PDF extraction or OCR needed.
- **No new microservice.** One Next.js API route handles the full pipeline.
- **New capture method:** `EMAIL_IMPORT` with provider `EMAIL`.
- **Resend first, self-hosted later.** The webhook contract (`POST /api/webhooks/email-ingest` with normalized payload) is the boundary. Swapping Resend for self-hosted SMTP only changes the email receiver, not the app logic.

## Database Schema

### New table: `email_ingest_addresses`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → profiles.id | unique — one address per user |
| `address_key` | text unique | the `u_<nanoid8>` part |
| `account_id` | uuid FK → accounts.id | nullable — default target account |
| `auto_import` | boolean | default false (review mode) |
| `is_active` | boolean | default true |
| `created_at` | timestamptz | |

RLS: `(select auth.uid()) = user_id`

### New table: `pending_email_transactions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → profiles.id | |
| `email_ingest_id` | uuid FK → email_ingest_addresses.id | |
| `raw_body` | text | original email line for debugging |
| `parsed_data` | jsonb | ParsedEmailTransaction fields |
| `suggested_account_id` | uuid FK → accounts.id | nullable |
| `status` | text | `pending` / `imported` / `dismissed` |
| `idempotency_key` | text | pre-computed for dedup |
| `created_at` | timestamptz | |

RLS: `(select auth.uid()) = user_id`

### New table: `email_ingest_logs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → profiles.id | nullable (null if address lookup failed) |
| `email_ingest_id` | uuid FK → email_ingest_addresses.id | nullable |
| `from_address` | text | sender email |
| `status` | text | `parsed` / `imported` / `queued` / `duplicate` / `parse_failed` / `sender_rejected` / `rate_limited` |
| `raw_body` | text | first 500 chars of email body |
| `error_message` | text | nullable |
| `created_at` | timestamptz | |

RLS: `(select auth.uid()) = user_id`

### No changes to `transactions` table

Email-imported transactions use existing schema with:
- `capture_method = 'EMAIL_IMPORT'`
- `provider = 'EMAIL'`

## Email Parser — Bancolombia Patterns

All emails start with `Bancolombia:` and follow one of 9 patterns. The parser extracts the transaction line (between `Bancolombia:` and the first `. Si tienes dudas` / `. ¿Dudas?` / `. Con codigo QR` / `. Estamos cerca` trailer).

### Pattern catalog

#### 1. Retiro (ATM/POS withdrawal) — OUTFLOW
```
Retiraste $50.000,00 en PQBOLIVAR_1 de tu T.Deb **0735 el 26/03/2026 a las 11:20
```
Regex: `Retiraste \$(?<amount>[\d.,]+) en (?<merchant>.+?) de tu (?<card_type>T\.Deb) \*{1,2}(?<card>\d+) el (?<date>\d{2}/\d{2}/\d{4}) a las (?<time>\d{2}:\d{2})`

#### 2. Compra con T.Deb (debit purchase) — OUTFLOW
```
Compraste $22.000,00 en DUNKIN DONUTS con tu T.Deb *0735, el 26/03/2026 a las 14:11
```
Regex: `Compraste \$(?<amount>[\d.,]+) en (?<merchant>.+?) con tu (?<card_type>T\.Deb) \*(?<card>\d+),? el (?<date>\d{2}/\d{2}/\d{4}) a las (?<time>\d{2}:\d{2})`

#### 3. Compra con T.Cred (credit card purchase) — OUTFLOW
```
Compraste COP81.000,00 en DLO*GOOGLE ChatGPT con tu T.Cred *2365, el 27/03/2026 a las 15:25
```
Regex: `Compraste (?:COP|\$)(?<amount>[\d.,]+) en (?<merchant>.+?) con tu (?<card_type>T\.Cred) \*(?<card>\d+),? el (?<date>\d{2}/\d{2}/\d{4}) a las (?<time>\d{2}:\d{2})`

#### 4. Transferencia (bank transfer) — OUTFLOW
```
Transferiste $680,000.00 desde tu cuenta *?4398 a la cuenta *3196360227 el 27/03/2026 a las 17:19
```
Regex: `Transferiste \$(?<amount>[\d.,]+) desde tu cuenta \*?(?<card>\d+) a la cuenta \*?(?<dest>\d+) el (?<date>\d{2}/\d{2}/\d{4}) a las (?<time>\d{2}:\d{2})`

#### 5. Transferencia por QR — OUTFLOW
```
Transferiste $42,500.00 por QR desde tu cuenta 4398 a la cuenta 2655, el 2026/03/27 11:59
```
Regex: `Transferiste \$(?<amount>[\d.,]+) por QR desde tu cuenta \*?(?<card>\d+) a la cuenta \*?(?<dest>\d+),? el (?<date>\d{4}/\d{2}/\d{2}) (?<time>\d{2}:\d{2})`
Note: date is YYYY/MM/DD

#### 6. Pago por codigo QR (QR llave) — OUTFLOW
```
(?:FULL_NAME )pagaste $23,300.00 por codigo QR desde tu cuenta *4398 a la llave 0042980136 el 27/03/2026 a las 09:18
```
Regex: `(?:[\w\s]+ )?pagaste \$(?<amount>[\d.,]+) por codigo QR desde tu cuenta \*?(?<card>\d+) a la llave (?<dest>\d+) el (?<date>\d{2}/\d{2}/\d{4}) a las (?<time>\d{2}:\d{2})`

#### 7. Pago PSE / factura — OUTFLOW
```
Pagaste $2,270,573.00 a FUNDACION UNIVERSITARIA CEIPA desde tu producto *4398 el 30/03/2026 08:49:58
```
Regex: `Pagaste \$(?<amount>[\d.,]+) a (?<merchant>.+?) desde tu producto \*?(?<card>\d+) el (?<date>\d{2}/\d{2}/\d{4}) (?<time>\d{2}:\d{2}(?::\d{2})?)`

#### 8. Transferencia Bre-B — OUTFLOW
```
CRISTIAN, transferiste $100,000.00 a la llave 3013866335 desde tu cuenta *4398 a JUAN DIEGO TABORDA LOPEZ el 29/03/26 a las 20:52
```
Regex: `(?:[\w]+, )?transferiste \$(?<amount>[\d.,]+) a la llave (?<dest>\d+) desde tu cuenta \*?(?<card>\d+) a (?<merchant>.+?) el (?<date>\d{2}/\d{2}/\d{2,4}) a las (?<time>\d{2}:\d{2})`
Note: date can be DD/MM/YY or DD/MM/YYYY

#### 9. Recibiste Nomina — INFLOW
```
Recibiste un pago de Nomina de UNIVERSIDAD PON por $1,203,850.00 en tu cuenta de Ahorros el 27/03/2026 a las 03:32
```
Regex: `Recibiste un pago de Nomina de (?<merchant>.+?) por \$(?<amount>[\d.,]+) en tu cuenta de Ahorros el (?<date>\d{2}/\d{2}/\d{4}) a las (?<time>\d{2}:\d{2})`

### Amount normalization

Bancolombia uses two number formats depending on the transaction type:

| Format | Example | Meaning |
|--------|---------|---------|
| EU-style (card purchases) | `$50.000,00` | 50,000.00 COP |
| US-style (transfers, QR, nomina) | `$680,000.00` | 680,000.00 COP |
| COP prefix (credit card) | `COP81.000,00` | 81,000.00 COP |

**Heuristic:** If the string contains both `.` and `,`, the last separator is the decimal (EU if comma last, US if period last). If only `.` appears, check position: `.` with exactly 2 digits after = decimal; `.` with 3 digits after = thousands. Amounts without decimals (e.g., `$44,000`) are whole COP.

### Date normalization

| Input format | Pattern | Example |
|-------------|---------|---------|
| DD/MM/YYYY | Most patterns | `26/03/2026` |
| YYYY/MM/DD | QR transfer (pattern 5) | `2026/03/27` |
| DD/MM/YY | Bre-B (pattern 8) | `29/03/26` |

All normalized to ISO `YYYY-MM-DD` before storage.

### Parser output type

```typescript
interface ParsedEmailTransaction {
  direction: 'OUTFLOW' | 'INFLOW'
  amount: number                    // normalized to standard number
  currency: 'COP'
  merchant: string | null           // merchant, employer, or null for plain transfers
  destination: string | null        // dest account/llave/recipient name for transfers
  card_last4: string                // "0735", "4398", etc.
  card_type: 'T.Deb' | 'T.Cred' | 'Cta' | 'producto'
  transaction_date: string          // ISO date YYYY-MM-DD
  transaction_time: string          // "HH:MM"
  raw_line: string                  // original Bancolombia: line
  pattern_type: 'retiro' | 'compra_debito' | 'compra_credito' | 'transferencia' | 'qr_transferencia' | 'qr_pago' | 'pago_pse' | 'bre_b' | 'nomina'
}
```

## User Identification

Each user gets a unique ingest email address generated by the app.

- Format: `u_<nanoid8>@ingest.zeta.domain.com` (e.g., `u_a7f3x9kp@ingest.zeta.domain.com`)
- Generated via `nanoid(8)` — URL-safe, cryptographically random, not guessable
- One address per user (enforced by unique constraint on `user_id`)
- Lookup: webhook extracts the local part (`u_a7f3x9kp`), queries `email_ingest_addresses` by `address_key`

No card-number matching. The ingest address IS the user identifier.

## Import Modes

Users configure their preference per ingest address:

### Auto-import (auto_import = true)
- Email arrives → parse → idempotency check → insert transaction immediately
- Runs auto-categorize and destinatario matching
- Target account from `email_ingest_addresses.account_id` or, if null, logs as parse failure (account required for auto-import)
- Calls `revalidateTag()` for affected dashboard segments

### Review mode (auto_import = false, default)
- Email arrives → parse → insert into `pending_email_transactions` with status `pending`
- User sees pending count badge on transactions nav
- "Pendientes por correo" section shows parsed transactions with:
  - Date, merchant/description, amount, suggested account
  - Approve / Dismiss per transaction
  - Bulk approve for multiple selections
- On approve: runs through normal import pipeline (idempotency, categorization, insert)
- On dismiss: marks status as `dismissed`

## Idempotency & PDF Reconciliation

### Email idempotency key

```typescript
computeIdempotencyKey({
  provider: "EMAIL",
  transactionDate: parsed.transaction_date,    // ISO date
  amount: parsed.amount,
  rawDescription: normalizeDescription(parsed.raw_line),
  installmentCurrent: undefined                // emails don't have installment info
})
```

### Cross-source dedup (email ↔ PDF)

When a PDF statement is imported for the same period, the existing reconciliation system handles overlap:

1. **Exact idempotency match**: if the normalized description from email and PDF produce the same hash → skip (ideal case)
2. **Fuzzy reconciliation**: if descriptions differ slightly (e.g., email says "DUNKIN DONUTS", PDF says "DUNKIN DONUTS BELLO"), the scoring system (amount match + date proximity + token similarity) flags them as `REVIEW` candidates
3. **No match**: both kept as separate transactions (user resolves manually)

**Critical testing needed:** Real email + PDF samples for the same transactions must be compared to determine if idempotency keys align or if reconciliation scoring is the primary dedup mechanism.

## Settings UI

**Location:** Settings → "Importar por correo"

### Setup state (no address generated yet)
- "Activa la importación automática de transacciones desde las notificaciones de tu banco por correo electrónico"
- Button: "Activar importación por correo"

### Active state
- Generated address displayed with copy button
- Instructions (Spanish):
  > "Crea una regla de reenvío en tu correo para que los mensajes de `alertasynotificaciones@an.notificacionesbancolombia.com` se envíen a esta dirección."
- Default account selector (dropdown of user's accounts)
- Auto-import toggle (on/off)
- Last email received: timestamp or "Sin correos recibidos"
- Recent activity log (last 20 emails): date, status (imported/queued/failed/duplicate), merchant
- "Correos no reconocidos" expandable section showing parse failures
- Deactivate button (sets `is_active = false`)

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Unknown sender | Log as `sender_rejected`, return 200, do nothing |
| Unknown recipient address | Log minimal info, return 200 |
| Unparseable email body | Log as `parse_failed` with raw body excerpt, skip |
| Duplicate idempotency key | Log as `duplicate`, skip (catch `23505` error) |
| Rate limit exceeded (>100/day) | Log as `rate_limited`, skip |
| Inactive address | Return 200, do nothing |
| Resend signature invalid | Return 401 |
| Auto-import with no target account | Log as error, queue to pending instead |

All responses return 200 to Resend (except invalid signature) to prevent unnecessary retries. Processing errors are logged, not propagated.

## Security

- **Webhook signature verification**: Resend signs webhook payloads with HMAC; verified before processing
- **Sender whitelist**: Only `alertasynotificaciones@an.notificacionesbancolombia.com` processed
- **Address unguessability**: `nanoid(8)` provides ~10^13 combinations — brute-force infeasible
- **Rate limiting**: 100 emails/day/user cap
- **RLS**: All tables have `(select auth.uid()) = user_id` policy
- **Defense-in-depth**: All queries include `.eq("user_id", user.id)` even with RLS
- **No PII storage**: Raw email body stored temporarily for debugging (first 500 chars in logs); full body only in pending transactions (deleted after import/dismiss)

## Files to Create/Modify

### New files
- `webapp/src/app/api/webhooks/email-ingest/route.ts` — webhook handler
- `webapp/src/lib/parsers/bancolombia-email.ts` — email parser (9 patterns)
- `webapp/src/lib/parsers/bancolombia-email.test.ts` — parser tests with real samples
- `webapp/src/actions/email-ingest.ts` — server actions for settings + pending tx management
- `webapp/src/components/settings/email-ingest-settings.tsx` — settings UI
- `webapp/src/components/transactions/pending-email-transactions.tsx` — review mode UI
- `supabase/migrations/XXXXXX_email_ingest.sql` — tables + RLS + indexes

### Modified files
- `webapp/src/types/database.ts` — regenerated after migration
- `webapp/src/types/domain.ts` — add EmailIngestAddress, PendingEmailTransaction types
- `webapp/src/app/(dashboard)/settings/page.tsx` — add email ingest section
- `webapp/src/app/(dashboard)/transactions/page.tsx` — add pending badge + section

## Scope

### In scope (v1)
- Resend inbound email setup (MX records, webhook)
- Webhook API route with signature verification
- Bancolombia email parser (9 patterns from 42 real samples)
- Database tables with RLS
- Settings UI for address generation, account binding, auto/review toggle
- Review mode UI for pending transactions
- `EMAIL_IMPORT` capture method integration
- Basic logging and monitoring in settings

### Not in scope (future)
- Other banks' email notifications
- Self-hosted SMTP server (migration path designed, not built)
- Push notifications for auto-imported transactions
- Email verification flow
- Batch import of historical emails
- Mobile app integration
