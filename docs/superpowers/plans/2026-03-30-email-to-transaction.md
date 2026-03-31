# Email-to-Transaction Ingestion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture Bancolombia email notifications and import them as transactions via a Resend inbound webhook.

**Architecture:** A Next.js API route receives forwarded emails from Resend, parses the Bancolombia notification line with pattern-matched regexes, and either auto-imports or queues for user review. Per-user generated email addresses provide user identification. No new microservices.

**Tech Stack:** Next.js API route, Resend inbound webhooks, Supabase (3 new tables), TypeScript regex parser, nanoid for address generation.

**Spec:** `docs/superpowers/specs/2026-03-30-email-to-transaction-design.md`

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `webapp/src/lib/parsers/bancolombia-email.ts` | Regex parser for 9 Bancolombia email patterns |
| `webapp/src/lib/parsers/__tests__/bancolombia-email.test.ts` | Parser unit tests with real samples |
| `webapp/src/app/api/webhooks/email-ingest/route.ts` | Resend webhook handler |
| `webapp/src/actions/email-ingest.ts` | Server actions: generate address, toggle settings, approve/dismiss pending |
| `webapp/src/components/settings/email-ingest-card.tsx` | Settings UI for email ingestion |
| `webapp/src/components/transactions/pending-email-transactions.tsx` | Review mode UI |
| `supabase/migrations/XXXXXX_email_ingest.sql` | 3 tables + RLS + indexes |

### Modified files
| File | Change |
|------|--------|
| `webapp/src/types/database.ts` | Regenerated after migration |
| `webapp/src/types/domain.ts` | Add EmailIngestAddress, PendingEmailTransaction types |
| `webapp/src/app/(dashboard)/settings/page.tsx` | Add EmailIngestCard to settings page |
| `webapp/src/app/(dashboard)/transactions/page.tsx` | Add pending email badge + section |
| `webapp/package.json` | Add `nanoid` dependency |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/XXXXXX_email_ingest.sql`

- [ ] **Step 1: Create migration file**

Run: `npx supabase migration new email_ingest`

This generates a timestamped file in `supabase/migrations/`.

- [ ] **Step 2: Write the migration SQL**

Write this content into the generated migration file:

```sql
-- Email ingest addresses (one per user)
create table email_ingest_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  address_key text not null,
  account_id uuid references accounts(id) on delete set null,
  auto_import boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),

  constraint email_ingest_addresses_user_id_key unique (user_id),
  constraint email_ingest_addresses_address_key_key unique (address_key)
);

alter table email_ingest_addresses enable row level security;

create policy "Users can manage their own ingest address"
  on email_ingest_addresses
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Pending email transactions (review mode queue)
create table pending_email_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  email_ingest_id uuid not null references email_ingest_addresses(id) on delete cascade,
  raw_body text not null,
  parsed_data jsonb not null,
  suggested_account_id uuid references accounts(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'imported', 'dismissed')),
  idempotency_key text not null,
  created_at timestamptz not null default now()
);

alter table pending_email_transactions enable row level security;

create policy "Users can manage their own pending transactions"
  on pending_email_transactions
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index idx_pending_email_tx_user_status
  on pending_email_transactions (user_id, status)
  where status = 'pending';

-- Email ingest logs (monitoring)
create table email_ingest_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  email_ingest_id uuid references email_ingest_addresses(id) on delete set null,
  from_address text,
  status text not null check (status in ('parsed', 'imported', 'queued', 'duplicate', 'parse_failed', 'sender_rejected', 'rate_limited')),
  raw_body text,
  error_message text,
  created_at timestamptz not null default now()
);

alter table email_ingest_logs enable row level security;

create policy "Users can view their own ingest logs"
  on email_ingest_logs
  for select
  using ((select auth.uid()) = user_id);

-- Service role insert policy for webhook (no auth context)
create policy "Service role can insert logs"
  on email_ingest_logs
  for insert
  with check (true);

create index idx_email_ingest_logs_user_created
  on email_ingest_logs (user_id, created_at desc);

-- Add EMAIL_IMPORT to capture method enum if not exists
do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'EMAIL_IMPORT'
    and enumtypid = (select oid from pg_type where typname = 'transaction_capture_method')
  ) then
    alter type transaction_capture_method add value 'EMAIL_IMPORT';
  end if;
end $$;
```

- [ ] **Step 3: Push migration**

Run: `npx supabase db push`

Expected: Migration applied successfully.

- [ ] **Step 4: Regenerate types**

Run: `npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu > webapp/src/types/database.ts`

Verify the file starts with `export type Json =` (strip first line if `compdef` warning leaks).

- [ ] **Step 5: Add domain types**

Add to `webapp/src/types/domain.ts`:

```typescript
export type EmailIngestAddress = Tables<"email_ingest_addresses">;
export type PendingEmailTransaction = Tables<"pending_email_transactions">;
export type EmailIngestLog = Tables<"email_ingest_logs">;
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/ webapp/src/types/database.ts webapp/src/types/domain.ts
git commit -m "feat(email-ingest): add database tables for email ingestion"
```

---

## Task 2: Bancolombia Email Parser

**Files:**
- Create: `webapp/src/lib/parsers/bancolombia-email.ts`
- Create: `webapp/src/lib/parsers/__tests__/bancolombia-email.test.ts`

- [ ] **Step 1: Write the parser tests**

Create `webapp/src/lib/parsers/__tests__/bancolombia-email.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseBancolombiaEmail } from "../bancolombia-email";

describe("parseBancolombiaEmail", () => {
  // Pattern 1: Retiro
  it("parses ATM withdrawal (Retiraste)", () => {
    const line =
      "Bancolombia: Retiraste $50.000,00 en PQBOLIVAR_1 de tu T.Deb **0735 el 26/03/2026 a las 11:20. Si tienes dudas, llamanos al 6045109095. Estamos cerca";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("OUTFLOW");
    expect(result!.amount).toBe(50000);
    expect(result!.merchant).toBe("PQBOLIVAR_1");
    expect(result!.card_last4).toBe("0735");
    expect(result!.card_type).toBe("T.Deb");
    expect(result!.transaction_date).toBe("2026-03-26");
    expect(result!.transaction_time).toBe("11:20");
    expect(result!.pattern_type).toBe("retiro");
  });

  // Pattern 2: Compra con T.Deb
  it("parses debit purchase (Compraste T.Deb)", () => {
    const line =
      "Bancolombia: Compraste $22.000,00 en DUNKIN DONUTS con tu T.Deb *0735, el 26/03/2026 a las 14:11. Si tienes dudas, encuentranos aqui: 6045109095 o 018000931987. Estamos cerca.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("OUTFLOW");
    expect(result!.amount).toBe(22000);
    expect(result!.merchant).toBe("DUNKIN DONUTS");
    expect(result!.card_last4).toBe("0735");
    expect(result!.card_type).toBe("T.Deb");
    expect(result!.transaction_date).toBe("2026-03-26");
    expect(result!.pattern_type).toBe("compra_debito");
  });

  // Pattern 2b: Debit with decimals
  it("parses debit purchase with decimals", () => {
    const line =
      "Bancolombia: Compraste $152.340,77 en SUPABASE con tu T.Deb *0735, el 27/03/2026 a las 21:10. Si tienes dudas, encuentranos aqui: 6045109095 o 018000931987. Estamos cerca.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.amount).toBeCloseTo(152340.77);
    expect(result!.merchant).toBe("SUPABASE");
  });

  // Pattern 3: Compra con T.Cred (COP prefix)
  it("parses credit card purchase (Compraste T.Cred with COP)", () => {
    const line =
      "Bancolombia: Compraste COP81.000,00 en DLO*GOOGLE ChatGPT con tu T.Cred *2365, el 27/03/2026 a las 15:25. Si tienes dudas, encuentranos aqui: 6045109095 o 018000931987. Estamos cerca.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("OUTFLOW");
    expect(result!.amount).toBe(81000);
    expect(result!.merchant).toBe("DLO*GOOGLE ChatGPT");
    expect(result!.card_last4).toBe("2365");
    expect(result!.card_type).toBe("T.Cred");
    expect(result!.pattern_type).toBe("compra_credito");
  });

  // Pattern 4: Transferencia
  it("parses bank transfer (Transferiste)", () => {
    const line =
      "Bancolombia: Transferiste $680,000.00 desde tu cuenta 4398 a la cuenta *3196360227 el 27/03/2026 a las 17:19. ¿Dudas? Llamanos al 018000931987. Estamos cerca.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("OUTFLOW");
    expect(result!.amount).toBe(680000);
    expect(result!.merchant).toBeNull();
    expect(result!.destination).toBe("3196360227");
    expect(result!.card_last4).toBe("4398");
    expect(result!.transaction_date).toBe("2026-03-27");
    expect(result!.pattern_type).toBe("transferencia");
  });

  // Pattern 4b: Transfer without asterisk on source
  it("parses transfer with asterisk on source account", () => {
    const line =
      "Bancolombia: Transferiste $50,900 desde tu cuenta *4398 a la cuenta *10382409401 el 26/03/2026 a las 17:11. ¿Dudas? Llamanos al 018000931987. Estamos cerca.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(50900);
    expect(result!.card_last4).toBe("4398");
    expect(result!.destination).toBe("10382409401");
  });

  // Pattern 5: Transferencia por QR (YYYY/MM/DD date!)
  it("parses QR transfer (Transferiste por QR) with YYYY/MM/DD date", () => {
    const line =
      "Bancolombia: Transferiste $42,500.00 por QR desde tu cuenta 4398 a la cuenta 2655, el 2026/03/27 11:59. ¿Dudas? Llamanos al 018000931987. Estamos cerca.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("OUTFLOW");
    expect(result!.amount).toBe(42500);
    expect(result!.card_last4).toBe("4398");
    expect(result!.destination).toBe("2655");
    expect(result!.transaction_date).toBe("2026-03-27");
    expect(result!.pattern_type).toBe("qr_transferencia");
  });

  // Pattern 6: Pago por codigo QR
  it("parses QR llave payment (pagaste por codigo QR)", () => {
    const line =
      "Bancolombia: CRISTIAN CAMILO GIRALDO MAZO pagaste $23,300.00 por codigo QR desde tu cuenta *4398 a la llave 0042980136 el 27/03/2026 a las 09:18. Con codigo QR es facil y de una. Dudas al 018000912345.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("OUTFLOW");
    expect(result!.amount).toBe(23300);
    expect(result!.card_last4).toBe("4398");
    expect(result!.destination).toBe("0042980136");
    expect(result!.transaction_date).toBe("2026-03-27");
    expect(result!.pattern_type).toBe("qr_pago");
  });

  // Pattern 7: Pagaste (PSE) with seconds in time
  it("parses PSE payment (Pagaste a ... desde tu producto)", () => {
    const line =
      "Bancolombia: Pagaste $2,270,573.00 a FUNDACION UNIVERSITARIA CEIPA desde tu producto *4398 el 30/03/2026 08:49:58. ¿Dudas? Llamanos al 6045109095. Estamos cerca";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("OUTFLOW");
    expect(result!.amount).toBe(2270573);
    expect(result!.merchant).toBe("FUNDACION UNIVERSITARIA CEIPA");
    expect(result!.card_last4).toBe("4398");
    expect(result!.card_type).toBe("producto");
    expect(result!.transaction_date).toBe("2026-03-30");
    expect(result!.transaction_time).toBe("08:49");
    expect(result!.pattern_type).toBe("pago_pse");
  });

  // Pattern 8: Bre-B transfer (2-digit year, recipient name)
  it("parses Bre-B transfer (transferiste a la llave ... a RECIPIENT)", () => {
    const line =
      "Bancolombia: CRISTIAN, transferiste $100,000.00 a la llave 3013866335 desde tu cuenta *4398 a JUAN DIEGO TABORDA LOPEZ el 29/03/26 a las 20:52. Con Bre-b es de una y gratis. Dudas al 018000912345.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("OUTFLOW");
    expect(result!.amount).toBe(100000);
    expect(result!.destination).toBe("3013866335");
    expect(result!.merchant).toBe("JUAN DIEGO TABORDA LOPEZ");
    expect(result!.card_last4).toBe("4398");
    expect(result!.transaction_date).toBe("2026-03-29");
    expect(result!.pattern_type).toBe("bre_b");
  });

  // Pattern 9: Nomina (INFLOW)
  it("parses salary deposit (Recibiste pago de Nomina)", () => {
    const line =
      "Bancolombia: Recibiste un pago de Nomina de UNIVERSIDAD PON por $1,203,850.00 en tu cuenta de Ahorros el 27/03/2026 a las 03:32. Si tienes dudas, llamanos al 018000931987. A tu lado siempre.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("INFLOW");
    expect(result!.amount).toBe(1203850);
    expect(result!.merchant).toBe("UNIVERSIDAD PON");
    expect(result!.transaction_date).toBe("2026-03-27");
    expect(result!.pattern_type).toBe("nomina");
  });

  // Amount parsing edge cases
  it("parses whole amount without decimals (transfers)", () => {
    const line =
      "Bancolombia: Transferiste $44,000 desde tu cuenta *4398 a la cuenta *25536314779 el 27/03/2026 a las 19:30. ¿Dudas? Llamanos al 018000931987. Estamos cerca.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(44000);
  });

  // Unrecognized email
  it("returns null for non-Bancolombia email", () => {
    const line = "Your Amazon order has shipped!";
    expect(parseBancolombiaEmail(line)).toBeNull();
  });

  it("returns null for Bancolombia marketing email", () => {
    const line =
      "Bancolombia: Aprovecha las tasas especiales en créditos de vivienda.";
    expect(parseBancolombiaEmail(line)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd webapp && npx vitest run src/lib/parsers/__tests__/bancolombia-email.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Write the parser implementation**

Create `webapp/src/lib/parsers/bancolombia-email.ts`:

```typescript
export interface ParsedEmailTransaction {
  direction: "OUTFLOW" | "INFLOW";
  amount: number;
  currency: "COP";
  merchant: string | null;
  destination: string | null;
  card_last4: string;
  card_type: "T.Deb" | "T.Cred" | "Cta" | "producto";
  transaction_date: string; // ISO YYYY-MM-DD
  transaction_time: string; // HH:MM
  raw_line: string;
  pattern_type:
    | "retiro"
    | "compra_debito"
    | "compra_credito"
    | "transferencia"
    | "qr_transferencia"
    | "qr_pago"
    | "pago_pse"
    | "bre_b"
    | "nomina";
}

// ── Amount parsing ──────────────────────────────────────────────────────────

function parseAmount(raw: string): number {
  const cleaned = raw.trim();

  // Determine format by position of last separator
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  if (lastComma > lastDot) {
    // EU-style: 50.000,00 → comma is decimal
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    return parseFloat(normalized);
  }

  if (lastDot > lastComma) {
    // Check if dot is decimal (1-2 digits after) or thousands (3 digits after)
    const afterDot = cleaned.substring(lastDot + 1);
    if (afterDot.length <= 2) {
      // US-style with decimal: 680,000.00
      const normalized = cleaned.replace(/,/g, "");
      return parseFloat(normalized);
    }
    // Dot is thousands separator with no decimal: unlikely but handle
    const normalized = cleaned.replace(/\./g, "").replace(/,/g, "");
    return parseFloat(normalized);
  }

  // Only one type of separator or none
  if (lastComma !== -1) {
    const afterComma = cleaned.substring(lastComma + 1);
    if (afterComma.length <= 2) {
      // Single comma as decimal: rare but possible
      return parseFloat(cleaned.replace(",", "."));
    }
    // Comma is thousands: 44,000
    return parseFloat(cleaned.replace(/,/g, ""));
  }

  if (lastDot !== -1) {
    const afterDot = cleaned.substring(lastDot + 1);
    if (afterDot.length <= 2) {
      return parseFloat(cleaned);
    }
    return parseFloat(cleaned.replace(/\./g, ""));
  }

  return parseFloat(cleaned);
}

// ── Date parsing ────────────────────────────────────────────────────────────

function parseDateDMY(raw: string): string {
  const parts = raw.split("/");
  if (parts.length !== 3) return raw;
  let [d, m, y] = parts;
  if (y.length === 2) y = "20" + y;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function parseDateYMD(raw: string): string {
  const parts = raw.split("/");
  if (parts.length !== 3) return raw;
  const [y, m, d] = parts;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// ── Pattern definitions ─────────────────────────────────────────────────────

type PatternDef = {
  type: ParsedEmailTransaction["pattern_type"];
  regex: RegExp;
  extract: (m: RegExpMatchArray) => Omit<ParsedEmailTransaction, "raw_line"> | null;
};

const PATTERNS: PatternDef[] = [
  // 1. Retiro
  {
    type: "retiro",
    regex:
      /Retiraste \$([\d.,]+) en (.+?) de tu (T\.Deb) \*{1,2}(\d+) el (\d{2}\/\d{2}\/\d{4}) a las (\d{2}:\d{2})/,
    extract: (m) => ({
      direction: "OUTFLOW",
      amount: parseAmount(m[1]),
      currency: "COP",
      merchant: m[2].trim(),
      destination: null,
      card_last4: m[4],
      card_type: "T.Deb",
      transaction_date: parseDateDMY(m[5]),
      transaction_time: m[6],
      pattern_type: "retiro",
    }),
  },
  // 2. Compra con T.Cred (must be before T.Deb to match COP prefix)
  {
    type: "compra_credito",
    regex:
      /Compraste (?:COP|\$)([\d.,]+) en (.+?) con tu (T\.Cred) \*(\d+),? el (\d{2}\/\d{2}\/\d{4}) a las (\d{2}:\d{2})/,
    extract: (m) => ({
      direction: "OUTFLOW",
      amount: parseAmount(m[1]),
      currency: "COP",
      merchant: m[2].trim(),
      destination: null,
      card_last4: m[4],
      card_type: "T.Cred",
      transaction_date: parseDateDMY(m[5]),
      transaction_time: m[6],
      pattern_type: "compra_credito",
    }),
  },
  // 3. Compra con T.Deb
  {
    type: "compra_debito",
    regex:
      /Compraste (?:COP|\$)([\d.,]+) en (.+?) con tu (T\.Deb) \*{1,2}(\d+),? el (\d{2}\/\d{2}\/\d{4}) a las (\d{2}:\d{2})/,
    extract: (m) => ({
      direction: "OUTFLOW",
      amount: parseAmount(m[1]),
      currency: "COP",
      merchant: m[2].trim(),
      destination: null,
      card_last4: m[4],
      card_type: "T.Deb",
      transaction_date: parseDateDMY(m[5]),
      transaction_time: m[6],
      pattern_type: "compra_debito",
    }),
  },
  // 4. Transferencia por QR (must be before plain transfer — "por QR" distinguishes)
  {
    type: "qr_transferencia",
    regex:
      /Transferiste \$([\d.,]+) por QR desde tu cuenta \*?(\d+) a la cuenta \*?(\d+),? el (\d{4}\/\d{2}\/\d{2}) (\d{2}:\d{2})/,
    extract: (m) => ({
      direction: "OUTFLOW",
      amount: parseAmount(m[1]),
      currency: "COP",
      merchant: null,
      destination: m[3],
      card_last4: m[2],
      card_type: "Cta",
      transaction_date: parseDateYMD(m[4]),
      transaction_time: m[5],
      pattern_type: "qr_transferencia",
    }),
  },
  // 5. Transferencia plain
  {
    type: "transferencia",
    regex:
      /Transferiste \$([\d.,]+) desde tu cuenta \*?(\d+) a la cuenta \*?(\d+) el (\d{2}\/\d{2}\/\d{4}) a las (\d{2}:\d{2})/,
    extract: (m) => ({
      direction: "OUTFLOW",
      amount: parseAmount(m[1]),
      currency: "COP",
      merchant: null,
      destination: m[3],
      card_last4: m[2],
      card_type: "Cta",
      transaction_date: parseDateDMY(m[4]),
      transaction_time: m[5],
      pattern_type: "transferencia",
    }),
  },
  // 6. Pago por codigo QR (llave)
  {
    type: "qr_pago",
    regex:
      /pagaste \$([\d.,]+) por codigo QR desde tu cuenta \*?(\d+) a la llave (\d+) el (\d{2}\/\d{2}\/\d{4}) a las (\d{2}:\d{2})/,
    extract: (m) => ({
      direction: "OUTFLOW",
      amount: parseAmount(m[1]),
      currency: "COP",
      merchant: null,
      destination: m[3],
      card_last4: m[2],
      card_type: "Cta",
      transaction_date: parseDateDMY(m[4]),
      transaction_time: m[5],
      pattern_type: "qr_pago",
    }),
  },
  // 7. Pagaste PSE / factura
  {
    type: "pago_pse",
    regex:
      /Pagaste \$([\d.,]+) a (.+?) desde tu producto \*?(\d+) el (\d{2}\/\d{2}\/\d{4}) (\d{2}:\d{2})(?::\d{2})?/,
    extract: (m) => ({
      direction: "OUTFLOW",
      amount: parseAmount(m[1]),
      currency: "COP",
      merchant: m[2].trim(),
      destination: null,
      card_last4: m[3],
      card_type: "producto",
      transaction_date: parseDateDMY(m[4]),
      transaction_time: m[5],
      pattern_type: "pago_pse",
    }),
  },
  // 8. Bre-B transfer (FIRST_NAME, transferiste ... a RECIPIENT)
  {
    type: "bre_b",
    regex:
      /transferiste \$([\d.,]+) a la llave (\d+) desde tu cuenta \*?(\d+) a (.+?) el (\d{2}\/\d{2}\/\d{2,4}) a las (\d{2}:\d{2})/,
    extract: (m) => ({
      direction: "OUTFLOW",
      amount: parseAmount(m[1]),
      currency: "COP",
      merchant: m[4].trim(),
      destination: m[2],
      card_last4: m[3],
      card_type: "Cta",
      transaction_date: parseDateDMY(m[5]),
      transaction_time: m[6],
      pattern_type: "bre_b",
    }),
  },
  // 9. Recibiste Nomina (INFLOW)
  {
    type: "nomina",
    regex:
      /Recibiste un pago de Nomina de (.+?) por \$([\d.,]+) en tu cuenta de Ahorros el (\d{2}\/\d{2}\/\d{4}) a las (\d{2}:\d{2})/,
    extract: (m) => ({
      direction: "INFLOW",
      amount: parseAmount(m[2]),
      currency: "COP",
      merchant: m[1].trim(),
      destination: null,
      card_last4: "",
      card_type: "Cta",
      transaction_date: parseDateDMY(m[3]),
      transaction_time: m[4],
      pattern_type: "nomina",
    }),
  },
];

// ── Main parser ─────────────────────────────────────────────────────────────

export function parseBancolombiaEmail(
  body: string
): ParsedEmailTransaction | null {
  // Find the Bancolombia: line
  const bcMatch = body.match(/Bancolombia:\s*(.+?)(?:\.\s*(?:Si tienes dudas|¿Dudas|Con codigo QR|Con Bre-b|A tu lado|Estamos cerca))/s);
  if (!bcMatch) return null;

  const content = bcMatch[0];

  for (const pattern of PATTERNS) {
    const match = content.match(pattern.regex);
    if (match) {
      const parsed = pattern.extract(match);
      if (parsed) {
        return { ...parsed, raw_line: bcMatch[1].trim() };
      }
    }
  }

  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd webapp && npx vitest run src/lib/parsers/__tests__/bancolombia-email.test.ts`

Expected: All 13 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/lib/parsers/
git commit -m "feat(email-ingest): add Bancolombia email parser with 9 patterns"
```

---

## Task 3: Install nanoid + Server Actions

**Files:**
- Modify: `webapp/package.json` (add nanoid)
- Create: `webapp/src/actions/email-ingest.ts`

- [ ] **Step 1: Install nanoid**

Run: `cd webapp && pnpm add nanoid`

- [ ] **Step 2: Create server actions**

Create `webapp/src/actions/email-ingest.ts`:

```typescript
"use server";

import { revalidateTag } from "next/cache";
import { nanoid } from "nanoid";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeIdempotencyKey } from "@/lib/utils/idempotency";
import { autoCategorize } from "@zeta/shared";
import type { ActionResult } from "@/types/actions";
import type { EmailIngestAddress, PendingEmailTransaction } from "@/types/domain";

// ── Read ────────────────────────────────────────────────────────────────────

export async function getEmailIngestAddress(): Promise<
  ActionResult<EmailIngestAddress | null>
> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autorizado" };

  const { data, error } = await supabase
    .from("email_ingest_addresses")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function getPendingEmailTransactions(): Promise<
  ActionResult<PendingEmailTransaction[]>
> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autorizado" };

  const { data, error } = await supabase
    .from("pending_email_transactions")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return { success: false, error: error.message };
  return { success: true, data: data ?? [] };
}

export async function getPendingEmailCount(): Promise<number> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return 0;

  const { count } = await supabase
    .from("pending_email_transactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "pending");

  return count ?? 0;
}

export async function getEmailIngestLogs(): Promise<
  ActionResult<Array<{ id: string; status: string; raw_body: string | null; created_at: string }>>
> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autorizado" };

  const { data, error } = await supabase
    .from("email_ingest_logs")
    .select("id, status, raw_body, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return { success: false, error: error.message };
  return { success: true, data: data ?? [] };
}

// ── Create / Update ─────────────────────────────────────────────────────────

export async function generateIngestAddress(): Promise<
  ActionResult<EmailIngestAddress>
> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autorizado" };

  const addressKey = `u_${nanoid(8)}`;

  const { data, error } = await supabase
    .from("email_ingest_addresses")
    .insert({
      user_id: user.id,
      address_key: addressKey,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Ya tienes una dirección de ingesta activa" };
    }
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export async function updateIngestSettings(params: {
  accountId: string | null;
  autoImport: boolean;
}): Promise<ActionResult<EmailIngestAddress>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autorizado" };

  const { data, error } = await supabase
    .from("email_ingest_addresses")
    .update({
      account_id: params.accountId,
      auto_import: params.autoImport,
    })
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function deactivateIngestAddress(): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autorizado" };

  const { error } = await supabase
    .from("email_ingest_addresses")
    .update({ is_active: false })
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

// ── Approve / Dismiss pending transactions ──────────────────────────────────

export async function approveEmailTransaction(
  pendingId: string
): Promise<ActionResult<{ transactionId: string }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autorizado" };

  // Fetch the pending transaction
  const { data: pending, error: fetchError } = await supabase
    .from("pending_email_transactions")
    .select("*")
    .eq("id", pendingId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .single();

  if (fetchError || !pending) {
    return { success: false, error: "Transacción pendiente no encontrada" };
  }

  const parsed = pending.parsed_data as {
    direction: string;
    amount: number;
    merchant: string | null;
    destination: string | null;
    card_last4: string;
    transaction_date: string;
    transaction_time: string;
    raw_line: string;
    pattern_type: string;
  };

  const accountId = pending.suggested_account_id;
  if (!accountId) {
    return { success: false, error: "Selecciona una cuenta antes de aprobar" };
  }

  // Get account currency
  const { data: account } = await supabase
    .from("accounts")
    .select("currency_code")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .single();

  if (!account) {
    return { success: false, error: "Cuenta no encontrada" };
  }

  const description = parsed.merchant ?? parsed.destination ?? parsed.raw_line;
  const categoryId = autoCategorize(parsed.merchant ?? undefined)?.category_id ?? null;

  // Insert transaction
  const { data: tx, error: insertError } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      account_id: accountId,
      amount: parsed.amount,
      currency_code: account.currency_code,
      direction: parsed.direction as "INFLOW" | "OUTFLOW",
      transaction_date: parsed.transaction_date,
      raw_description: parsed.raw_line,
      clean_description: description,
      merchant_name: parsed.merchant,
      category_id: categoryId,
      idempotency_key: pending.idempotency_key,
      provider: "EMAIL",
      capture_method: "EMAIL_IMPORT",
      capture_input_text: parsed.raw_line,
      is_subscription: false,
      categorization_source: categoryId ? "SYSTEM_DEFAULT" : undefined,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      // Already imported — mark as imported anyway
      await supabase
        .from("pending_email_transactions")
        .update({ status: "imported" })
        .eq("id", pendingId)
        .eq("user_id", user.id);
      return { success: false, error: "Esta transacción ya fue importada" };
    }
    return { success: false, error: insertError.message };
  }

  // Mark pending as imported
  await supabase
    .from("pending_email_transactions")
    .update({ status: "imported" })
    .eq("id", pendingId)
    .eq("user_id", user.id);

  revalidateTag("zeta");
  return { success: true, data: { transactionId: tx.id } };
}

export async function dismissEmailTransaction(
  pendingId: string
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autorizado" };

  const { error } = await supabase
    .from("pending_email_transactions")
    .update({ status: "dismissed" })
    .eq("id", pendingId)
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

export async function bulkApproveEmailTransactions(
  pendingIds: string[]
): Promise<ActionResult<{ imported: number; errors: number }>> {
  let imported = 0;
  let errors = 0;

  for (const id of pendingIds) {
    const result = await approveEmailTransaction(id);
    if (result.success) imported++;
    else errors++;
  }

  revalidateTag("zeta");
  return { success: true, data: { imported, errors } };
}
```

- [ ] **Step 3: Verify build**

Run: `cd webapp && pnpm build`

Expected: Build passes (types may fail if database.ts hasn't been regenerated yet — if so, skip this check and verify after Task 1 migration is applied).

- [ ] **Step 4: Commit**

```bash
git add webapp/package.json webapp/pnpm-lock.yaml webapp/src/actions/email-ingest.ts
git commit -m "feat(email-ingest): add server actions for email ingest management"
```

---

## Task 4: Webhook Route Handler

**Files:**
- Create: `webapp/src/app/api/webhooks/email-ingest/route.ts`

- [ ] **Step 1: Create the webhook route**

Create `webapp/src/app/api/webhooks/email-ingest/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBancolombiaEmail } from "@/lib/parsers/bancolombia-email";
import { computeIdempotencyKey } from "@/lib/utils/idempotency";
import { autoCategorize } from "@zeta/shared";

const ALLOWED_SENDER = "alertasynotificaciones@an.notificacionesbancolombia.com";
const DAILY_RATE_LIMIT = 100;

// Resend webhook signature verification
async function verifyResendSignature(
  request: NextRequest,
  body: string
): Promise<boolean> {
  const signature = request.headers.get("svix-signature");
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  // In development, skip verification if no secret configured
  if (!webhookSecret) {
    console.warn("RESEND_WEBHOOK_SECRET not set — skipping signature verification");
    return true;
  }

  if (!signature) return false;

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");

  if (!svixId || !svixTimestamp) return false;

  const signedContent = `${svixId}.${svixTimestamp}.${body}`;
  const secret = webhookSecret.startsWith("whsec_")
    ? webhookSecret.slice(6)
    : webhookSecret;

  const secretBytes = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedContent)
  );

  const expectedSignature = btoa(
    String.fromCharCode(...new Uint8Array(signatureBytes))
  );

  // Svix sends multiple signatures separated by space, check each
  const signatures = signature.split(" ");
  return signatures.some((sig) => {
    const [, sigValue] = sig.split(",");
    return sigValue === expectedSignature;
  });
}

export async function POST(request: NextRequest) {
  const bodyText = await request.text();

  // Verify signature
  if (!(await verifyResendSignature(request, bodyText))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: {
    type?: string;
    data?: {
      from?: string;
      to?: string[];
      subject?: string;
      text?: string;
      html?: string;
    };
  };

  try {
    payload = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Only process email.received events
  if (payload.type !== "email.received") {
    return NextResponse.json({ ok: true });
  }

  const emailData = payload.data;
  if (!emailData) return NextResponse.json({ ok: true });

  const admin = createAdminClient();

  const fromAddress = emailData.from?.toLowerCase() ?? "";
  const toAddresses = emailData.to ?? [];
  const emailBody = emailData.text ?? emailData.html ?? "";

  // Extract address key from recipient
  let addressKey: string | null = null;
  for (const to of toAddresses) {
    const match = to.match(/^(u_[a-zA-Z0-9_-]+)@/);
    if (match) {
      addressKey = match[1];
      break;
    }
  }

  if (!addressKey) {
    return NextResponse.json({ ok: true });
  }

  // Look up the ingest address
  const { data: ingestAddr } = await admin
    .from("email_ingest_addresses")
    .select("*")
    .eq("address_key", addressKey)
    .eq("is_active", true)
    .single();

  if (!ingestAddr) {
    return NextResponse.json({ ok: true });
  }

  const userId = ingestAddr.user_id;

  // Validate sender
  if (!fromAddress.includes(ALLOWED_SENDER)) {
    await admin.from("email_ingest_logs").insert({
      user_id: userId,
      email_ingest_id: ingestAddr.id,
      from_address: fromAddress,
      status: "sender_rejected",
      raw_body: emailBody.slice(0, 500),
    });
    return NextResponse.json({ ok: true });
  }

  // Rate limit check
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("email_ingest_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", oneDayAgo)
    .in("status", ["parsed", "imported", "queued", "duplicate"]);

  if ((count ?? 0) >= DAILY_RATE_LIMIT) {
    await admin.from("email_ingest_logs").insert({
      user_id: userId,
      email_ingest_id: ingestAddr.id,
      from_address: fromAddress,
      status: "rate_limited",
      raw_body: emailBody.slice(0, 500),
    });
    return NextResponse.json({ ok: true });
  }

  // Parse the email
  const parsed = parseBancolombiaEmail(emailBody);

  if (!parsed) {
    await admin.from("email_ingest_logs").insert({
      user_id: userId,
      email_ingest_id: ingestAddr.id,
      from_address: fromAddress,
      status: "parse_failed",
      raw_body: emailBody.slice(0, 500),
    });
    return NextResponse.json({ ok: true });
  }

  // Compute idempotency key
  const idempotencyKey = await computeIdempotencyKey({
    provider: "EMAIL",
    transactionDate: parsed.transaction_date,
    amount: parsed.amount,
    rawDescription: parsed.raw_line,
  });

  // Auto-import mode
  if (ingestAddr.auto_import && ingestAddr.account_id) {
    const { data: account } = await admin
      .from("accounts")
      .select("currency_code")
      .eq("id", ingestAddr.account_id)
      .eq("user_id", userId)
      .single();

    if (!account) {
      await admin.from("email_ingest_logs").insert({
        user_id: userId,
        email_ingest_id: ingestAddr.id,
        from_address: fromAddress,
        status: "parse_failed",
        raw_body: emailBody.slice(0, 500),
        error_message: "Target account not found",
      });
      return NextResponse.json({ ok: true });
    }

    const description =
      parsed.merchant ?? parsed.destination ?? parsed.raw_line;
    const categoryId =
      autoCategorize(parsed.merchant ?? undefined)?.category_id ?? null;

    const { error: insertError } = await admin
      .from("transactions")
      .insert({
        user_id: userId,
        account_id: ingestAddr.account_id,
        amount: parsed.amount,
        currency_code: account.currency_code,
        direction: parsed.direction,
        transaction_date: parsed.transaction_date,
        raw_description: parsed.raw_line,
        clean_description: description,
        merchant_name: parsed.merchant,
        category_id: categoryId,
        idempotency_key: idempotencyKey,
        provider: "EMAIL",
        capture_method: "EMAIL_IMPORT",
        capture_input_text: parsed.raw_line,
        is_subscription: false,
        categorization_source: categoryId ? "SYSTEM_DEFAULT" : undefined,
      });

    if (insertError) {
      const status = insertError.code === "23505" ? "duplicate" : "parse_failed";
      await admin.from("email_ingest_logs").insert({
        user_id: userId,
        email_ingest_id: ingestAddr.id,
        from_address: fromAddress,
        status,
        raw_body: emailBody.slice(0, 500),
        error_message: insertError.code === "23505" ? undefined : insertError.message,
      });
      return NextResponse.json({ ok: true });
    }

    await admin.from("email_ingest_logs").insert({
      user_id: userId,
      email_ingest_id: ingestAddr.id,
      from_address: fromAddress,
      status: "imported",
    });
    return NextResponse.json({ ok: true });
  }

  // Review mode — queue as pending
  const { error: pendingError } = await admin
    .from("pending_email_transactions")
    .insert({
      user_id: userId,
      email_ingest_id: ingestAddr.id,
      raw_body: parsed.raw_line,
      parsed_data: parsed,
      suggested_account_id: ingestAddr.account_id,
      status: "pending",
      idempotency_key: idempotencyKey,
    });

  const logStatus = pendingError
    ? pendingError.code === "23505"
      ? "duplicate"
      : "parse_failed"
    : "queued";

  await admin.from("email_ingest_logs").insert({
    user_id: userId,
    email_ingest_id: ingestAddr.id,
    from_address: fromAddress,
    status: logStatus,
    error_message: pendingError && pendingError.code !== "23505" ? pendingError.message : undefined,
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Add environment variable placeholder**

Add `RESEND_WEBHOOK_SECRET` to `.env.example` (or document in CLAUDE.md) — the actual secret comes from Resend dashboard after MX record setup.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/app/api/webhooks/email-ingest/
git commit -m "feat(email-ingest): add Resend webhook route handler"
```

---

## Task 5: Settings UI — Email Ingest Card

**Files:**
- Create: `webapp/src/components/settings/email-ingest-card.tsx`
- Modify: `webapp/src/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Create the EmailIngestCard component**

Create `webapp/src/components/settings/email-ingest-card.tsx`:

```typescript
"use client";

import { useState, useTransition } from "react";
import { Mail, Copy, Check, Power, PowerOff, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  generateIngestAddress,
  updateIngestSettings,
  deactivateIngestAddress,
} from "@/actions/email-ingest";
import { cn } from "@/lib/utils";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import type { Account, EmailIngestAddress } from "@/types/domain";

const INGEST_DOMAIN = process.env.NEXT_PUBLIC_EMAIL_INGEST_DOMAIN ?? "ingest.zeta.example.com";

interface EmailIngestCardProps {
  accounts: Account[];
  initialAddress: EmailIngestAddress | null;
}

export function EmailIngestCard({
  accounts,
  initialAddress,
}: EmailIngestCardProps) {
  const [address, setAddress] = useState(initialAddress);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const fullEmail = address
    ? `${address.address_key}@${INGEST_DOMAIN}`
    : null;

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateIngestAddress();
      if (result.success) setAddress(result.data);
    });
  }

  function handleUpdateSettings(accountId: string | null, autoImport: boolean) {
    startTransition(async () => {
      const result = await updateIngestSettings({ accountId, autoImport });
      if (result.success) setAddress(result.data);
    });
  }

  function handleDeactivate() {
    startTransition(async () => {
      const result = await deactivateIngestAddress();
      if (result.success) setAddress(null);
    });
  }

  function handleCopy() {
    if (!fullEmail) return;
    navigator.clipboard.writeText(fullEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!address) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-5" />
            Importar por correo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Activa la importación automática de transacciones desde las
            notificaciones de tu banco por correo electrónico.
          </p>
          <Button
            onClick={handleGenerate}
            disabled={isPending}
            className={BRASS_BUTTON_CLASS}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Activar importación por correo
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-5" />
          Importar por correo
          <span className="bg-emerald-500/10 text-emerald-600 text-xs font-medium px-2 py-0.5 rounded-full ml-auto">
            Activo
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Email address */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Dirección de ingesta
          </Label>
          <div className="flex items-center gap-2">
            <code className="bg-muted px-3 py-1.5 rounded text-sm flex-1 truncate">
              {fullEmail}
            </code>
            <Button
              size="icon"
              variant="outline"
              onClick={handleCopy}
              className="shrink-0"
            >
              {copied ? (
                <Check className="size-4 text-emerald-600" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Crea una regla de reenvío en tu correo para que los mensajes de{" "}
            <code className="text-xs">
              alertasynotificaciones@an.notificacionesbancolombia.com
            </code>{" "}
            se envíen a esta dirección.
          </p>
        </div>

        {/* Default account */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Cuenta destino
          </Label>
          <Select
            value={address.account_id ?? ""}
            onValueChange={(val) =>
              handleUpdateSettings(val || null, address.auto_import)
            }
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona una cuenta" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Auto-import toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Importar automáticamente</Label>
            <p className="text-xs text-muted-foreground">
              {address.auto_import
                ? "Las transacciones se importan al llegar"
                : "Las transacciones quedan pendientes para revisión"}
            </p>
          </div>
          <Switch
            checked={address.auto_import}
            onCheckedChange={(checked) =>
              handleUpdateSettings(address.account_id, checked)
            }
            disabled={isPending}
          />
        </div>

        {/* Deactivate */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleDeactivate}
          disabled={isPending}
          className="text-destructive"
        >
          <PowerOff className="size-4" />
          Desactivar
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Add EmailIngestCard to settings page**

In `webapp/src/app/(dashboard)/settings/page.tsx`, add the import and data fetch. Add this import at the top:

```typescript
import { EmailIngestCard } from "@/components/settings/email-ingest-card";
import { getEmailIngestAddress } from "@/actions/email-ingest";
```

Add to the `Promise.all` that fetches tokens and accounts:

```typescript
const [tokensResult, { data: accounts }, ingestResult] = await Promise.all([
  getCaptureTokens(),
  supabase
    .from("accounts")
    .select("id, name, currency_code, account_type, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("display_order"),
  getEmailIngestAddress(),
]);

const ingestAddress = ingestResult.success ? ingestResult.data : null;
```

Add the `<EmailIngestCard>` component in the JSX, after the `IntegrationsCard`:

```tsx
<EmailIngestCard
  accounts={(accounts ?? []) as Account[]}
  initialAddress={ingestAddress}
/>
```

- [ ] **Step 3: Verify build**

Run: `cd webapp && pnpm build`

Expected: Build passes.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/settings/email-ingest-card.tsx webapp/src/app/\(dashboard\)/settings/page.tsx
git commit -m "feat(email-ingest): add settings UI for email ingestion"
```

---

## Task 6: Pending Email Transactions UI

**Files:**
- Create: `webapp/src/components/transactions/pending-email-transactions.tsx`
- Modify: `webapp/src/app/(dashboard)/transactions/page.tsx`

- [ ] **Step 1: Create PendingEmailTransactions component**

Create `webapp/src/components/transactions/pending-email-transactions.tsx`:

```typescript
"use client";

import { useState, useTransition } from "react";
import { Check, X, CheckCheck, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  approveEmailTransaction,
  dismissEmailTransaction,
  bulkApproveEmailTransactions,
} from "@/actions/email-ingest";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { PendingEmailTransaction } from "@/types/domain";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";

interface PendingEmailTransactionsProps {
  transactions: PendingEmailTransaction[];
}

export function PendingEmailTransactions({
  transactions: initialTransactions,
}: PendingEmailTransactionsProps) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  if (transactions.length === 0) return null;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleApprove(id: string) {
    startTransition(async () => {
      const result = await approveEmailTransaction(id);
      if (result.success || result.error?.includes("ya fue importada")) {
        setTransactions((prev) => prev.filter((t) => t.id !== id));
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    });
  }

  function handleDismiss(id: string) {
    startTransition(async () => {
      const result = await dismissEmailTransaction(id);
      if (result.success) {
        setTransactions((prev) => prev.filter((t) => t.id !== id));
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    });
  }

  function handleBulkApprove() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      await bulkApproveEmailTransactions(ids);
      setTransactions((prev) => prev.filter((t) => !selected.has(t.id)));
      setSelected(new Set());
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="size-4" />
          Pendientes por correo
          <span className="bg-amber-500/10 text-amber-600 text-xs font-medium px-2 py-0.5 rounded-full">
            {transactions.length}
          </span>
        </CardTitle>
        {selected.size > 0 && (
          <Button
            size="sm"
            onClick={handleBulkApprove}
            disabled={isPending}
            className={BRASS_BUTTON_CLASS}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCheck className="size-4" />
            )}
            Aprobar ({selected.size})
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {transactions.map((tx) => {
          const parsed = tx.parsed_data as {
            direction: string;
            amount: number;
            merchant: string | null;
            destination: string | null;
            transaction_date: string;
            pattern_type: string;
          };
          const label =
            parsed.merchant ?? parsed.destination ?? "Transacción";

          return (
            <div
              key={tx.id}
              className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                checked={selected.has(tx.id)}
                onCheckedChange={() => toggleSelect(tx.id)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{label}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(parsed.transaction_date)} &middot;{" "}
                  {parsed.pattern_type}
                </p>
              </div>
              <span
                className={`text-sm font-medium ${parsed.direction === "INFLOW" ? "text-emerald-600" : ""}`}
              >
                {parsed.direction === "INFLOW" ? "+" : "-"}
                {formatCurrency(parsed.amount, "COP")}
              </span>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleApprove(tx.id)}
                  disabled={isPending}
                  className="size-8"
                >
                  <Check className="size-4 text-emerald-600" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDismiss(tx.id)}
                  disabled={isPending}
                  className="size-8"
                >
                  <X className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Add to transactions page**

Read the current transactions page to find the right insertion point. Add at the top of the page (before the transaction list):

Import:
```typescript
import { getPendingEmailTransactions } from "@/actions/email-ingest";
import { PendingEmailTransactions } from "@/components/transactions/pending-email-transactions";
```

Fetch pending transactions in the page's data loading:
```typescript
const pendingResult = await getPendingEmailTransactions();
const pendingTransactions = pendingResult.success ? pendingResult.data : [];
```

Render above the main transaction list:
```tsx
<PendingEmailTransactions transactions={pendingTransactions} />
```

- [ ] **Step 3: Verify build**

Run: `cd webapp && pnpm build`

Expected: Build passes.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/transactions/pending-email-transactions.tsx webapp/src/app/\(dashboard\)/transactions/
git commit -m "feat(email-ingest): add pending email transactions review UI"
```

---

## Task 7: Integration Test + Build Verification

**Files:**
- No new files — this task verifies everything works end to end.

- [ ] **Step 1: Run all parser tests**

Run: `cd webapp && npx vitest run src/lib/parsers/__tests__/bancolombia-email.test.ts`

Expected: All tests pass.

- [ ] **Step 2: Run full build**

Run: `cd webapp && pnpm build`

Expected: Clean build, no type errors.

- [ ] **Step 3: Final commit with any fixes**

If any fixes were needed, commit them:
```bash
git add -A
git commit -m "fix(email-ingest): address build issues from integration"
```

---

## Post-Implementation Notes

### Resend Setup (manual, not code)
1. Add MX records for `ingest.zeta.yourdomain.com` pointing to Resend's inbound servers
2. Configure inbound webhook URL in Resend dashboard: `https://zeta.yourdomain.com/api/webhooks/email-ingest`
3. Copy the webhook signing secret to `RESEND_WEBHOOK_SECRET` env var
4. Add `NEXT_PUBLIC_EMAIL_INGEST_DOMAIN` env var (e.g., `ingest.zeta.yourdomain.com`)

### Idempotency Cross-Source Testing
Once you have both email samples and PDF statements for overlapping periods, create a test that:
1. Parses a Bancolombia email notification
2. Parses the same transaction from a PDF statement
3. Computes idempotency keys for both
4. Verifies they match (or documents where normalization is needed)
