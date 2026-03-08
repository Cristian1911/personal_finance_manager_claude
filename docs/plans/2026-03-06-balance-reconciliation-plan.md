# Manual Balance Reconciliation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users update an account's balance by entering the real amount they see in their banking app, creating an excluded adjustment transaction to record the delta.

**Architecture:** A server action `reconcileBalance` computes the delta between stored and real balance, inserts an excluded adjustment transaction, and updates the account's `current_balance` + `updated_at`. A client-side dialog (`ReconcileBalanceDialog`) collects the new balance with live delta preview and triggers the action. The dialog is mounted on the account detail page header.

**Tech Stack:** Next.js 15 Server Actions, React `useActionState`, shadcn/ui Dialog, Supabase, Zod validation.

---

### Task 1: Create `reconcileBalance` server action

**Files:**
- Modify: `webapp/src/actions/accounts.ts` (add function at end, after `toggleDashboardVisibility`)

**Step 1: Add the `reconcileBalance` function**

Add imports at top of file (merge with existing):

```typescript
import { computeIdempotencyKey } from "@zeta/shared";
```

Add function at the end of the file:

```typescript
export async function reconcileBalance(
  accountId: string,
  newBalance: number,
  notes?: string
): Promise<ActionResult<{ delta: number }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  // Fetch current account
  const { data: account, error: fetchError } = await supabase
    .from("accounts")
    .select("id, current_balance, currency_code")
    .eq("user_id", user.id)
    .eq("id", accountId)
    .single();

  if (fetchError || !account) {
    return { success: false, error: "Cuenta no encontrada" };
  }

  const delta = newBalance - account.current_balance;
  const now = new Date().toISOString();

  // Create adjustment transaction if there's a difference
  if (delta !== 0) {
    const direction = delta > 0 ? "INFLOW" : "OUTFLOW";
    const absDelta = Math.abs(delta);
    const rawDescription = `Ajuste manual de saldo (${now})`;

    const idempotencyKey = await computeIdempotencyKey({
      provider: "MANUAL",
      transactionDate: now.slice(0, 10),
      amount: absDelta,
      rawDescription,
    });

    const { error: txError } = await supabase.from("transactions").insert({
      user_id: user.id,
      account_id: accountId,
      amount: absDelta,
      currency_code: account.currency_code,
      direction,
      transaction_date: now.slice(0, 10),
      raw_description: rawDescription,
      clean_description: "Ajuste manual de saldo",
      merchant_name: null,
      category_id: null,
      notes: notes || null,
      idempotency_key: idempotencyKey,
      provider: "MANUAL",
      capture_method: "MANUAL_FORM",
      categorization_source: "SYSTEM_DEFAULT",
      is_excluded: true,
    });

    if (txError) {
      return { success: false, error: txError.message };
    }
  }

  // Update account balance and freshness timestamp
  const { error: updateError } = await supabase
    .from("accounts")
    .update({ current_balance: newBalance, updated_at: now })
    .eq("user_id", user.id)
    .eq("id", accountId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return { success: true, data: { delta } };
}
```

**Step 2: Verify build**

Run: `cd webapp && pnpm build 2>&1 | tail -5`
Expected: Build succeeds (no type errors in accounts.ts)

**Step 3: Commit**

```bash
git add webapp/src/actions/accounts.ts
git commit -m "feat: add reconcileBalance server action"
```

---

### Task 2: Create `ReconcileBalanceDialog` component

**Files:**
- Create: `webapp/src/components/accounts/reconcile-balance-dialog.tsx`

**Step 1: Create the dialog component**

Follow the pattern from `webapp/src/components/accounts/account-form-dialog.tsx` — a Dialog with `useState` for open/close.

```typescript
"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw } from "lucide-react";
import { reconcileBalance } from "@/actions/accounts";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

interface ReconcileBalanceDialogProps {
  accountId: string;
  accountName: string;
  currentBalance: number;
  currencyCode: string;
  trigger?: React.ReactNode;
}

export function ReconcileBalanceDialog({
  accountId,
  accountName,
  currentBalance,
  currencyCode,
  trigger,
}: ReconcileBalanceDialogProps) {
  const [open, setOpen] = useState(false);
  const [newBalance, setNewBalance] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const parsedBalance = parseFloat(newBalance);
  const isValid = newBalance !== "" && !isNaN(parsedBalance) && parsedBalance >= 0;

  const delta = useMemo(() => {
    if (!isValid) return null;
    return parsedBalance - currentBalance;
  }, [parsedBalance, isValid, currentBalance]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setNewBalance("");
      setNotes("");
      setError("");
    }
  }

  function handleSubmit() {
    if (!isValid) return;

    startTransition(async () => {
      const result = await reconcileBalance(accountId, parsedBalance, notes || undefined);
      if (result.success) {
        setOpen(false);
      } else {
        setError(result.error);
      }
    });
  }

  const currency = currencyCode as CurrencyCode;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar saldo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Actualizar saldo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm rounded-md p-3">
              {error}
            </div>
          )}

          <div>
            <p className="text-sm text-muted-foreground mb-1">{accountName}</p>
            <p className="text-sm">
              Saldo registrado:{" "}
              <span className="font-medium">
                {formatCurrency(currentBalance, currency)}
              </span>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-balance">Saldo real actual</Label>
            <Input
              id="new-balance"
              type="number"
              step="0.01"
              min="0"
              placeholder="0"
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Ingresa el saldo que ves en tu app bancaria o billetera
            </p>
          </div>

          {delta !== null && delta !== 0 && (
            <div
              className={`rounded-md p-3 text-sm ${
                delta > 0
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "bg-orange-500/10 text-orange-700 dark:text-orange-400"
              }`}
            >
              Diferencia: {delta > 0 ? "+" : ""}
              {formatCurrency(Math.abs(delta), currency)}
              <span className="block text-xs mt-0.5 opacity-80">
                Se creara un ajuste {delta > 0 ? "de ingreso" : "de gasto"} por
                esta diferencia
              </span>
            </div>
          )}

          {delta === 0 && isValid && (
            <div className="rounded-md p-3 text-sm bg-muted text-muted-foreground">
              El saldo ya coincide. Solo se actualizara la fecha de sincronizacion.
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reconcile-notes">Notas (opcional)</Label>
            <Input
              id="reconcile-notes"
              placeholder="Ej: Verifique en la app del banco"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!isValid || pending}
            className="w-full"
          >
            {pending ? "Actualizando..." : "Actualizar saldo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Verify build**

Run: `cd webapp && pnpm build 2>&1 | tail -5`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add webapp/src/components/accounts/reconcile-balance-dialog.tsx
git commit -m "feat: add ReconcileBalanceDialog component"
```

---

### Task 3: Add reconcile button to account detail page

**Files:**
- Modify: `webapp/src/app/(dashboard)/accounts/[id]/page.tsx`

**Step 1: Add import and button**

Add import at top (after existing imports):

```typescript
import { ReconcileBalanceDialog } from "@/components/accounts/reconcile-balance-dialog";
```

In the header `div` (the one with `className="flex items-center gap-4"`), add the `ReconcileBalanceDialog` between the `flex-1` div and the `AccountFormDialog`:

```tsx
<ReconcileBalanceDialog
  accountId={account.id}
  accountName={account.name}
  currentBalance={account.current_balance}
  currencyCode={account.currency_code}
/>
```

The header section should look like:

```tsx
<div className="flex items-center gap-4">
  <Link href="/accounts" className="text-muted-foreground hover:text-foreground">
    <ArrowLeft className="h-5 w-5" />
  </Link>
  <div className="flex-1">
    <h1 className="text-2xl font-bold">{account.name}</h1>
    {account.institution_name && (
      <p className="text-muted-foreground">{account.institution_name}</p>
    )}
  </div>
  <ReconcileBalanceDialog
    accountId={account.id}
    accountName={account.name}
    currentBalance={account.current_balance}
    currencyCode={account.currency_code}
  />
  <AccountFormDialog account={account} />
  <DeleteAccountButton accountId={account.id} />
</div>
```

**Step 2: Verify build**

Run: `cd webapp && pnpm build 2>&1 | tail -5`
Expected: Build succeeds

**Step 3: Manual verification**

1. Navigate to `/accounts/[any-account-id]`
2. See "Actualizar saldo" button in header
3. Click it — dialog opens showing current balance
4. Enter a different number — delta preview appears with color
5. Enter same number — "El saldo ya coincide" message
6. Submit — dialog closes, balance card updates
7. Check freshness in dashboard — should show "Actualizado hoy"

**Step 4: Commit**

```bash
git add webapp/src/app/\(dashboard\)/accounts/\[id\]/page.tsx
git commit -m "feat: add reconcile balance button to account detail page"
```

---

### Task 4: Add reconcile shortcut to dashboard accounts overview

**Files:**
- Modify: `webapp/src/components/dashboard/accounts-overview.tsx`

**Goal:** Add a small refresh icon button per account row that opens the reconcile dialog, so users can quickly update balances without navigating to the account detail page.

**Step 1: Update AccountRow to accept a reconcile action**

Add import at top:

```typescript
import { ReconcileBalanceDialog } from "@/components/accounts/reconcile-balance-dialog";
```

In the `AccountRow` component, replace the outer `<Link>` wrapper with a plain `<div>` (same classes minus `hover:bg-accent/50`) and wrap the left side (name + sparkline) in the `<Link>`. Then add a small reconcile trigger on the right side.

Replace the entire `AccountRow` function with:

```typescript
function AccountRow({ account }: { account: AccountWithSparkline }) {
  const isDebt = account.account_type === "CREDIT_CARD" || account.account_type === "LOAN";
  const kind = isDebt ? "debt" : "deposit";

  const changeColor = getAccountSemanticColor(account.changePercent, kind);
  const freshness = getFreshnessLevel(account.updated_at);
  const sparklineData = account.sparkline.map((p) => ({ value: p.balance }));

  const sparklineColor = account.utilization != null
    ? getCreditUtilizationColor(account.utilization)
    : changeColor;

  const cc = semanticColorMap[changeColor];
  const fc = freshnessMap[freshness];

  return (
    <div className="flex items-center justify-between py-2 px-2 -mx-2 rounded-md group">
      <Link
        href={`/accounts/${account.id}`}
        className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-80 transition-opacity"
      >
        <div className={`h-2 w-2 rounded-full shrink-0 ${fc.dot}`} />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{account.name}</p>
          {account.utilization != null && (
            <div className="flex items-center gap-2 mt-0.5">
              <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${semanticColorMap[getCreditUtilizationColor(account.utilization)].dot}`}
                  style={{ width: `${Math.min(account.utilization, 100)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {Math.round(account.utilization)}%
              </span>
            </div>
          )}
          {account.installmentProgress && (
            <p className="text-xs text-muted-foreground">
              Cuota {account.installmentProgress}
            </p>
          )}
        </div>
      </Link>

      <div className="flex items-center gap-2">
        <Sparkline data={sparklineData} color={sparklineColor} />
        <div className="text-right">
          <p className="text-sm font-medium">
            {formatCurrency(
              Math.abs(account.current_balance),
              account.currency_code as CurrencyCode
            )}
          </p>
          {account.changePercent !== 0 && (
            <p className={`text-xs ${cc.text}`}>
              {account.changePercent > 0 ? "+" : ""}
              {account.changePercent.toFixed(1)}%
            </p>
          )}
        </div>
        <ReconcileBalanceDialog
          accountId={account.id}
          accountName={account.name}
          currentBalance={account.current_balance}
          currencyCode={account.currency_code}
          trigger={
            <button className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-all">
              <RefreshCw className="h-3 w-3 text-muted-foreground" />
            </button>
          }
        />
      </div>
    </div>
  );
}
```

Add `RefreshCw` to the lucide imports. Since `accounts-overview.tsx` doesn't currently import from lucide, add:

```typescript
import { RefreshCw } from "lucide-react";
```

**Step 2: Verify build**

Run: `cd webapp && pnpm build 2>&1 | tail -5`
Expected: Build succeeds

**Step 3: Manual verification**

1. Go to `/dashboard`
2. Hover over an account row in the "Mis cuentas" card
3. Small refresh icon appears on the right
4. Click it — reconcile dialog opens for that account
5. Clicking the account name/sparkline still navigates to account detail

**Step 4: Commit**

```bash
git add webapp/src/components/dashboard/accounts-overview.tsx
git commit -m "feat: add per-account reconcile button in dashboard overview"
```

---

### Task 5: Final verification and commit

**Step 1: Full build check**

Run: `cd webapp && pnpm build 2>&1 | tail -10`
Expected: Build succeeds with no errors

**Step 2: End-to-end manual test**

1. Go to dashboard → see "Mis cuentas" card
2. Hover an account → see refresh icon
3. Click refresh icon → dialog opens with current balance
4. Enter a new balance → see colored delta preview
5. Submit → dialog closes, dashboard refreshes with new balance
6. Check freshness indicator updated to "Actualizado hoy"
7. Go to `/transactions` → see the excluded adjustment transaction
8. Go to `/accounts/[id]` → see updated balance, "Actualizar saldo" button works

**Step 3: Final commit (if any remaining changes)**

```bash
git add -A
git commit -m "feat: manual balance reconciliation (complete)"
```
