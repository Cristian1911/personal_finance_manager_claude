# "Hacer recurrente" + remove `is_subscription` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Hacer recurrente" CTA on `/transactions/[id]` that promotes a one-off transaction to a `recurring_templates` row pre-filled with its data and auto-links the source tx to the generated occurrence. Remove the dead `is_subscription` toggle from all three transaction forms and every write path. Zero schema migrations.

**Architecture:** Primitives first — extend `RecurringForm`/`RecurringFormDialog` to accept `initialValues` + `actionOverride` so a non-edit dialog can be opened with pre-filled state and a custom server action. Add `createRecurringTemplateFromTransaction` that wraps the existing `createRecurringTemplate` logic and adds a single `linkTransactionToOccurrence` call. Mount a client-only `PromoteToRecurringButton` in the tx detail page's `PageHero.actions`. In parallel, delete every reference to `is_subscription` from the webapp (form UI, form state, hidden input, action param, validator, API route payloads) — the DB column remains nullable for now (drop is a follow-up migration).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, `lucide-react`, Vitest for the server action, Playwright MCP for manual flow verification at 390×844.

**Spec:** `docs/superpowers/specs/2026-04-17-promote-to-recurring-design.md`

---

## File Structure

**New:**
- `webapp/src/components/transactions/promote-to-recurring-button.tsx` — Client CTA that opens the prefilled `RecurringFormDialog` (or renders an inert "Ya es recurrente" badge).
- `webapp/src/actions/__tests__/create-recurring-from-transaction.test.ts` — Vitest suite for the new server action (happy path, debt-account missing-source, already-linked tx).

**Modified:**
- `webapp/src/actions/recurring-templates.ts` — add `createRecurringTemplateFromTransaction` (wraps `createRecurringTemplate` body + one `linkTransactionToOccurrence` call).
- `webapp/src/components/recurring/recurring-form.tsx` — accept optional `initialValues?: Partial<RecurringTemplate>` and `actionOverride?: typeof createRecurringTemplate`. Seed state from `initialValues` when `template` is absent. Use `actionOverride` in place of `createRecurringTemplate`.
- `webapp/src/components/recurring/recurring-form-dialog.tsx` — pass `initialValues` + `actionOverride` through to `RecurringForm`.
- `webapp/src/app/(dashboard)/transactions/[id]/page.tsx` — mount `PromoteToRecurringButton` in `PageHero.actions` (needs `accounts` + `categories` — already fetched in the same file).
- `webapp/src/components/transactions/transaction-form.tsx` — delete `isSubscription` state (line 100-102), `<input hidden name="is_subscription">` (line 228-232), and the Switch block (line 301-315). Drop unused `Switch` import + `transaction.is_subscription` access.
- `webapp/src/components/mobile/mobile-transaction-form.tsx` — delete `isSubscription` state (line 140), hidden input (line 220-224), and the Switch block (line 326-340). Drop unused `Switch` import.
- `webapp/src/components/mobile/voice-capture-sheet.tsx` — delete line 244 (`formData.set("is_subscription", "false")`).
- `webapp/src/actions/transactions.ts` — drop `is_subscription?: boolean` from `CreateTransactionParams` (line 40), drop `is_subscription: params.is_subscription ?? false` from insert payload (line 390), drop `is_subscription: formData.get("is_subscription")` from the 3 validator calls (lines 656, 740, 799).
- `webapp/src/lib/validators/transaction.ts` — drop `is_subscription: formBoolean` (line 23).
- `webapp/src/app/api/capture/route.ts` — drop `is_subscription: false` (line 171).
- `webapp/src/app/api/mcp/transactions/route.ts` — drop `is_subscription` from select columns (line 26) and from the response mapping (line 61).
- `webapp/src/app/api/webhooks/email-ingest/route.ts` — drop `is_subscription: false` (line 736).
- `webapp/src/app/api/webhooks/telegram/route.ts` — drop `is_subscription: false` (line 246).
- `webapp/src/actions/email-ingest.ts` — drop `is_subscription: false` (lines 129, 736).

---

## Task 1: Extend `RecurringForm` to accept `initialValues` + `actionOverride`

**Files:**
- Modify: `webapp/src/components/recurring/recurring-form.tsx`

- [ ] **Step 1.1: Widen props**

Edit the `RecurringForm` function's prop type (around line 39-49). Current shape:

```tsx
export function RecurringForm({
  template,
  accounts,
  categories,
  onSuccess,
}: {
  template?: RecurringTemplate;
  accounts: Account[];
  categories: CategoryWithChildren[];
  onSuccess?: () => void;
}) {
```

Change to:

```tsx
import type { ActionResult } from "@/types/actions";

type RecurringFormAction = (
  prevState: ActionResult<RecurringTemplate>,
  formData: FormData,
) => Promise<ActionResult<RecurringTemplate>>;

export function RecurringForm({
  template,
  initialValues,
  actionOverride,
  accounts,
  categories,
  onSuccess,
}: {
  template?: RecurringTemplate;
  /** Seed state when creating a new template with known data (e.g. promoting a transaction). Ignored when `template` is present. */
  initialValues?: Partial<RecurringTemplate>;
  /** Replace the default createRecurringTemplate action. Used to call a specialized action (e.g. createRecurringTemplateFromTransaction) while keeping all UI behavior identical. */
  actionOverride?: RecurringFormAction;
  accounts: Account[];
  categories: CategoryWithChildren[];
  onSuccess?: () => void;
}) {
```

(The `ActionResult` import already exists at line 27; do not duplicate it. Only add the `RecurringFormAction` local type alias.)

- [ ] **Step 1.2: Wire `actionOverride` into the action dispatcher**

Current (lines 50-52):

```tsx
  const action = template
    ? updateRecurringTemplate.bind(null, template.id)
    : createRecurringTemplate;
```

Change to:

```tsx
  const action = template
    ? updateRecurringTemplate.bind(null, template.id)
    : (actionOverride ?? createRecurringTemplate);
```

- [ ] **Step 1.3: Seed every `useState` from `initialValues` when `template` is absent**

Update each `useState` in the form body (lines 67-91) to prefer `template` → `initialValues` → default. Replace the block with:

```tsx
  const defaultStartDate = new Date().toISOString().split("T")[0];
  const seed = template ?? initialValues ?? null;

  const [direction, setDirection] = useState<TransactionDirection>(
    (seed?.direction as TransactionDirection | undefined) ?? "OUTFLOW"
  );
  const [accountId, setAccountId] = useState<string>(
    seed?.account_id ?? ""
  );
  const [startDate, setStartDate] = useState<string>(
    seed?.start_date ?? defaultStartDate
  );
  const [endDate, setEndDate] = useState<string | null>(
    seed?.end_date ?? null
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    seed?.category_id ?? null
  );
  const [frequency, setFrequency] = useState<string>(
    seed?.frequency ?? "MONTHLY"
  );
  const [transferSourceAccountId, setTransferSourceAccountId] = useState<string>(
    seed?.transfer_source_account_id ?? ""
  );
  const initialSubPayments: SubPayment[] = parseSubPayments(seed?.sub_payments) ?? [];
  const [subPayments, setSubPayments] = useState<SubPayment[]>(initialSubPayments);
  const [useSubPayments, setUseSubPayments] = useState(initialSubPayments.length > 0);
```

- [ ] **Step 1.4: Seed the `defaultValue` on uncontrolled inputs**

Four inputs read `template?.<field>` directly as `defaultValue`. Swap each to `seed?.<field>`:

Search for `defaultValue={template?.` in `recurring-form.tsx`. Expected hits (roughly line 171, 211, plus day_of_month and merchant/description fields). Replace each occurrence's `template?.` with `seed?.`. Do the same for any `template?.` read in the JSX body that feeds a defaultValue (grep within the file to confirm coverage).

- [ ] **Step 1.5: Build gate**

Run: `cd webapp && pnpm build`
Expected: `✓ Compiled successfully`. The refactor is type-safe — if a reference to `template?` was missed and the type narrowing now fails, fix it by reading from `seed?` instead.

- [ ] **Step 1.6: Commit**

```bash
git add webapp/src/components/recurring/recurring-form.tsx
git commit -m "feat(recurrentes): RecurringForm accepts initialValues + actionOverride

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Extend `RecurringFormDialog` passthrough

**Files:**
- Modify: `webapp/src/components/recurring/recurring-form-dialog.tsx`

- [ ] **Step 2.1: Widen props**

Current (lines 16-31):

```tsx
export function RecurringFormDialog({
  template,
  accounts,
  categories,
  trigger,
  controlledOpen,
  onClose,
}: {
  template?: RecurringTemplate;
  accounts: Account[];
  categories: CategoryWithChildren[];
  trigger?: React.ReactNode;
  controlledOpen?: boolean;
  onClose?: () => void;
}) {
```

Change to:

```tsx
import type { ActionResult } from "@/types/actions";

type RecurringFormAction = (
  prevState: ActionResult<RecurringTemplate>,
  formData: FormData,
) => Promise<ActionResult<RecurringTemplate>>;

export function RecurringFormDialog({
  template,
  initialValues,
  actionOverride,
  accounts,
  categories,
  trigger,
  controlledOpen,
  onClose,
}: {
  template?: RecurringTemplate;
  initialValues?: Partial<RecurringTemplate>;
  actionOverride?: RecurringFormAction;
  accounts: Account[];
  categories: CategoryWithChildren[];
  trigger?: React.ReactNode;
  controlledOpen?: boolean;
  onClose?: () => void;
}) {
```

- [ ] **Step 2.2: Pass the new props through**

Current (lines 57-62):

```tsx
        <RecurringForm
          template={template}
          accounts={accounts}
          categories={categories}
          onSuccess={() => setOpen(false)}
        />
```

Change to:

```tsx
        <RecurringForm
          template={template}
          initialValues={initialValues}
          actionOverride={actionOverride}
          accounts={accounts}
          categories={categories}
          onSuccess={() => setOpen(false)}
        />
```

- [ ] **Step 2.3: Build gate**

Run: `cd webapp && pnpm build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 2.4: Commit**

```bash
git add webapp/src/components/recurring/recurring-form-dialog.tsx
git commit -m "feat(recurrentes): RecurringFormDialog passes initialValues + actionOverride

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Add `createRecurringTemplateFromTransaction` server action

**Files:**
- Modify: `webapp/src/actions/recurring-templates.ts`
- Create: `webapp/src/actions/__tests__/create-recurring-from-transaction.test.ts`

- [ ] **Step 3.1: Add the action**

Open `webapp/src/actions/recurring-templates.ts`. Add at the top of the file (after the existing imports):

```tsx
import { linkTransactionToOccurrence } from "@/actions/occurrences";
```

Confirm `linkTransactionToOccurrence` is exported from `webapp/src/actions/occurrences.ts` (it is — see line 745 in that file).

Insert the new action immediately after `createRecurringTemplate` (currently ends around line 332 with the `updateTag` calls + `return { success: true, data }`). Paste:

```tsx
export async function createRecurringTemplateFromTransaction(
  transactionId: string,
  _prevState: ActionResult<RecurringTemplate>,
  formData: FormData,
): Promise<ActionResult<RecurringTemplate>> {
  const { supabase, user } = await getAuthenticatedClient();

  if (!user) return { success: false, error: "No autenticado" };

  // 1. Load the source transaction first — fail fast if it's gone or
  //    already linked to an occurrence.
  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .select("id, account_id, amount, direction, transaction_date, recurring_occurrence_id")
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (txErr || !tx) {
    return { success: false, error: "Transacción no encontrada" };
  }
  if (tx.recurring_occurrence_id) {
    return { success: false, error: "Esta transacción ya está vinculada a una recurrente." };
  }

  // 2. Parse + validate — identical to createRecurringTemplate.
  const parsed = recurringTemplateSchema.safeParse({
    account_id: formData.get("account_id"),
    transfer_source_account_id: formData.get("transfer_source_account_id") || undefined,
    amount: formData.get("amount"),
    currency_code: formData.get("currency_code"),
    direction: formData.get("direction"),
    frequency: formData.get("frequency"),
    merchant_name: formData.get("merchant_name"),
    description: formData.get("description") || undefined,
    category_id: formData.get("category_id") || undefined,
    day_of_month: formData.get("day_of_month") || undefined,
    day_of_week: formData.get("day_of_week") || undefined,
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date") || undefined,
    sub_payments: formData.get("sub_payments") || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { sub_payments, ...payload } = parsed.data;
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, account_type")
    .eq("id", payload.account_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (accountError || !account) {
    return { success: false, error: "Cuenta inválida para este usuario." };
  }

  if (DEBT_ACCOUNT_TYPES.has(account.account_type)) {
    payload.direction = "INFLOW";
    payload.category_id = payload.category_id ?? getDebtPaymentCategoryId(account.account_type);
    if (!payload.transfer_source_account_id) {
      return { success: false, error: "Selecciona la cuenta origen para el pago de deuda." };
    }
    if (payload.transfer_source_account_id === payload.account_id) {
      return { success: false, error: "La cuenta origen no puede ser la misma cuenta de deuda." };
    }
  } else {
    payload.transfer_source_account_id = null;
  }

  const subPaymentsValue = sub_payments && sub_payments.length > 0
    ? (sub_payments as unknown as Database["public"]["Tables"]["recurring_transaction_templates"]["Row"]["sub_payments"])
    : null;

  // 3. Insert the template.
  const { data, error } = await supabase
    .from("recurring_transaction_templates")
    .insert({
      user_id: user.id,
      ...payload,
      sub_payments: subPaymentsValue,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  // 4. Generate occurrences, then link the source tx to the current-period
  //    occurrence (if the matcher finds one). linkTransactionToOccurrence
  //    internally calls findMatchingOccurrence + markOccurrencePaid, which
  //    also flips the occurrence to status="paid". If no occurrence matches,
  //    it's a no-op — the user can link later via the recurring UI.
  await ensureCurrentOccurrences();
  await linkTransactionToOccurrence(
    tx.account_id,
    tx.transaction_date,
    tx.amount,
    tx.direction,
    tx.id,
  );

  updateTag("recurring");
  updateTag("occurrences");
  updateTag("dashboard:hero");
  updateTag("attention");
  updateTag("transactions");
  return { success: true, data };
}
```

- [ ] **Step 3.2: Build gate**

Run: `cd webapp && pnpm build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 3.3: Write the test file**

Create `webapp/src/actions/__tests__/create-recurring-from-transaction.test.ts`:

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";

// Shared mocks — rebuilt per test via the helpers below.
const { getAuthenticatedClient } = vi.hoisted(() => ({
  getAuthenticatedClient: vi.fn(),
}));
const { ensureCurrentOccurrences, linkTransactionToOccurrence } = vi.hoisted(() => ({
  ensureCurrentOccurrences: vi.fn(),
  linkTransactionToOccurrence: vi.fn(),
}));
const { updateTag } = vi.hoisted(() => ({
  updateTag: vi.fn(),
}));

vi.mock("@/lib/supabase/auth", () => ({ getAuthenticatedClient }));
vi.mock("@/actions/occurrences", () => ({
  ensureCurrentOccurrences,
  linkTransactionToOccurrence,
}));
vi.mock("next/cache", () => ({
  updateTag,
  revalidateTag: vi.fn(),
  unstable_cacheTag: vi.fn(),
  unstable_cacheLife: vi.fn(),
}));

import { createRecurringTemplateFromTransaction } from "@/actions/recurring-templates";

const USER = { id: "user-1" };

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    account_id: "acc-savings",
    amount: "50000",
    currency_code: "COP",
    direction: "OUTFLOW",
    frequency: "MONTHLY",
    merchant_name: "Netflix",
    start_date: "2026-04-17",
  };
  for (const [k, v] of Object.entries({ ...defaults, ...overrides })) fd.set(k, v);
  return fd;
}

function buildSupabase({
  tx,
  account,
  insertedTemplate,
  txError,
  accountError,
  insertError,
}: {
  tx: Record<string, unknown> | null;
  account?: { id: string; account_type: string } | null;
  insertedTemplate?: Record<string, unknown>;
  txError?: { message: string };
  accountError?: { message: string };
  insertError?: { message: string };
}) {
  const tables: Record<string, unknown> = {
    transactions: {
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: tx, error: txError ?? null }),
          }),
        }),
      }),
    },
    accounts: {
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: account ?? null, error: accountError ?? null }),
          }),
        }),
      }),
    },
    recurring_transaction_templates: {
      insert: () => ({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: insertedTemplate ?? { id: "tpl-1" },
              error: insertError ?? null,
            }),
        }),
      }),
    },
  };
  return { from: (t: string) => tables[t] };
}

describe("createRecurringTemplateFromTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: inserts template and calls linkTransactionToOccurrence", async () => {
    const tx = {
      id: "tx-1",
      account_id: "acc-savings",
      amount: 50000,
      direction: "OUTFLOW",
      transaction_date: "2026-04-17",
      recurring_occurrence_id: null,
    };
    getAuthenticatedClient.mockResolvedValue({
      user: USER,
      supabase: buildSupabase({
        tx,
        account: { id: "acc-savings", account_type: "BANK" },
      }),
    });

    const result = await createRecurringTemplateFromTransaction(
      "tx-1",
      { success: false, error: "" },
      buildFormData(),
    );

    expect(result.success).toBe(true);
    expect(ensureCurrentOccurrences).toHaveBeenCalledOnce();
    expect(linkTransactionToOccurrence).toHaveBeenCalledWith(
      "acc-savings",
      "2026-04-17",
      50000,
      "OUTFLOW",
      "tx-1",
    );
    expect(updateTag).toHaveBeenCalledWith("recurring");
    expect(updateTag).toHaveBeenCalledWith("transactions");
  });

  it("rejects when the source transaction is already linked to an occurrence", async () => {
    const tx = {
      id: "tx-1",
      account_id: "acc-savings",
      amount: 50000,
      direction: "OUTFLOW",
      transaction_date: "2026-04-17",
      recurring_occurrence_id: "occ-existing",
    };
    getAuthenticatedClient.mockResolvedValue({
      user: USER,
      supabase: buildSupabase({ tx }),
    });

    const result = await createRecurringTemplateFromTransaction(
      "tx-1",
      { success: false, error: "" },
      buildFormData(),
    );

    expect(result).toEqual({
      success: false,
      error: "Esta transacción ya está vinculada a una recurrente.",
    });
    expect(linkTransactionToOccurrence).not.toHaveBeenCalled();
  });

  it("rejects debt-account creation without transfer_source_account_id", async () => {
    const tx = {
      id: "tx-1",
      account_id: "acc-card",
      amount: 50000,
      direction: "INFLOW",
      transaction_date: "2026-04-17",
      recurring_occurrence_id: null,
    };
    getAuthenticatedClient.mockResolvedValue({
      user: USER,
      supabase: buildSupabase({
        tx,
        account: { id: "acc-card", account_type: "CREDIT_CARD" },
      }),
    });

    const result = await createRecurringTemplateFromTransaction(
      "tx-1",
      { success: false, error: "" },
      buildFormData({ account_id: "acc-card", direction: "INFLOW" }),
    );

    expect(result.success).toBe(false);
    expect(result).toMatchObject({
      error: "Selecciona la cuenta origen para el pago de deuda.",
    });
    expect(linkTransactionToOccurrence).not.toHaveBeenCalled();
  });

  it("rejects when the source transaction is missing", async () => {
    getAuthenticatedClient.mockResolvedValue({
      user: USER,
      supabase: buildSupabase({ tx: null }),
    });

    const result = await createRecurringTemplateFromTransaction(
      "tx-missing",
      { success: false, error: "" },
      buildFormData(),
    );

    expect(result).toEqual({
      success: false,
      error: "Transacción no encontrada",
    });
    expect(linkTransactionToOccurrence).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3.4: Run the tests**

Run: `cd webapp && pnpm vitest run src/actions/__tests__/create-recurring-from-transaction.test.ts`
Expected: 4 passing.

If a mock signature mismatches because `recurringTemplateSchema` validates a field not covered by `buildFormData`, add it to the `defaults` map. Do **not** loosen the schema.

- [ ] **Step 3.5: Commit**

```bash
git add webapp/src/actions/recurring-templates.ts webapp/src/actions/__tests__/create-recurring-from-transaction.test.ts
git commit -m "feat(recurrentes): createRecurringTemplateFromTransaction action + tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Build `PromoteToRecurringButton` component

**Files:**
- Create: `webapp/src/components/transactions/promote-to-recurring-button.tsx`

- [ ] **Step 4.1: Write the component**

Create `webapp/src/components/transactions/promote-to-recurring-button.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RecurringFormDialog } from "@/components/recurring/recurring-form-dialog";
import { createRecurringTemplateFromTransaction } from "@/actions/recurring-templates";
import { GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import type {
  Account,
  CategoryWithChildren,
  RecurringTemplate,
} from "@/types/domain";
import type { Database } from "@/types/database";

type TxRow = Database["public"]["Views"]["transactions"]["Row"];

type PromoteToRecurringButtonProps = {
  transaction: Pick<
    TxRow,
    | "id"
    | "account_id"
    | "amount"
    | "currency_code"
    | "direction"
    | "merchant_name"
    | "clean_description"
    | "category_id"
    | "transaction_date"
    | "recurring_occurrence_id"
  >;
  accounts: Account[];
  categories: CategoryWithChildren[];
};

function prefillFromTransaction(
  tx: PromoteToRecurringButtonProps["transaction"],
): Partial<RecurringTemplate> {
  const txDate = new Date(`${tx.transaction_date}T12:00:00`);
  const dayOfMonth = txDate.getDate();
  const merchant = tx.merchant_name ?? tx.clean_description ?? "";
  const hasDistinctDescription =
    tx.clean_description && tx.clean_description !== tx.merchant_name;
  return {
    account_id: tx.account_id,
    amount: tx.amount,
    currency_code: tx.currency_code,
    direction: tx.direction,
    merchant_name: merchant,
    description: hasDistinctDescription ? tx.clean_description ?? null : null,
    category_id: tx.category_id,
    frequency: "MONTHLY",
    start_date: tx.transaction_date,
    day_of_month: dayOfMonth,
    day_of_week: null,
    end_date: null,
    transfer_source_account_id: null,
    sub_payments: null,
  };
}

export function PromoteToRecurringButton({
  transaction,
  accounts,
  categories,
}: PromoteToRecurringButtonProps) {
  const [open, setOpen] = useState(false);

  const actionOverride = useMemo(
    () => createRecurringTemplateFromTransaction.bind(null, transaction.id),
    [transaction.id],
  );

  const initialValues = useMemo(
    () => prefillFromTransaction(transaction),
    [transaction],
  );

  if (transaction.recurring_occurrence_id) {
    return (
      <Badge
        variant="secondary"
        className="bg-white/5 text-muted-foreground hover:bg-white/5"
      >
        <CalendarClock className="mr-1.5 size-3.5" />
        Ya es recurrente
      </Badge>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={GHOST_BUTTON_CLASS}
        onClick={() => setOpen(true)}
      >
        <CalendarClock className="size-4" />
        Hacer recurrente
      </Button>
      <RecurringFormDialog
        controlledOpen={open}
        onClose={() => setOpen(false)}
        trigger={null}
        initialValues={initialValues}
        actionOverride={actionOverride}
        accounts={accounts}
        categories={categories}
      />
    </>
  );
}
```

Notes on the choices:
- `trigger={null}` suppresses the default "Nueva recurrente" trigger button — we drive the dialog entirely via `controlledOpen`.
- `GHOST_BUTTON_CLASS` matches the existing `DeleteTransactionButton` styling family so the hero action bar stays cohesive.
- The prefilled `description` only flows through when it differs from `merchant_name`, avoiding noise like `merchant="Netflix" description="Netflix"`.

- [ ] **Step 4.2: Build gate**

Run: `cd webapp && pnpm build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 4.3: Commit**

```bash
git add webapp/src/components/transactions/promote-to-recurring-button.tsx
git commit -m "feat(transactions): PromoteToRecurringButton client CTA

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Mount the CTA on `/transactions/[id]`

**Files:**
- Modify: `webapp/src/app/(dashboard)/transactions/[id]/page.tsx`

- [ ] **Step 5.1: Verify the page already loads `accounts` + `categories`**

Run: `grep -n "getAccounts\|getCategories" webapp/src/app/\(dashboard\)/transactions/\[id\]/page.tsx`
Expected: both are imported at the top of the file (lines 7-8) and called somewhere in the page body. If the page already calls them inside a `Promise.all`, reuse the same variables. If one is missing, add it to the page's data-loading block — do not add a new N+1 on each render.

- [ ] **Step 5.2: Add the CTA to the hero actions slot**

Find the `PageHero` JSX (around line 147). Its `actions` prop currently contains:

```tsx
        actions={
          <>
            <Suspense fallback={<Skeleton className="h-9 w-20 rounded-md" />}>
              <TransactionEditAction transaction={tx} />
            </Suspense>
            <DeleteTransactionButton transactionId={tx.id} />
          </>
        }
```

Change to:

```tsx
        actions={
          <>
            <Suspense fallback={<Skeleton className="h-9 w-20 rounded-md" />}>
              <TransactionEditAction transaction={tx} />
            </Suspense>
            <PromoteToRecurringButton
              transaction={tx}
              accounts={accounts}
              categories={categories}
            />
            <DeleteTransactionButton transactionId={tx.id} />
          </>
        }
```

Add the import at the top of the file (below the existing transaction-scoped imports):

```tsx
import { PromoteToRecurringButton } from "@/components/transactions/promote-to-recurring-button";
```

The `accounts` + `categories` props must already be in scope — verify in Step 5.1. If the page happens to lazy-load them inside `<Suspense>`, lift them up into the main `Promise.all` for this page (still cached via `"use cache"` on the underlying actions, so no query cost).

- [ ] **Step 5.3: Build gate**

Run: `cd webapp && pnpm build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 5.4: Commit**

```bash
git add webapp/src/app/\(dashboard\)/transactions/\[id\]/page.tsx
git commit -m "feat(transactions): mount Hacer recurrente CTA on detail page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Remove `is_subscription` from the webapp transaction form

**Files:**
- Modify: `webapp/src/components/transactions/transaction-form.tsx`

- [ ] **Step 6.1: Delete the state hook**

Remove lines 100-102:

```tsx
  const [isSubscription, setIsSubscription] = useState(
    transaction?.is_subscription ?? false
  );
```

- [ ] **Step 6.2: Delete the hidden input**

Remove lines 228-232:

```tsx
      <input
        type="hidden"
        name="is_subscription"
        value={isSubscription ? "true" : "false"}
      />
```

- [ ] **Step 6.3: Delete the Switch block**

Remove lines 301-315 (the "Marcar como suscripción" block):

```tsx
      <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
        <div className="space-y-0.5 pr-4">
          <Label htmlFor="is_subscription" className="cursor-pointer">
            Marcar como suscripción
          </Label>
          <p className="text-xs text-muted-foreground">
            Úsalo para pagos periódicos como streaming, software o membresías.
          </p>
        </div>
        <Switch
          id="is_subscription"
          checked={isSubscription}
          onCheckedChange={setIsSubscription}
        />
      </div>
```

- [ ] **Step 6.4: Drop the now-unused Switch import**

Check the top of the file. If `Switch` (from `@/components/ui/switch`) is no longer referenced anywhere else in this file, delete the import.

Run: `grep -c "Switch" webapp/src/components/transactions/transaction-form.tsx`
Expected: 0 after removal, or a number matching unrelated text like `"switching"` (unlikely).

- [ ] **Step 6.5: Build gate**

Run: `cd webapp && pnpm build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 6.6: Commit**

```bash
git add webapp/src/components/transactions/transaction-form.tsx
git commit -m "refactor(transactions): drop inert is_subscription Switch from web form

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Remove `is_subscription` from mobile form + voice capture

**Files:**
- Modify: `webapp/src/components/mobile/mobile-transaction-form.tsx`
- Modify: `webapp/src/components/mobile/voice-capture-sheet.tsx`

- [ ] **Step 7.1: Delete the mobile form state hook**

In `webapp/src/components/mobile/mobile-transaction-form.tsx` remove line 140:

```tsx
  const [isSubscription, setIsSubscription] = useState(false);
```

- [ ] **Step 7.2: Delete the mobile hidden input**

Remove lines 220-224:

```tsx
      <input
        type="hidden"
        name="is_subscription"
        value={isSubscription ? "true" : "false"}
      />
```

- [ ] **Step 7.3: Delete the mobile Switch block**

Remove lines 326-340:

```tsx
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="mobile-is_subscription" className="cursor-pointer">
                Marcar como suscripción
              </Label>
              <p className="text-xs text-muted-foreground">
                Para cobros periódicos como streaming o software.
              </p>
            </div>
            <Switch
              id="mobile-is_subscription"
              checked={isSubscription}
              onCheckedChange={setIsSubscription}
            />
          </div>
```

- [ ] **Step 7.4: Drop unused imports in the mobile form**

Run: `grep -c "Switch" webapp/src/components/mobile/mobile-transaction-form.tsx`
If 0, delete the `Switch` import at the top of the file.

- [ ] **Step 7.5: Delete the voice-capture write**

In `webapp/src/components/mobile/voice-capture-sheet.tsx` remove line 244:

```tsx
    formData.set("is_subscription", "false");
```

- [ ] **Step 7.6: Build gate**

Run: `cd webapp && pnpm build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 7.7: Commit**

```bash
git add webapp/src/components/mobile/mobile-transaction-form.tsx webapp/src/components/mobile/voice-capture-sheet.tsx
git commit -m "refactor(mobile): drop is_subscription from mobile tx form + voice capture

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Remove `is_subscription` from server actions, validators, and API routes

**Files:**
- Modify: `webapp/src/actions/transactions.ts`
- Modify: `webapp/src/lib/validators/transaction.ts`
- Modify: `webapp/src/app/api/capture/route.ts`
- Modify: `webapp/src/app/api/mcp/transactions/route.ts`
- Modify: `webapp/src/app/api/webhooks/email-ingest/route.ts`
- Modify: `webapp/src/app/api/webhooks/telegram/route.ts`
- Modify: `webapp/src/actions/email-ingest.ts`

- [ ] **Step 8.1: `actions/transactions.ts` — drop the param**

Open `webapp/src/actions/transactions.ts`. Remove line 40 (`is_subscription?: boolean;`) from `CreateTransactionParams`.

- [ ] **Step 8.2: `actions/transactions.ts` — drop the insert field**

Remove line 390 (`is_subscription: params.is_subscription ?? false,`) from the insert payload inside `createTransaction`.

- [ ] **Step 8.3: `actions/transactions.ts` — drop the three validator-input sites**

Three form-handling functions each `safeParse` a form payload that includes `is_subscription: formData.get("is_subscription")`. Remove that property on lines 656, 740, and 799 (use grep to confirm exact line numbers after earlier edits have possibly shifted them).

Run: `grep -n "is_subscription" webapp/src/actions/transactions.ts`
Expected: no matches.

- [ ] **Step 8.4: `validators/transaction.ts`**

Remove line 23 (`is_subscription: formBoolean,`) from the schema.

Run: `grep -n "is_subscription" webapp/src/lib/validators/transaction.ts`
Expected: no matches.

- [ ] **Step 8.5: API routes**

Delete the single `is_subscription: false` line from each of:

- `webapp/src/app/api/capture/route.ts:171`
- `webapp/src/app/api/webhooks/email-ingest/route.ts:736`
- `webapp/src/app/api/webhooks/telegram/route.ts:246`
- `webapp/src/actions/email-ingest.ts:129` and `:736`

In `webapp/src/app/api/mcp/transactions/route.ts`:
- Remove `is_subscription,` from the select columns string (line 26).
- Remove `is_subscription: tx.is_subscription,` from the response mapping (line 61).

- [ ] **Step 8.6: Verify `is_subscription` is gone from all source files**

Run: `grep -rn "is_subscription" webapp/src/`
Expected: only matches in `webapp/src/types/database.ts` (the generated types — we keep the column for now). No matches in `src/actions/`, `src/lib/`, `src/components/`, or `src/app/`.

- [ ] **Step 8.7: Build gate**

Run: `cd webapp && pnpm build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 8.8: Commit**

```bash
git add webapp/src/actions/transactions.ts webapp/src/lib/validators/transaction.ts webapp/src/app/api/capture/route.ts webapp/src/app/api/mcp/transactions/route.ts webapp/src/app/api/webhooks/email-ingest/route.ts webapp/src/app/api/webhooks/telegram/route.ts webapp/src/actions/email-ingest.ts
git commit -m "refactor: drop is_subscription from actions, validators, and API routes

Column stays nullable in DB for now — drop is a follow-up migration.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Manual verification pass

- [ ] **Step 9.1: Dev server**

Run: `lsof -i :3000 -P -sTCP:LISTEN -t >/dev/null || (cd webapp && pnpm dev &)`
Wait ~5s.

- [ ] **Step 9.2: Tx detail happy path (non-debt account)**

Using the Playwright MCP at 390×844:

1. Navigate to `/transactions/<some-outflow-tx-id>` (pick any OUTFLOW tx with a merchant set).
2. Confirm the "Hacer recurrente" button is visible in the hero actions bar.
3. Click it — dialog opens with fields pre-filled: merchant, amount, category, account, frequency = Mensual.
4. Change nothing. Submit.
5. Expect success — dialog closes.
6. Reload the page. Expect the CTA to be replaced by the muted "Ya es recurrente" badge.
7. Navigate to `/recurrentes`. Expect the new template to appear in the list.

Capture a screenshot at each step. Save under `audit/2026-04-17-promote-to-recurring/`.

- [ ] **Step 9.3: Tx detail debt-account path**

1. Navigate to `/transactions/<some-INFLOW-to-a-credit-card-tx-id>`.
2. Click "Hacer recurrente".
3. Dialog opens. Direction is forced to INFLOW (read-only label: "Abono a deuda"). The "Cuenta origen" field is empty — the form's existing validation requires it.
4. Try to submit without picking a source → expect form error "Selecciona la cuenta origen para el pago de deuda."
5. Pick a bank account as source → submit → success.

- [ ] **Step 9.4: Already-linked guard**

Revisit the tx from Step 9.2 (now linked). Confirm:
- Hero shows the "Ya es recurrente" badge (not the button).
- Directly calling the server action a second time would fail — verified via the unit test in Task 3, no UI action needed.

- [ ] **Step 9.5: Form removals**

1. Visit `/transactions/new` (desktop form) → confirm no "Marcar como suscripción" Switch.
2. Visit mobile tx form (via the FAB on mobile shell) → confirm no Switch.
3. Submit a manual tx with account + amount + merchant → confirm save succeeds (no 400 from missing `is_subscription`).

- [ ] **Step 9.6: Build gate**

Run: `cd webapp && pnpm build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 9.7: Test gate**

Run: `cd webapp && pnpm vitest run`
Expected: all tests pass, including the 4 new cases in `create-recurring-from-transaction.test.ts`.

- [ ] **Step 9.8: Lint gate**

Run: `cd webapp && pnpm lint`
Expected: clean (no new warnings).

- [ ] **Step 9.9: Commit (captures only)**

`audit/` is gitignored — captures stay on disk, no git action.

---

## Task 10: Review gate + PR

- [ ] **Step 10.1: Parallel — server-action-reviewer + zetas-front-guy + perf-auditor**

Spawn all three in a single message with the diff scope. Prompts:

**server-action-reviewer:**
- Audit `createRecurringTemplateFromTransaction`: auth via `getAuthenticatedClient()`, defense-in-depth `.eq("user_id", user.id)` on both the tx and account lookups, proper `updateTag` (not `revalidateTag`) for every affected segment, `ActionResult<T>` shape preserved.
- Verify every dropped `is_subscription: false` write is truly a no-op and doesn't leave any insert without a required column.

**zetas-front-guy:**
- `PromoteToRecurringButton` token compliance — uses `GHOST_BUTTON_CLASS` for the CTA, no hardcoded colors on the "Ya es recurrente" badge.
- Hero action bar cohesion: the three buttons (edit, promote, delete) share visual weight and don't crowd on mobile at 390×844.

**perf-auditor:**
- `createRecurringTemplateFromTransaction` adds one new DB read (the source tx lookup). Verify no N+1 shape regression — the action is on a mutation path, not a render path, so cache implications are limited to the `updateTag` calls.
- The tx detail page now passes `accounts` + `categories` to a new client component. Verify both are already fetched via cached actions and the prop passthrough doesn't trigger a new server action per render.

Apply findings as `fix(transactions): apply review feedback`.

- [ ] **Step 10.2: Push + open PR (USER GATE)**

Do NOT push without user approval. Report the branch status (commit count, build green, review findings applied) and the generated PR body to the user; wait for "push". Once approved:

```bash
git push -u origin feat/promote-to-recurring
gh pr create --title 'feat(transactions): "Hacer recurrente" CTA + remove is_subscription' --body "$(cat <<'EOF'
## Summary
- Tx detail page gets a "Hacer recurrente" button that opens a pre-filled RecurringFormDialog. On submit, a new recurring_templates row is created and the source transaction is linked to the generated occurrence (status flips to paid).
- If the transaction is already linked to an occurrence, the button is replaced by an inert "Ya es recurrente" badge.
- Removes the dead is_subscription toggle from the 3 transaction forms (web, mobile, voice capture) and strips every is_subscription write from server actions, validators, and API routes. DB column stays nullable — follow-up migration drops it.
- Subscription tracking is handled via the existing tag system + destinatario auto-tag (PR #138). Zero new schema.

## Spec & Plan
- docs/superpowers/specs/2026-04-17-promote-to-recurring-design.md
- docs/superpowers/plans/2026-04-17-promote-to-recurring.md

## Test plan
- [x] Vitest unit tests for createRecurringTemplateFromTransaction (happy path, debt-account missing source, already-linked guard, missing tx)
- [x] pnpm build clean
- [x] Playwright flow verification at 390×844 (audit/2026-04-17-promote-to-recurring/)
- [x] server-action-reviewer + zetas-front-guy + perf-auditor findings applied
- [ ] Gemini pending
- [ ] frontend-auditor + ux-analyst pending
- [ ] /simplify pending
EOF
)"
```

Wait ~2 min after push for Gemini's bot review; `gh pr view --comments` to collect findings.

- [ ] **Step 10.3: Parallel — frontend-auditor + ux-analyst**

After applying Gemini's findings (or immediately if clean), spawn both:

**frontend-auditor:**
- A11y: the CTA button has an accessible label ("Hacer recurrente"), the lucide icon is `aria-hidden` (default), focus order is preserved in the hero action bar.
- Responsive: at 320w, the three hero buttons (edit, promote, delete) still fit or wrap gracefully.
- Localization: all copy Spanish — "Hacer recurrente", "Ya es recurrente", plus the error strings from the action.

**ux-analyst:**
- Does the CTA's placement feel discoverable on the tx detail page? Is the label verb-forward enough that a user understands what happens on click?
- After promoting a tx, is the link to the generated template visible anywhere? (Stretch: a sentence in the success state, e.g., "Listo — tu próxima ocurrencia aparece en /recurrentes.")
- Check that the voice-capture path still round-trips a transaction cleanly without the dropped `is_subscription` field.

Apply findings as `fix(transactions): apply frontend-auditor + ux-analyst feedback`.

- [ ] **Step 10.4: `/simplify` pass**

Invoke the `/simplify` skill against the branch diff. Focus: duplicated prefill logic between `prefillFromTransaction` and the `RecurringForm` seed path, any leftover dead imports. Apply as `refactor(transactions): apply /simplify review`.

- [ ] **Step 10.5: Final build gate**

Run: `cd webapp && pnpm build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 10.6: Wait for merge approval**

User merges PR from GitHub UI. Do not self-merge.

---

## Summary

- 2 primitives extended (`RecurringForm`, `RecurringFormDialog`).
- 1 new server action + 4 unit tests.
- 1 new client component.
- 1 CTA mount.
- `is_subscription` deleted from 3 form components + 1 action + 1 validator + 4 API routes.
- Zero migrations.

## Success criteria (from spec)

- ✅ Button visible on `/transactions/[id]` for any tx without a linked occurrence.
- ✅ Pre-filled dialog saves a template and links the source tx to the current occurrence.
- ✅ `is_subscription` Switch gone from all three forms.
- ✅ No runtime errors from routes that used to write `is_subscription: false`.
- ✅ `pnpm build` passes.
- ✅ No migrations.

## Spec coverage self-check

| Spec decision | Task coverage |
|---|---|
| D1 — CTA on tx detail | Tasks 4 + 5 |
| D2 — remove toggle from 3 forms + write paths | Tasks 6 + 7 + 8 |
| D3 — subscription tracking via existing tags | No-op (existing feature; spec explicitly declares out of scope for code) |
| D4 — hide CTA when already linked | Task 4 (button renders badge instead) + Task 3 (server-side guard) |
| D5 — frequency default MONTHLY | Task 4 (`prefillFromTransaction`) |
| D6 — debt-account edge | Task 3 reuses existing `DEBT_ACCOUNT_TYPES` validation; Step 9.3 verifies manually |
| D7 — tx detail only (no list-row CTA) | Out of scope; only Task 5 mounts it in the detail hero |
| Review gate | Task 10 |
