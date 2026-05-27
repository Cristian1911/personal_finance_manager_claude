# Subscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make subscriptions (Spotify, streaming, SaaS) a first-class, reviewable "what can I cut?" concept — recognized via the existing destinatario engine, tracked in a dedicated `subscriptions` table, billed through the existing recurring/occurrence lifecycle, and surfaced on a dedicated `/suscripciones` page with deterministic auto-detection.

**Architecture:** B′ — three layers. (1) **Recognition** reuses destinatarios' multi-pattern rules + `default_category_id`, untouched. (2) **Subscription state** lives in a new `subscriptions` table (1:1-live per destinatario, lifecycle enum, nullable `recurring_template_id`). (3) **Billing** rides `recurring_transaction_templates` + `recurring_occurrences` when a template is linked (authoritative totals); otherwise an `estimated_amount` is shown labeled "estimado". Detection is a deterministic pure function in `@zeta/shared`, triggered after `importTransactions()`.

**Tech Stack:** Next.js 15 (App Router, Server Actions, `"use cache"`), Supabase (encrypted views + RLS), Tailwind v4 + shadcn/ui, `@zeta/shared` (pure TS), Vitest, Expo/SQLite (mobile parity).

**Spec:** `docs/superpowers/specs/2026-05-27-subscriptions-design.md`

**Branch:** `feat/subscriptions` (already created).

---

## File Structure

**Phase 1 — webapp foundation**
- `supabase/migrations/<ts>_create_subscriptions.sql` — table, enum, RLS, partial-unique index, indexes, cancel-drift trigger, backfill. **(via `supabase-migrator`)**
- `webapp/src/types/domain.ts` (modify) — `Subscription`, `SubscriptionStatus`, `SubscriptionWithDetails`.
- `webapp/src/lib/validators/subscription.ts` (create) — Zod schemas.
- `webapp/src/actions/subscriptions.ts` (create) — cached read + mutations + `upsertSubscriptionFromTemplate` helper.
- `webapp/src/actions/recurring-templates.ts` (modify) — call `upsertSubscriptionFromTemplate` on create/update.
- `webapp/src/components/recurring/recurring-form.tsx` (modify) — "Es una suscripción" toggle + required-destinatario rule.
- `webapp/src/app/(dashboard)/suscripciones/page.tsx` (create) — server component.
- `webapp/src/components/subscriptions/subscriptions-view.tsx` (create) — client list + hero.
- `webapp/src/components/subscriptions/subscription-row.tsx` (create) — row + actions.

**Phase 2 — detection + suggestions + mobile**
- `packages/shared/src/utils/subscription-detector.ts` (create) — pure detector.
- `packages/shared/src/utils/__tests__/subscription-detector.test.ts` (create) — Vitest.
- `packages/shared/src/index.ts` (modify) — export detector.
- `webapp/src/actions/subscriptions.ts` (modify) — `runSubscriptionDetection()` runner + idempotency guard.
- `webapp/src/actions/import-transactions.ts` (modify) — call runner after import.
- `webapp/src/components/subscriptions/subscription-suggestions.tsx` (create) — suggestions section.
- `mobile/lib/db/schema.ts`, `mobile/lib/repositories/subscriptions.ts`, `mobile/lib/sync/pull.ts`, `mobile/lib/sync/push.ts` (modify/create) — mobile parity.

---

# PHASE 1 — Webapp foundation

## Task 1: Migration — `subscriptions` table

**This task MUST be done by the `supabase-migrator` agent** (encrypted FK targets, RLS, view join hints). Dispatch it with the spec's data-model section. The SQL below is the target; the agent finalizes encryption + exact syntax.

**Files:**
- Create: `supabase/migrations/<timestamp>_create_subscriptions.sql`
- Modify: `webapp/src/types/database.ts`, `packages/shared/src/types/database.ts` (regen)

- [ ] **Step 1: Generate the migration file**

Run: `cd /Users/cristian/Documents/developing/current-projects/zeta && npx supabase migration new create_subscriptions`

- [ ] **Step 2: Write the migration SQL**

```sql
-- Enum
CREATE TYPE subscription_status AS ENUM (
  'suggested', 'active', 'trial', 'marked_for_cancellation', 'cancelled', 'dismissed'
);

CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- FK targets the ENCRYPTED real tables (supabase-migrator confirms _enc names)
  destinatario_id uuid NOT NULL REFERENCES destinatarios_enc(id) ON DELETE CASCADE,
  recurring_template_id uuid REFERENCES recurring_transaction_templates_enc(id) ON DELETE SET NULL,
  status subscription_status NOT NULL DEFAULT 'active',
  estimated_amount numeric,
  currency_code text NOT NULL DEFAULT 'COP',
  trial_ends_on date,
  cancel_url text,
  detected_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One LIVE subscription per destinatario; cancelled/dismissed kept as history
CREATE UNIQUE INDEX subscriptions_one_live_per_destinatario
  ON subscriptions (user_id, destinatario_id)
  WHERE status NOT IN ('cancelled', 'dismissed');

CREATE INDEX idx_subscriptions_user_id ON subscriptions (user_id);
CREATE INDEX idx_subscriptions_destinatario_id ON subscriptions (destinatario_id);
CREATE INDEX idx_subscriptions_recurring_template_id ON subscriptions (recurring_template_id);
CREATE INDEX idx_subscriptions_status ON subscriptions (status);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select" ON subscriptions FOR SELECT
  USING ((select auth.uid()) = user_id);
CREATE POLICY "subscriptions_insert" ON subscriptions FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "subscriptions_update" ON subscriptions FOR UPDATE
  USING ((select auth.uid()) = user_id);
CREATE POLICY "subscriptions_delete" ON subscriptions FOR DELETE
  USING ((select auth.uid()) = user_id);

-- Cancel-drift guard: keep subscriptions.status in sync when a linked template is (de)activated
CREATE OR REPLACE FUNCTION sync_subscription_on_template_active_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    IF NEW.is_active = false THEN
      UPDATE subscriptions
        SET status = 'cancelled', updated_at = now()
        WHERE recurring_template_id = NEW.id
          AND status NOT IN ('cancelled', 'dismissed');
    ELSE
      UPDATE subscriptions
        SET status = 'active', updated_at = now()
        WHERE recurring_template_id = NEW.id
          AND status = 'cancelled';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach to the ENCRYPTED base table (supabase-migrator confirms the correct table/trigger target)
CREATE TRIGGER trg_sync_subscription_on_template_active
  AFTER UPDATE ON recurring_transaction_templates_enc
  FOR EACH ROW EXECUTE FUNCTION sync_subscription_on_template_active_change();

-- Backfill: existing recurring templates categorized as Suscripciones that already have a destinatario
INSERT INTO subscriptions (user_id, destinatario_id, recurring_template_id, status, currency_code)
SELECT t.user_id, t.destinatario_id, t.id, 'active', t.currency_code
FROM recurring_transaction_templates t
WHERE t.category_id = 'c0000001-0012-4000-8000-000000000004'
  AND t.destinatario_id IS NOT NULL
  AND t.is_active = true
ON CONFLICT DO NOTHING;
```

- [ ] **Step 3: Push the migration**

Run: `cd /Users/cristian/Documents/developing/current-projects/zeta && npx supabase db push`
Expected: migration applies cleanly.

- [ ] **Step 4: Regenerate types**

Run: `cd webapp && npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu > src/types/database.ts`
Then copy/sync to `packages/shared/src/types/database.ts` per existing convention. Verify `export type Json =` header is intact and the `subscriptions` Row/Insert/Update types exist.

- [ ] **Step 5: Build gate**

Run: `cd webapp && pnpm build`
Expected: PASS (new table types resolve).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations webapp/src/types/database.ts packages/shared/src/types/database.ts
git commit -m "feat(subscriptions): create subscriptions table, RLS, cancel-drift trigger, backfill"
```

---

## Task 2: Domain types + validators

**Files:**
- Modify: `webapp/src/types/domain.ts`
- Create: `webapp/src/lib/validators/subscription.ts`

- [ ] **Step 1: Add domain types**

In `webapp/src/types/domain.ts`, add (mirror existing `type X = Database["public"]["Tables"][...]["Row"]` aliases in that file):

```typescript
export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
export type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];

export type SubscriptionWithDetails = Subscription & {
  destinatario_name: string;
  default_category_id: string | null;
  category_name: string | null;
  // billing (null when no linked template)
  template_amount: number | null;
  template_frequency: string | null;
  next_occurrence_date: string | null;
  monthly_expected: number | null; // from occurrences; null => use estimated_amount
};
```

- [ ] **Step 2: Add Zod validators**

Create `webapp/src/lib/validators/subscription.ts`:

```typescript
import { z } from "zod";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const updateSubscriptionSchema = z.object({
  trial_ends_on: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ),
  cancel_url: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().url().optional(),
  ),
});

export const subscriptionIdSchema = z.string().regex(UUID, "ID inválido");
```

- [ ] **Step 3: Build gate**

Run: `cd webapp && pnpm build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/types/domain.ts webapp/src/lib/validators/subscription.ts
git commit -m "feat(subscriptions): domain types + validators"
```

---

## Task 3: Cached read — `getSubscriptions`

**Files:**
- Create: `webapp/src/actions/subscriptions.ts`

Mirror the cached-read pattern from `webapp/src/actions/charts.ts` (`getMonthlyCashflowCached`): a public wrapper calls `getAuthenticatedClient()` for `accessToken`, then a `"use cache"` inner fn uses `createCachedClient(accessToken)`.

- [ ] **Step 1: Write the cached read**

Create `webapp/src/actions/subscriptions.ts`:

```typescript
"use server";

import { cacheTag, cacheLife, updateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import type { ActionResult } from "@/types/actions";
import type { SubscriptionWithDetails } from "@/types/domain";

async function getSubscriptionsCached(
  accessToken: string,
  userId: string,
): Promise<SubscriptionWithDetails[]> {
  "use cache";
  cacheTag("subscriptions");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  // Join through views with explicit FK hints (plain joins through encrypted views return empty)
  const { data, error } = await supabase
    .from("subscriptions")
    .select(`
      *,
      destinatarios!subscriptions_destinatario_id_fkey ( name, default_category_id ),
      recurring_transaction_templates!subscriptions_recurring_template_id_fkey ( amount, frequency )
    `)
    .eq("user_id", userId)
    .not("status", "in", "(dismissed,cancelled)") // audit shows current bleed; history excluded
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    ...row,
    destinatario_name: row.destinatarios?.name ?? "—",
    default_category_id: row.destinatarios?.default_category_id ?? null,
    category_name: null, // filled by caller if needed
    template_amount: row.recurring_transaction_templates?.amount ?? null,
    template_frequency: row.recurring_transaction_templates?.frequency ?? null,
    next_occurrence_date: null, // filled by page from occurrences
    monthly_expected: null,
  })) as unknown as SubscriptionWithDetails[];
}

export async function getSubscriptions(): Promise<ActionResult<SubscriptionWithDetails[]>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    const data = await getSubscriptionsCached(accessToken, user.id);
    return { success: true, data };
  } catch {
    return { success: false, error: "Error al cargar las suscripciones" };
  }
}
```

> NOTE: confirm the exact FK constraint names (`subscriptions_destinatario_id_fkey`, etc.) from the migration `supabase-migrator` produced, and the join-through-view syntax, before relying on the join. If the view join is awkward, fall back to a two-query approach (fetch subscriptions, then batch-fetch destinatarios by id).

- [ ] **Step 2: Build gate**

Run: `cd webapp && pnpm build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/actions/subscriptions.ts
git commit -m "feat(subscriptions): cached getSubscriptions read"
```

---

## Task 4: Mutation actions

**Files:**
- Modify: `webapp/src/actions/subscriptions.ts`

Mirror the mutation pattern from `webapp/src/actions/destinatarios.ts`: `getAuthenticatedClient()`, `.eq("user_id", user.id)`, `updateTag(...)` at the end.

- [ ] **Step 1: Add `dismissSubscription`**

```typescript
import { subscriptionIdSchema, updateSubscriptionSchema } from "@/lib/validators/subscription";

export async function dismissSubscription(id: string): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  if (!subscriptionIdSchema.safeParse(id).success) return { success: false, error: "ID inválido" };

  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "dismissed", dismissed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  updateTag("subscriptions");
  return { success: true };
}
```

- [ ] **Step 2: Add `markForCancellation` and `cancelSubscription`**

```typescript
export async function markForCancellation(id: string): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  if (!subscriptionIdSchema.safeParse(id).success) return { success: false, error: "ID inválido" };

  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "marked_for_cancellation" })
    .eq("id", id)
    .eq("user_id", user.id)
    .in("status", ["active", "trial"]);

  if (error) return { success: false, error: error.message };
  updateTag("subscriptions");
  return { success: true };
}

// Real cancellation: deactivate the linked template (the DB trigger flips status to 'cancelled');
// if there is no linked template, set status directly.
export async function cancelSubscription(id: string): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  if (!subscriptionIdSchema.safeParse(id).success) return { success: false, error: "ID inválido" };

  const { data: sub, error: readErr } = await supabase
    .from("subscriptions")
    .select("id, recurring_template_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (readErr || !sub) return { success: false, error: "Suscripción no encontrada" };

  if (sub.recurring_template_id) {
    const { error: tErr } = await supabase
      .from("recurring_transaction_templates")
      .update({ is_active: false })
      .eq("id", sub.recurring_template_id)
      .eq("user_id", user.id);
    if (tErr) return { success: false, error: tErr.message };
    // trigger sets subscriptions.status = 'cancelled'
  } else {
    const { error: sErr } = await supabase
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("user_id", user.id);
    if (sErr) return { success: false, error: sErr.message };
  }

  updateTag("subscriptions");
  revalidateFinancialViews();
  return { success: true };
}
```

- [ ] **Step 3: Add `updateSubscription` (metadata)**

```typescript
export async function updateSubscription(id: string, formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  if (!subscriptionIdSchema.safeParse(id).success) return { success: false, error: "ID inválido" };

  const parsed = updateSubscriptionSchema.safeParse({
    trial_ends_on: formData.get("trial_ends_on"),
    cancel_url: formData.get("cancel_url"),
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const status = parsed.data.trial_ends_on ? "trial" : undefined;
  const { error } = await supabase
    .from("subscriptions")
    .update({
      trial_ends_on: parsed.data.trial_ends_on ?? null,
      cancel_url: parsed.data.cancel_url ?? null,
      ...(status ? { status } : {}),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  updateTag("subscriptions");
  return { success: true };
}
```

- [ ] **Step 4: Add `upsertSubscriptionFromTemplate` helper (used by recurring-templates action in Task 5)**

```typescript
// Internal helper (not "use server"-exported as an action target; called from recurring-templates.ts).
// Upserts an active subscription row for a template flagged as a subscription, or cancels it when un-flagged.
export async function upsertSubscriptionFromTemplate(
  supabase: Awaited<ReturnType<typeof getAuthenticatedClient>>["supabase"],
  userId: string,
  template: { id: string; destinatario_id: string | null; currency_code: string },
  isSubscription: boolean,
): Promise<void> {
  if (isSubscription) {
    if (!template.destinatario_id) return; // guarded earlier; defensive
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("id, status")
      .eq("user_id", userId)
      .eq("destinatario_id", template.destinatario_id)
      .not("status", "in", "(cancelled,dismissed)")
      .maybeSingle();

    if (existing) {
      await supabase
        .from("subscriptions")
        .update({ recurring_template_id: template.id, status: "active" })
        .eq("id", existing.id)
        .eq("user_id", userId);
    } else {
      await supabase.from("subscriptions").insert({
        user_id: userId,
        destinatario_id: template.destinatario_id,
        recurring_template_id: template.id,
        status: "active",
        currency_code: template.currency_code,
      });
    }
  } else {
    // un-flagged: cancel any live subscription linked to this template
    await supabase
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("user_id", userId)
      .eq("recurring_template_id", template.id)
      .not("status", "in", "(cancelled,dismissed)");
  }
}
```

- [ ] **Step 5: Build gate**

Run: `cd webapp && pnpm build`
Expected: PASS.

- [ ] **Step 6: Run `server-action-reviewer` agent on `webapp/src/actions/subscriptions.ts`**

Confirm auth, defense-in-depth `.eq("user_id")`, `updateTag` (not `revalidateTag`), `ActionResult` return shapes.

- [ ] **Step 7: Commit**

```bash
git add webapp/src/actions/subscriptions.ts
git commit -m "feat(subscriptions): dismiss/mark/cancel/update actions + upsertSubscriptionFromTemplate"
```

---

## Task 5: Recurring form toggle + action wiring

**Files:**
- Modify: `webapp/src/components/recurring/recurring-form.tsx`
- Modify: `webapp/src/actions/recurring-templates.ts`

- [ ] **Step 1: Read both files first**

The form already has a `destinatarioId` state + `DestinatarioZonePicker`, and submits via `useActionState`. Read `recurring-form.tsx` and `recurring-templates.ts` to locate the destinatario field and the create/update success points (per the patterns gathered: create at `recurring-templates.ts:~308`, update at `~387`).

- [ ] **Step 2: Add the toggle to the form**

Add a controlled boolean + a hidden input so it serializes into `FormData`. Place it near the direction/category fields. The form receives `seed?.isSubscription` (the edit page computes this from a linked subscription — see Step 5):

```tsx
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// state (near other useState hooks)
const [isSubscription, setIsSubscription] = useState(seed?.isSubscription ?? false);

// JSX (near direction/category)
<div className="flex items-center justify-between rounded-lg border border-white/6 bg-z-surface-2 px-3 py-2.5">
  <div className="space-y-0.5">
    <Label htmlFor="is_subscription_toggle" className="text-z-sage-light">Es una suscripción</Label>
    <p className="text-xs text-z-sage-light/60">Spotify, streaming, apps — opcional y cancelable.</p>
  </div>
  <Switch
    id="is_subscription_toggle"
    checked={isSubscription}
    onCheckedChange={setIsSubscription}
  />
</div>
<input type="hidden" name="is_subscription" value={isSubscription ? "true" : "false"} />
```

- [ ] **Step 3: Client-side guard — subscription requires a destinatario**

In the form's submit wrapper (the `useActionState` async fn), before calling the action, block when `isSubscription && !destinatarioId`:

```tsx
async (prevState, formData) => {
  if (formData.get("is_subscription") === "true" && !destinatarioId) {
    return { success: false, error: "Una suscripción necesita un destinatario." };
  }
  const result = await action(prevState, formData);
  if (result.success) onSuccess?.(result.data);
  return result;
}
```

- [ ] **Step 4: Wire the action to upsert the subscription**

In `recurring-templates.ts`, in BOTH `createRecurringTemplate` and `updateRecurringTemplate`, after the successful upsert (where `result.data` is the saved template) and before `revalidateFinancialViews()`, add:

```typescript
import { upsertSubscriptionFromTemplate } from "@/actions/subscriptions";
import { updateTag } from "next/cache";

// server-side guard (defense in depth — client guard can be bypassed)
const isSubscription = formData.get("is_subscription") === "true";
if (isSubscription && !result.data.destinatario_id) {
  return { success: false, error: "Una suscripción necesita un destinatario." };
}

await upsertSubscriptionFromTemplate(
  supabase,
  user.id,
  { id: result.data.id, destinatario_id: result.data.destinatario_id, currency_code: result.data.currency_code },
  isSubscription,
);
updateTag("subscriptions");
```

- [ ] **Step 5: Seed `isSubscription` on edit**

In the recurring template **edit** page/loader, fetch whether a live subscription exists for the template (`status NOT IN ('cancelled','dismissed')`) and pass `isSubscription` into `recurring-form`'s `seed`. (Read the edit page to find where `seed` is assembled; add a `getSubscriptionForTemplate(templateId)` read to `subscriptions.ts` returning a boolean if convenient.)

- [ ] **Step 6: Build gate + UI review**

Run: `cd webapp && pnpm build` → PASS.
Run the `zetas-front-guy` agent on the modified `recurring-form.tsx` (token usage, Switch, Spanish strings).

- [ ] **Step 7: Commit**

```bash
git add webapp/src/components/recurring/recurring-form.tsx webapp/src/actions/recurring-templates.ts webapp/src/actions/subscriptions.ts
git commit -m "feat(subscriptions): recurring-form subscription toggle + action wiring"
```

---

## Task 6: `/suscripciones` page

**Files:**
- Create: `webapp/src/app/(dashboard)/suscripciones/page.tsx`
- Create: `webapp/src/components/subscriptions/subscriptions-view.tsx`
- Create: `webapp/src/components/subscriptions/subscription-row.tsx`

- [ ] **Step 1: Page server component (computes occurrence-based totals)**

Create `webapp/src/app/(dashboard)/suscripciones/page.tsx`. Mirror the dashboard page shape. Call `ensureCurrentOccurrences()` BEFORE reading occurrences (recurring-doctor rule):

```tsx
import { getSubscriptions } from "@/actions/subscriptions";
import { ensureCurrentOccurrences, getOccurrencesForMonth } from "@/actions/occurrences";
import { getPreferredCurrency } from "@/actions/profile";
import { SubscriptionsView } from "@/components/subscriptions/subscriptions-view";

export default async function SuscripcionesPage() {
  await ensureCurrentOccurrences();
  const [subsRes, occRes, currency] = await Promise.all([
    getSubscriptions(),
    getOccurrencesForMonth(),
    getPreferredCurrency(),
  ]);

  const subs = subsRes.success ? subsRes.data : [];
  const occurrences = occRes.success ? occRes.data : [];

  // Authoritative monthly total = sum expected_amount of occurrences whose template is a linked subscription.
  const subTemplateIds = new Set(subs.map((s) => s.recurring_template_id).filter(Boolean) as string[]);
  const authoritativeMonthly = occurrences
    .filter((o) => subTemplateIds.has(o.template_id) && o.direction === "OUTFLOW")
    .reduce((sum, o) => sum + o.expected_amount, 0);

  // Estimated bleed = subs WITHOUT a template, using estimated_amount.
  const estimatedMonthly = subs
    .filter((s) => !s.recurring_template_id && s.estimated_amount)
    .reduce((sum, s) => sum + (s.estimated_amount ?? 0), 0);

  return (
    <SubscriptionsView
      subscriptions={subs}
      occurrences={occurrences}
      authoritativeMonthly={authoritativeMonthly}
      estimatedMonthly={estimatedMonthly}
      currency={currency}
    />
  );
}
```

- [ ] **Step 2: Client view (hero + active list)**

Create `webapp/src/components/subscriptions/subscriptions-view.tsx` — `"use client"`. Hero shows authoritative monthly + `× 12` annualized; estimado shown as a separate secondary line only when `estimatedMonthly > 0`. Uses `formatCurrency`. Apply `MOBILE_TAB_BAR_CLEARANCE_CLASS` to the scroll container. Map subscriptions to `<SubscriptionRow>`. Reuse `Card`/`Badge` from `@/components/ui/`. Group by status: active/trial first, marked_for_cancellation flagged, suggestions handled in Task 9.

```tsx
"use client";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import { MOBILE_TAB_BAR_CLEARANCE_CLASS } from "@/lib/constants/styles";
import { SubscriptionRow } from "./subscription-row";
import type { SubscriptionWithDetails } from "@/types/domain";
import type { RecurringOccurrence } from "@/actions/occurrences";

export function SubscriptionsView({ subscriptions, occurrences, authoritativeMonthly, estimatedMonthly, currency }: {
  subscriptions: SubscriptionWithDetails[];
  occurrences: RecurringOccurrence[];
  authoritativeMonthly: number;
  estimatedMonthly: number;
  currency: string;
}) {
  const nextByTemplate = new Map<string, string>();
  for (const o of occurrences) {
    if (o.status === "pending" && !nextByTemplate.has(o.template_id)) {
      nextByTemplate.set(o.template_id, o.occurrence_date);
    }
  }
  const tracked = subscriptions.filter((s) => s.status !== "suggested");

  return (
    <div className={`space-y-4 ${MOBILE_TAB_BAR_CLEARANCE_CLASS}`}>
      <Card className="p-5">
        <p className="text-sm text-z-sage-light/70">Gasto mensual en suscripciones</p>
        <p className="text-3xl font-semibold text-z-sage-light">{formatCurrency(authoritativeMonthly, currency)}</p>
        <p className="text-sm text-z-sage-light/60">{formatCurrency(authoritativeMonthly * 12, currency)} al año</p>
        {estimatedMonthly > 0 && (
          <p className="mt-1 text-xs text-z-sage-light/50">
            + {formatCurrency(estimatedMonthly, currency)}/mes estimado (sin programar)
          </p>
        )}
      </Card>

      <div className="space-y-2">
        {tracked.map((s) => (
          <SubscriptionRow
            key={s.id}
            subscription={s}
            currency={currency}
            nextDate={s.recurring_template_id ? nextByTemplate.get(s.recurring_template_id) ?? null : null}
          />
        ))}
        {tracked.length === 0 && (
          <p className="py-8 text-center text-sm text-z-sage-light/60">
            No tienes suscripciones registradas todavía.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Row component with actions**

Create `webapp/src/components/subscriptions/subscription-row.tsx` — `"use client"`. Shows name, amount (`template_amount ?? estimated_amount`, with "estimado" badge when no template), next charge date, status badge. Actions in a dropdown: Marcar para cancelar (`markForCancellation`), Cancelar (`cancelSubscription`), and Formalizar when `!recurring_template_id`. Use `startTransition` + `router.refresh()` after each action (same-page revalidation). Use `BRASS_BUTTON_CLASS`/`GHOST_BUTTON_CLASS` for buttons, tokens only.

```tsx
"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cancelSubscription, markForCancellation } from "@/actions/subscriptions";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { SubscriptionWithDetails } from "@/types/domain";

export function SubscriptionRow({ subscription: s, currency, nextDate }: {
  subscription: SubscriptionWithDetails;
  currency: string;
  nextDate: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const amount = s.template_amount ?? s.estimated_amount ?? 0;

  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  return (
    <div className="flex items-center justify-between rounded-lg border border-white/6 bg-z-surface-2 p-3">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-z-sage-light">{s.destinatario_name}</span>
          {!s.recurring_template_id && <Badge variant="outline">estimado</Badge>}
          {s.status === "marked_for_cancellation" && <Badge variant="outline">por cancelar</Badge>}
          {s.status === "trial" && <Badge variant="outline">prueba</Badge>}
        </div>
        <p className="text-sm text-z-sage-light/60">
          {formatCurrency(amount, currency)}{nextDate ? ` · próx. ${formatDate(nextDate)}` : ""}
        </p>
      </div>
      <div className="flex gap-2">
        {s.status !== "marked_for_cancellation" && (
          <button disabled={pending} onClick={() => run(() => markForCancellation(s.id))}
            className="text-xs text-z-sage-light/70 hover:text-z-sage-light">Marcar</button>
        )}
        <button disabled={pending} onClick={() => run(() => cancelSubscription(s.id))}
          className="text-xs text-z-danger hover:underline">Cancelar</button>
      </div>
    </div>
  );
}
```

> "Formalizar" action (create a template for an estimated sub) is wired in Phase 2 (Task 9) alongside the suggestion-confirm flow, since both create a template from detected data.

- [ ] **Step 4: Build gate + reviews**

Run: `cd webapp && pnpm build` → PASS.
Run `zetas-front-guy` (tokens, Spanish, tab-bar clearance) and `perf-auditor` (cached reads, no uncached query on the render path) on the new page + components.

- [ ] **Step 5: Manual verification**

Run `cd webapp && pnpm dev` (check :3000 is free first), navigate to `/suscripciones`. Confirm backfilled subs (if any) render and the monthly total is non-zero when a Suscripciones-categorized recurring template exists.

- [ ] **Step 6: Commit**

```bash
git add webapp/src/app/\(dashboard\)/suscripciones webapp/src/components/subscriptions
git commit -m "feat(subscriptions): /suscripciones page, view, and row actions"
```

---

# PHASE 2 — Detection + suggestions + mobile parity

## Task 7: Pure detector in `@zeta/shared` (TDD)

**Files:**
- Create: `packages/shared/src/utils/subscription-detector.ts`
- Test: `packages/shared/src/utils/__tests__/subscription-detector.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/utils/__tests__/subscription-detector.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { detectSubscriptions, type DetectorTransaction } from "../subscription-detector";

const tx = (destinatario_id: string | null, date: string, amount: number): DetectorTransaction => ({
  destinatario_id, transaction_date: date, amount, currency_code: "COP", direction: "OUTFLOW",
});

describe("detectSubscriptions", () => {
  it("detects a stable monthly charge as a candidate", () => {
    const txs = [tx("d1", "2026-03-05", 16900), tx("d1", "2026-04-05", 16900), tx("d1", "2026-05-05", 17900)];
    const result = detectSubscriptions(txs, new Set());
    expect(result).toHaveLength(1);
    expect(result[0].destinatario_id).toBe("d1");
    expect(result[0].occurrence_count).toBe(3);
    expect(result[0].median_amount).toBe(16900);
  });

  it("ignores groups with fewer than 3 charges", () => {
    const txs = [tx("d1", "2026-04-05", 16900), tx("d1", "2026-05-05", 16900)];
    expect(detectSubscriptions(txs, new Set())).toHaveLength(0);
  });

  it("ignores non-monthly cadence", () => {
    const txs = [tx("d1", "2026-01-05", 16900), tx("d1", "2026-03-05", 16900), tx("d1", "2026-05-05", 16900)];
    expect(detectSubscriptions(txs, new Set())).toHaveLength(0);
  });

  it("ignores unstable amounts", () => {
    const txs = [tx("d1", "2026-03-05", 10000), tx("d1", "2026-04-05", 50000), tx("d1", "2026-05-05", 90000)];
    expect(detectSubscriptions(txs, new Set())).toHaveLength(0);
  });

  it("excludes destinatarios that already have a subscription", () => {
    const txs = [tx("d1", "2026-03-05", 16900), tx("d1", "2026-04-05", 16900), tx("d1", "2026-05-05", 16900)];
    expect(detectSubscriptions(txs, new Set(["d1"]))).toHaveLength(0);
  });

  it("ignores transactions with no destinatario and INFLOWs", () => {
    const txs: DetectorTransaction[] = [
      tx(null, "2026-03-05", 16900), tx(null, "2026-04-05", 16900), tx(null, "2026-05-05", 16900),
      { destinatario_id: "d2", transaction_date: "2026-03-05", amount: 16900, currency_code: "COP", direction: "INFLOW" },
    ];
    expect(detectSubscriptions(txs, new Set())).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && pnpm vitest run src/utils/__tests__/subscription-detector.test.ts`
Expected: FAIL — module not found / `detectSubscriptions` undefined.

- [ ] **Step 3: Implement the detector**

Create `packages/shared/src/utils/subscription-detector.ts`:

```typescript
export interface DetectorTransaction {
  destinatario_id: string | null;
  transaction_date: string; // YYYY-MM-DD
  amount: number;
  currency_code: string;
  direction: "INFLOW" | "OUTFLOW";
}

export interface SubscriptionCandidate {
  destinatario_id: string;
  occurrence_count: number;
  median_amount: number;
  median_gap_days: number;
  currency_code: string;
}

export interface DetectOptions {
  minOccurrences?: number;
  minGapDays?: number;
  maxGapDays?: number;
  amountTolerance?: number;
}

const DEFAULTS: Required<DetectOptions> = {
  minOccurrences: 3, minGapDays: 28, maxGapDays: 34, amountTolerance: 0.1,
};

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`);
  return Math.round(ms / 86_400_000);
}

export function detectSubscriptions(
  transactions: DetectorTransaction[],
  excludedDestinatarioIds: Set<string>,
  options?: DetectOptions,
): SubscriptionCandidate[] {
  const o = { ...DEFAULTS, ...options };
  const groups = new Map<string, DetectorTransaction[]>();

  for (const t of transactions) {
    if (t.direction !== "OUTFLOW" || !t.destinatario_id) continue;
    if (excludedDestinatarioIds.has(t.destinatario_id)) continue;
    const arr = groups.get(t.destinatario_id) ?? [];
    arr.push(t);
    groups.set(t.destinatario_id, arr);
  }

  const candidates: SubscriptionCandidate[] = [];
  for (const [destinatarioId, txs] of groups) {
    if (txs.length < o.minOccurrences) continue;
    const sorted = [...txs].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));

    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(daysBetween(sorted[i - 1].transaction_date, sorted[i].transaction_date));
    }
    const medGap = median(gaps);
    if (medGap < o.minGapDays || medGap > o.maxGapDays) continue;

    const amounts = sorted.map((t) => t.amount);
    const medAmount = median(amounts);
    const stable = amounts.every((a) => Math.abs(a - medAmount) <= medAmount * o.amountTolerance);
    if (!stable) continue;

    candidates.push({
      destinatario_id: destinatarioId,
      occurrence_count: sorted.length,
      median_amount: medAmount,
      median_gap_days: medGap,
      currency_code: sorted[0].currency_code,
    });
  }
  return candidates;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/shared && pnpm vitest run src/utils/__tests__/subscription-detector.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Export from the package**

In `packages/shared/src/index.ts`, add:

```typescript
export { detectSubscriptions } from "./utils/subscription-detector";
export type { DetectorTransaction, SubscriptionCandidate, DetectOptions } from "./utils/subscription-detector";
```

- [ ] **Step 6: Build gate**

Run: `cd webapp && pnpm build` → PASS (shared types resolve in webapp).

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/utils/subscription-detector.ts packages/shared/src/utils/__tests__/subscription-detector.test.ts packages/shared/src/index.ts
git commit -m "feat(subscriptions): deterministic detector in @zeta/shared (TDD)"
```

---

## Task 8: Detection runner + import hook

**Files:**
- Modify: `webapp/src/actions/subscriptions.ts`
- Modify: `webapp/src/actions/import-transactions.ts`

- [ ] **Step 1: Add `runSubscriptionDetection` to `subscriptions.ts`**

Loads recent OUTFLOW transactions with a destinatario, the set of destinatarios that already have ANY subscription row (idempotency guard — never re-suggest dismissed/cancelled/active), runs the pure detector, inserts `suggested` rows.

```typescript
import { detectSubscriptions, type DetectorTransaction } from "@zeta/shared";

export async function runSubscriptionDetection(): Promise<ActionResult<{ created: number }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // 1. recent OUTFLOW transactions with a destinatario (last ~12 months)
  const since = new Date(); since.setMonth(since.getMonth() - 12);
  const { data: txs } = await supabase
    .from("transactions")
    .select("destinatario_id, transaction_date, amount, currency_code, direction")
    .eq("user_id", user.id)
    .eq("direction", "OUTFLOW")
    .not("destinatario_id", "is", null)
    .gte("transaction_date", since.toISOString().slice(0, 10));

  // 2. destinatarios that already have ANY subscription row (any status => skip; sticky dismissal)
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("destinatario_id")
    .eq("user_id", user.id);
  const excluded = new Set((existing ?? []).map((r) => r.destinatario_id));

  const candidates = detectSubscriptions((txs ?? []) as DetectorTransaction[], excluded);
  if (candidates.length === 0) return { success: true, data: { created: 0 } };

  const rows = candidates.map((c) => ({
    user_id: user.id,
    destinatario_id: c.destinatario_id,
    status: "suggested" as const,
    estimated_amount: c.median_amount,
    currency_code: c.currency_code,
    detected_at: new Date().toISOString(),
  }));

  // ON CONFLICT DO NOTHING via the partial-unique index protects against races.
  const { data: inserted, error } = await supabase
    .from("subscriptions")
    .insert(rows)
    .select("id");
  if (error && error.code !== "23505") return { success: false, error: error.message };

  updateTag("subscriptions");
  return { success: true, data: { created: inserted?.length ?? 0 } };
}
```

> The `excluded` set already filters out destinatarios with any row, so re-runs never resurrect a dismissed suggestion. The `23505` guard covers concurrent inserts.

- [ ] **Step 2: Hook into the import flow**

Read `webapp/src/actions/import-transactions.ts`, find where the import succeeds and calls `revalidateFinancialViews()` / `updateTag(...)` before the final return. Add the detection call there (fire it before the revalidation calls so the `subscriptions` tag update is included):

```typescript
import { runSubscriptionDetection } from "@/actions/subscriptions";

// after inserts succeed, before the existing revalidate block:
await runSubscriptionDetection();
```

> Detection is best-effort: wrap in try/catch if the import action treats thrown errors as failures, so a detection hiccup never fails an otherwise-successful import.

- [ ] **Step 3: Build gate + review**

Run: `cd webapp && pnpm build` → PASS.
Run `server-action-reviewer` on `subscriptions.ts` and `import-flow-doctor` on the import-transactions change (confirm detection runs after idempotent inserts, doesn't double-fire, doesn't break the import result).

- [ ] **Step 4: Commit**

```bash
git add webapp/src/actions/subscriptions.ts webapp/src/actions/import-transactions.ts
git commit -m "feat(subscriptions): detection runner + post-import hook"
```

---

## Task 9: Suggestions section + confirm/formalize

**Files:**
- Create: `webapp/src/components/subscriptions/subscription-suggestions.tsx`
- Modify: `webapp/src/actions/subscriptions.ts` (add `confirmSubscription`, `formalizeSubscription`)
- Modify: `webapp/src/components/subscriptions/subscriptions-view.tsx` (render suggestions)

- [ ] **Step 1: Add `confirmSubscription` action**

Promotes a `suggested` row to `active`. Optionally creates a pre-filled recurring template from the detected amount and links it (so totals become occurrence-based). Minimal version: promote to `active`, keep `estimated_amount` (template creation offered separately via Formalizar to avoid a heavy confirm).

```typescript
export async function confirmSubscription(id: string): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  if (!subscriptionIdSchema.safeParse(id).success) return { success: false, error: "ID inválido" };

  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "active" })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "suggested");

  if (error) return { success: false, error: error.message };
  updateTag("subscriptions");
  return { success: true };
}
```

- [ ] **Step 2: Add `formalizeSubscription` action**

Creates a recurring template (MONTHLY, OUTFLOW) pre-filled from the subscription's destinatario + `estimated_amount`, links it via `recurring_template_id`. Reuse the existing template-insert helper from `recurring-templates.ts` if exported; otherwise insert directly with the same fields, then call `ensureCurrentOccurrences()`.

```typescript
import { ensureCurrentOccurrences } from "@/actions/occurrences";

export async function formalizeSubscription(id: string): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, destinatario_id, estimated_amount, currency_code, recurring_template_id, destinatarios!subscriptions_destinatario_id_fkey(name, default_category_id)")
    .eq("id", id).eq("user_id", user.id).single();
  if (!sub) return { success: false, error: "Suscripción no encontrada" };
  if (sub.recurring_template_id) return { success: true }; // already formalized

  // pick a default account — require the user to choose in UI ideally; minimal: first active non-debt account
  const { data: acct } = await supabase
    .from("accounts").select("id").eq("user_id", user.id).eq("is_active", true).limit(1).single();
  if (!acct) return { success: false, error: "No hay cuenta disponible" };

  const { data: tpl, error: tErr } = await supabase
    .from("recurring_transaction_templates")
    .insert({
      user_id: user.id,
      account_id: acct.id,
      destinatario_id: sub.destinatario_id,
      category_id: sub.destinatarios?.default_category_id ?? null,
      merchant_name: sub.destinatarios?.name ?? "Suscripción",
      amount: sub.estimated_amount ?? 0,
      currency_code: sub.currency_code,
      direction: "OUTFLOW",
      frequency: "MONTHLY",
      is_active: true,
    })
    .select("id").single();
  if (tErr || !tpl) return { success: false, error: tErr?.message ?? "Error" };

  await supabase.from("subscriptions")
    .update({ recurring_template_id: tpl.id, status: "active" })
    .eq("id", id).eq("user_id", user.id);

  await ensureCurrentOccurrences();
  updateTag("subscriptions");
  revalidateFinancialViews();
  return { success: true };
}
```

> Account selection: the minimal version picks the first active account. If the recurring form is easy to reuse as a modal pre-filled from the subscription, prefer routing "Formalizar" to that form instead (better UX, lets the user pick account + day). Decide during implementation; both produce a linked template.

- [ ] **Step 3: Suggestions component**

Create `webapp/src/components/subscriptions/subscription-suggestions.tsx` — `"use client"`. Renders `status === "suggested"` rows with destinatario name + `estimated_amount` + "Esto parece una suscripción". Two buttons: **Rastrear** (`confirmSubscription`) and **Descartar** (`dismissSubscription`). `startTransition` + `router.refresh()`.

- [ ] **Step 4: Render suggestions in the view**

In `subscriptions-view.tsx`, split `subscriptions` into `suggested` vs tracked; render `<SubscriptionSuggestions suggestions={suggested} currency={currency} />` above the tracked list when non-empty.

- [ ] **Step 5: Build gate + reviews**

Run: `cd webapp && pnpm build` → PASS.
Run `server-action-reviewer` (new actions), `zetas-front-guy` (suggestions UI), `recurring-doctor` (formalize creates a proper template + occurrences).

- [ ] **Step 6: Commit**

```bash
git add webapp/src/actions/subscriptions.ts webapp/src/components/subscriptions
git commit -m "feat(subscriptions): suggestions section, confirm + formalize"
```

---

## Task 10: No-destinatario fallback nudge

**Files:**
- Modify: `webapp/src/components/subscriptions/subscription-suggestions.tsx`
- (Read) `webapp/src/actions/destinatarios.ts` — `getDestinatarioSuggestions`

- [ ] **Step 1: Surface destinatario suggestions as a secondary nudge**

For repeating charges with no destinatario, the existing `getDestinatarioSuggestions()` returns candidates (`{ matchCount, samples }`-style). In the `/suscripciones` page server component, also fetch these and pass to the suggestions component as a separate "Crea un destinatario para rastrear esto" block. Confirming routes the user to the destinatario-create flow (which already learns a rule); after creating + categorizing as Suscripciones, the normal detector picks it up on the next import.

> Keep this lightweight — it's a nudge linking to the existing destinatario-create surface, not a new mutation. Do not duplicate destinatario-creation logic.

- [ ] **Step 2: Build gate + review**

Run: `cd webapp && pnpm build` → PASS. Run `zetas-front-guy`.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/app/\(dashboard\)/suscripciones webapp/src/components/subscriptions
git commit -m "feat(subscriptions): no-destinatario fallback nudge"
```

---

## Task 11: Mobile parity

**Run `mobile-webapp-parity` BEFORE starting (data-shape parity) and `mobile-sync-doctor` AFTER (sync correctness).**

**Files:**
- Modify: `mobile/lib/db/schema.ts`
- Create: `mobile/lib/repositories/subscriptions.ts`
- Modify: `mobile/lib/sync/pull.ts`, `mobile/lib/sync/push.ts`

- [ ] **Step 1: Add SQLite schema (view-aligned columns, not `_enc`)**

In `mobile/lib/db/schema.ts`, add (mirror the destinatarios CREATE TABLE; booleans → INTEGER, dates → TEXT, enum → TEXT):

```typescript
`CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  destinatario_id TEXT NOT NULL,
  recurring_template_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  estimated_amount REAL,
  currency_code TEXT NOT NULL DEFAULT 'COP',
  trial_ends_on TEXT,
  cancel_url TEXT,
  detected_at TEXT,
  dismissed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (destinatario_id) REFERENCES destinatarios(id),
  FOREIGN KEY (recurring_template_id) REFERENCES recurring_transaction_templates(id)
)`,
```

- [ ] **Step 2: Register in pull + push sync**

Add `"subscriptions"` to the `SYNC_TABLES` array in `mobile/lib/sync/pull.ts` and the equivalent list in `mobile/lib/sync/push.ts`. Pull reads the `subscriptions` **view** (decrypted columns); push must exclude DB-computed fields (`created_at`/`updated_at` are server-managed) and go through the view.

- [ ] **Step 3: Repository read**

Create `mobile/lib/repositories/subscriptions.ts` mirroring `destinatarios.ts`:

```typescript
import { getDatabase } from "../db/database";

export async function getActiveSubscriptions() {
  const db = await getDatabase();
  return db.getAllAsync(
    `SELECT s.*, d.name AS destinatario_name, t.amount AS template_amount, t.frequency AS template_frequency
     FROM subscriptions s
     LEFT JOIN destinatarios d ON s.destinatario_id = d.id
     LEFT JOIN recurring_transaction_templates t ON s.recurring_template_id = t.id
     WHERE s.status NOT IN ('dismissed', 'cancelled')
     ORDER BY s.created_at DESC`
  );
}
```

- [ ] **Step 4: Verify mobile typecheck/build**

Run the mobile typecheck (per `mobile/package.json` — e.g. `cd mobile && pnpm tsc --noEmit` or the project's lint script). Expected: PASS.

- [ ] **Step 5: `mobile-sync-doctor` review**

Confirm: schema columns match the Supabase **view** (not `_enc`), boolean/enum/date mapping correct, push payload excludes server-managed fields, pull hits the view.

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/db/schema.ts mobile/lib/repositories/subscriptions.ts mobile/lib/sync/pull.ts mobile/lib/sync/push.ts
git commit -m "feat(subscriptions): mobile SQLite schema, repository, and sync registration"
```

---

## Final gates (before PR)

- [ ] `cd /Users/cristian/Documents/developing/current-projects/zeta && pnpm install` (root — lockfile sync if any dep changed; none expected).
- [ ] `cd webapp && pnpm build` → PASS.
- [ ] `cd packages/shared && pnpm vitest run` → PASS (detector tests).
- [ ] `pnpm audit --audit-level high` (root) → no new high/critical.
- [ ] Dry-merge against main: `git fetch origin main && git merge --no-commit --no-ff origin/main`, resolve/inspect, then `git merge --abort`.
- [ ] Review gates run and clean: `supabase-migrator` (Task 1), `server-action-reviewer` (Tasks 4/8/9), `zetas-front-guy` (Tasks 5/6/9/10), `perf-auditor` (Task 6), `recurring-doctor` (Tasks 6/9), `import-flow-doctor` (Task 8), `mobile-webapp-parity` + `mobile-sync-doctor` (Task 11).
- [ ] Open PR to `main` with summary + spec link.

## Deferred (Phase 3 — separate spec, NOT in this plan)

Active management: trial-ending alerts (`trial_ends_on`), price-increase detection, cancel-flow UX with `cancel_url`, mobile suggestion UI. The columns exist; the workflows are out of scope here.
