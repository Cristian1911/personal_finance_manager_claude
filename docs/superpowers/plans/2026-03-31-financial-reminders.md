# Financial Reminders ("Pendientes") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight one-time financial todo system with standalone page, dashboard widget, and attention system integration.

**Architecture:** New `financial_reminders` Supabase table with RLS. Server actions for CRUD. A standalone `/pendientes` page with inline add/complete/delete. A compact dashboard widget with quick-add. Overdue items surface as attention signals.

**Tech Stack:** Supabase (PostgreSQL), Next.js 16 App Router, Server Actions, Zod 4, Tailwind v4, shadcn/ui, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-31-impact-cards-and-reminders.md` (Feature 2)

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260331120000_create_financial_reminders.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Financial reminders: lightweight one-time financial todos
CREATE TABLE financial_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  amount numeric(15,2),
  currency_code text DEFAULT 'COP',
  due_date date,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE financial_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reminders"
  ON financial_reminders FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE INDEX idx_financial_reminders_user_pending
  ON financial_reminders (user_id, is_completed, due_date)
  WHERE NOT is_completed;
```

- [ ] **Step 2: Push migration**

Run: `npx supabase db push`
Expected: Migration applied successfully

- [ ] **Step 3: Regenerate types**

Run: `npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu > webapp/src/types/database.ts`

Verify the first line contains `export type Json =` (shell `compdef` warning can corrupt it — strip first line if needed).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260331120000_create_financial_reminders.sql webapp/src/types/database.ts
git commit -m "feat: create financial_reminders table with RLS"
```

---

### Task 2: Domain Type + Validator

**Files:**
- Modify: `webapp/src/types/domain.ts`
- Create: `webapp/src/lib/validators/reminders.ts`

- [ ] **Step 1: Add domain type alias**

In `webapp/src/types/domain.ts`, add alongside the other type aliases:

```typescript
export type FinancialReminder = Tables<"financial_reminders">;
```

- [ ] **Step 2: Create Zod validator**

Create `webapp/src/lib/validators/reminders.ts`:

```typescript
import { z } from "zod";

export const reminderSchema = z.object({
  title: z.string().min(1, "El título es requerido").max(200),
  amount: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().positive("El monto debe ser positivo").optional()
  ),
  currency_code: z.string().default("COP"),
  due_date: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : String(v)),
    z.string().optional()
  ),
});

export type ReminderInput = z.infer<typeof reminderSchema>;
```

- [ ] **Step 3: Commit**

```bash
git add webapp/src/types/domain.ts webapp/src/lib/validators/reminders.ts
git commit -m "feat: add FinancialReminder type and Zod validator"
```

---

### Task 3: Server Actions (CRUD)

**Files:**
- Create: `webapp/src/actions/reminders.ts`

- [ ] **Step 1: Implement all CRUD actions**

Create `webapp/src/actions/reminders.ts`:

```typescript
"use server";

import { cache } from "react";
import { revalidateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { reminderSchema } from "@/lib/validators/reminders";
import type { ActionResult } from "@/types/actions";
import type { FinancialReminder } from "@/types/domain";

export const getReminders = cache(
  async (filter?: "pending" | "completed"): Promise<FinancialReminder[]> => {
    const { supabase, user } = await getAuthenticatedClient();
    if (!user) return [];

    let query = supabase
      .from("financial_reminders")
      .select("*")
      .eq("user_id", user.id);

    if (filter === "pending") {
      query = query.eq("is_completed", false);
    } else if (filter === "completed") {
      query = query.eq("is_completed", true);
    }

    // Pending: overdue first (nulls last), then by due_date asc, then created_at desc
    // Completed: most recently completed first
    if (filter === "completed") {
      query = query.order("completed_at", { ascending: false });
    } else {
      query = query
        .order("is_completed")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
    }

    const { data, error } = await query;
    if (error) return [];
    return data ?? [];
  }
);

export async function getOverdueCount(): Promise<number> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return 0;

  const today = new Date().toISOString().split("T")[0];
  const { count, error } = await supabase
    .from("financial_reminders")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_completed", false)
    .lt("due_date", today);

  if (error) return 0;
  return count ?? 0;
}

export async function createReminder(
  formData: FormData
): Promise<ActionResult<FinancialReminder>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = reminderSchema.safeParse({
    title: formData.get("title"),
    amount: formData.get("amount"),
    currency_code: formData.get("currency_code") || "COP",
    due_date: formData.get("due_date"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { data, error } = await supabase
    .from("financial_reminders")
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      amount: parsed.data.amount ?? null,
      currency_code: parsed.data.currency_code,
      due_date: parsed.data.due_date ?? null,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidateTag("reminders", "zeta");
  revalidateTag("attention", "zeta");
  return { success: true, data };
}

export async function toggleReminder(
  id: string
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Fetch current state
  const { data: current, error: fetchError } = await supabase
    .from("financial_reminders")
    .select("is_completed")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !current) {
    return { success: false, error: "Pendiente no encontrado" };
  }

  const nowCompleted = !current.is_completed;

  const { error } = await supabase
    .from("financial_reminders")
    .update({
      is_completed: nowCompleted,
      completed_at: nowCompleted ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidateTag("reminders", "zeta");
  revalidateTag("attention", "zeta");
  return { success: true, data: null };
}

export async function deleteReminder(
  id: string
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("financial_reminders")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidateTag("reminders", "zeta");
  revalidateTag("attention", "zeta");
  return { success: true, data: null };
}
```

- [ ] **Step 2: Build check**

Run: `cd webapp && pnpm build`
Expected: Clean build (actions compile, types resolve)

- [ ] **Step 3: Commit**

```bash
git add webapp/src/actions/reminders.ts
git commit -m "feat: add reminders server actions (CRUD + overdue count)"
```

---

### Task 4: Reminder Components

**Files:**
- Create: `webapp/src/components/reminders/reminder-item.tsx`
- Create: `webapp/src/components/reminders/reminder-quick-add.tsx`
- Create: `webapp/src/components/reminders/reminders-list.tsx`

- [ ] **Step 1: Create ReminderItem**

Create `webapp/src/components/reminders/reminder-item.tsx`:

```typescript
"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toggleReminder, deleteReminder } from "@/actions/reminders";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import type { FinancialReminder } from "@/types/domain";
import type { CurrencyCode } from "@/types/domain";

interface ReminderItemProps {
  reminder: FinancialReminder;
  compact?: boolean;
}

export function ReminderItem({ reminder, compact = false }: ReminderItemProps) {
  const [isPending, startTransition] = useTransition();

  const today = new Date().toISOString().split("T")[0];
  const isOverdue =
    !reminder.is_completed && reminder.due_date && reminder.due_date < today;

  function handleToggle() {
    startTransition(async () => {
      await toggleReminder(reminder.id);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteReminder(reminder.id);
    });
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
        reminder.is_completed && "opacity-60",
        isOverdue && "border-z-debt/30 bg-z-debt/5",
        !isOverdue && !reminder.is_completed && "bg-card hover:bg-accent/50",
        isPending && "opacity-50 pointer-events-none"
      )}
    >
      <Checkbox
        checked={reminder.is_completed}
        onCheckedChange={handleToggle}
        aria-label={`Completar: ${reminder.title}`}
      />

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm truncate",
            reminder.is_completed && "line-through text-muted-foreground"
          )}
        >
          {reminder.title}
        </p>
        {!compact && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {reminder.amount != null && (
              <span className="tabular-nums">
                {formatCurrency(
                  reminder.amount,
                  (reminder.currency_code ?? "COP") as CurrencyCode
                )}
              </span>
            )}
            {reminder.due_date && (
              <span className={cn(isOverdue && "text-z-debt font-medium")}>
                {isOverdue ? "Vencido: " : ""}
                {formatDate(reminder.due_date, "dd MMM")}
              </span>
            )}
          </div>
        )}
      </div>

      {!compact && reminder.due_date && !reminder.is_completed && (
        <span
          className={cn(
            "shrink-0 text-xs",
            isOverdue ? "text-z-debt font-medium" : "text-muted-foreground"
          )}
        >
          {formatDate(reminder.due_date, "dd MMM")}
        </span>
      )}

      {compact && reminder.due_date && !reminder.is_completed && (
        <span
          className={cn(
            "shrink-0 text-[11px]",
            isOverdue ? "text-z-debt" : "text-muted-foreground"
          )}
        >
          {formatDate(reminder.due_date, "dd MMM")}
        </span>
      )}

      {!compact && (
        <button
          type="button"
          onClick={handleDelete}
          className="shrink-0 rounded p-1 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 transition-opacity"
          aria-label="Eliminar"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create ReminderQuickAdd**

Create `webapp/src/components/reminders/reminder-quick-add.tsx`:

```typescript
"use client";

import { useRef, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createReminder } from "@/actions/reminders";
import { toast } from "sonner";

interface ReminderQuickAddProps {
  showExtras?: boolean;
}

export function ReminderQuickAdd({ showExtras = false }: ReminderQuickAddProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const title = formData.get("title")?.toString().trim();
    if (!title) return;

    formRef.current?.reset();

    startTransition(async () => {
      const result = await createReminder(formData);
      if (!result.success) {
        toast.error(result.error);
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex items-center gap-2">
      <input
        name="title"
        type="text"
        placeholder="Agregar pendiente..."
        required
        className="flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-z-brass/50"
        disabled={isPending}
      />
      {showExtras && (
        <>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="Monto"
            className="w-28 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-z-brass/50"
            disabled={isPending}
          />
          <input
            name="due_date"
            type="date"
            className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-z-brass/50"
            disabled={isPending}
          />
        </>
      )}
      <Button
        type="submit"
        size="sm"
        disabled={isPending}
        className="h-9 gap-1 bg-z-brass text-z-ink hover:bg-z-brass/90"
      >
        <Plus className="h-4 w-4" />
        {showExtras && "Agregar"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Create RemindersList**

Create `webapp/src/components/reminders/reminders-list.tsx`:

```typescript
"use client";

import { ReminderItem } from "./reminder-item";
import { ReminderQuickAdd } from "./reminder-quick-add";
import type { FinancialReminder } from "@/types/domain";

interface RemindersListProps {
  pending: FinancialReminder[];
  completed: FinancialReminder[];
}

export function RemindersList({ pending, completed }: RemindersListProps) {
  return (
    <div className="space-y-6">
      <ReminderQuickAdd showExtras />

      {/* Pending section */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Pendientes ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Sin pendientes. Agrega uno arriba.
          </p>
        ) : (
          <div className="space-y-1.5">
            {pending.map((r) => (
              <ReminderItem key={r.id} reminder={r} />
            ))}
          </div>
        )}
      </div>

      {/* Completed section */}
      {completed.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Completados ({completed.length})
          </h2>
          <div className="space-y-1.5">
            {completed.map((r) => (
              <ReminderItem key={r.id} reminder={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Build check**

Run: `cd webapp && pnpm build`
Expected: Clean build

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/reminders/
git commit -m "feat: add ReminderItem, ReminderQuickAdd, RemindersList components"
```

---

### Task 5: Standalone Page `/pendientes`

**Files:**
- Create: `webapp/src/app/(dashboard)/pendientes/page.tsx`

- [ ] **Step 1: Create page**

Create `webapp/src/app/(dashboard)/pendientes/page.tsx`:

```typescript
import { connection } from "next/server";
import { getReminders } from "@/actions/reminders";
import { RemindersList } from "@/components/reminders/reminders-list";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";

export default async function PendientesPage() {
  await connection();
  const [pending, completed] = await Promise.all([
    getReminders("pending"),
    getReminders("completed"),
  ]);

  // Limit completed to last 10
  const recentCompleted = completed.slice(0, 10);

  return (
    <div className="space-y-6">
      <MobilePageHeader title="Pendientes" backHref="/dashboard" />

      <div className="hidden lg:block space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          Pendientes
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Tu lista de pendientes financieros
        </h1>
        <p className="text-muted-foreground">
          Cosas que debes pagar o resolver. No son recurrentes, solo tareas puntuales.
        </p>
      </div>

      <div className="lg:hidden space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          Pendientes
        </p>
        <h1 className="text-2xl font-semibold">Tus pendientes financieros</h1>
        <p className="text-sm text-muted-foreground">
          Tareas puntuales que debes pagar o resolver.
        </p>
      </div>

      <RemindersList pending={pending} completed={recentCompleted} />
    </div>
  );
}
```

- [ ] **Step 2: Build check**

Run: `cd webapp && pnpm build`
Expected: `/pendientes` route appears in build output

- [ ] **Step 3: Commit**

```bash
git add webapp/src/app/\(dashboard\)/pendientes/
git commit -m "feat: add /pendientes page for financial reminders"
```

---

### Task 6: Dashboard Widget

**Files:**
- Create: `webapp/src/components/reminders/pendientes-widget.tsx`
- Modify: `webapp/src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Create PendientesWidget**

Create `webapp/src/components/reminders/pendientes-widget.tsx`:

```typescript
import Link from "next/link";
import { ArrowRight, ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReminderItem } from "./reminder-item";
import { ReminderQuickAdd } from "./reminder-quick-add";
import type { FinancialReminder } from "@/types/domain";

interface PendientesWidgetProps {
  reminders: FinancialReminder[];
}

export function PendientesWidget({ reminders }: PendientesWidgetProps) {
  return (
    <Card className="border-white/6 bg-z-surface-2/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-z-sage-dark" />
          <CardTitle className="text-sm font-semibold">Pendientes</CardTitle>
        </div>
        <Link
          href="/pendientes"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          Ver todos
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {reminders.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">
            Sin pendientes
          </p>
        ) : (
          <div className="space-y-1">
            {reminders.map((r) => (
              <ReminderItem key={r.id} reminder={r} compact />
            ))}
          </div>
        )}
        <ReminderQuickAdd />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Integrate into dashboard page**

In `webapp/src/app/(dashboard)/dashboard/page.tsx`:

Add import:
```typescript
import { getReminders } from "@/actions/reminders";
import { PendientesWidget } from "@/components/reminders/pendientes-widget";
```

Add to the `Promise.all` data fetch block:
```typescript
getReminders("pending"),
```

Destructure the result and slice to 5 items:
```typescript
const pendingReminders = fetchedReminders.slice(0, 5);
```

Add the widget in the dashboard grid (after existing widgets, in an appropriate section):
```tsx
<PendientesWidget reminders={pendingReminders} />
```

The exact insertion point depends on the current dashboard layout — place it after the accounts section or wherever compact widgets live. Follow the existing `Card` / grid pattern.

- [ ] **Step 3: Build check**

Run: `cd webapp && pnpm build`
Expected: Clean build, `/pendientes` + dashboard still render

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/reminders/pendientes-widget.tsx webapp/src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat: add PendientesWidget to dashboard with quick-add"
```

---

### Task 7: Navigation + Attention Integration

**Files:**
- Modify: `webapp/src/lib/constants/navigation.ts`
- Modify: `webapp/src/types/attention.ts`
- Modify: `webapp/src/actions/attention.ts`

- [ ] **Step 1: Add nav item**

In `webapp/src/lib/constants/navigation.ts`:

Add import:
```typescript
import { ListChecks } from "lucide-react";
```

Add to `WORKSPACE_NAV` array (after Etiquetas):
```typescript
{ title: "Pendientes", href: "/pendientes", icon: ListChecks, attentionPage: "pendientes" },
```

- [ ] **Step 2: Extend attention types**

In `webapp/src/types/attention.ts`, update `AttentionPage`:

```typescript
export type AttentionPage = "transactions" | "categories" | "destinatarios" | "recurrentes" | "pendientes";
```

- [ ] **Step 3: Add overdue signal to attention snapshot**

In `webapp/src/actions/attention.ts`:

Add import:
```typescript
import { getOverdueCount } from "@/actions/reminders";
```

Inside `getAttentionSnapshot()`, after the existing signal computations, add:

```typescript
const overdueCount = await getOverdueCount();
if (overdueCount > 0) {
  signals.push({
    page: "pendientes",
    key: "overdue_reminders",
    count: overdueCount,
    label: overdueCount === 1
      ? "1 pendiente vencido"
      : `${overdueCount} pendientes vencidos`,
    priority: "action",
    actionHref: "/pendientes",
  });
}
```

- [ ] **Step 4: Build check**

Run: `cd webapp && pnpm build`
Expected: Clean build

- [ ] **Step 5: Commit**

```bash
git add webapp/src/lib/constants/navigation.ts webapp/src/types/attention.ts webapp/src/actions/attention.ts
git commit -m "feat: add Pendientes to nav + overdue attention signal"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Full build**

Run: `cd webapp && pnpm build`
Expected: Clean build with `/pendientes` route listed

- [ ] **Step 2: Verify route exists**

Check build output includes `◐ /pendientes`

- [ ] **Step 3: Commit any remaining changes**

If any files were missed, stage and commit.
