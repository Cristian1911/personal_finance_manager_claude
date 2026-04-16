# Account aliases + mini icons — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users rename every Zeta account to a short alias and render a mini bank logo next to the alias on every row, dropdown, and detail surface across the webapp — with zero schema migrations.

**Architecture:** Reuse the existing `accounts.name` column as the alias (already encrypted + user-editable). Ship a new `<AccountIcon>` primitive that maps `accounts.provider` → bundled SVG components (10 Colombian banks) with a `lucide-react` fallback by `account_type` for MANUAL accounts. Compose it with name and optional mask via `<AccountRowIdentity density="compact" | "picker" | "detail">` — one component replaces every `account.name` render site.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, `lucide-react`, Vitest for the pure primitives, Playwright MCP for visual verification at 390×844.

**Spec:** `docs/superpowers/specs/2026-04-17-account-aliases-design.md`

---

## File Structure

**New:**
- `webapp/src/lib/icons/bank-logos/bancolombia.tsx` — Bancolombia brand mark SVG component.
- `webapp/src/lib/icons/bank-logos/nu.tsx` — Nu (Nubank) SVG.
- `webapp/src/lib/icons/bank-logos/davivienda.tsx` — Davivienda SVG.
- `webapp/src/lib/icons/bank-logos/falabella.tsx` — Falabella SVG.
- `webapp/src/lib/icons/bank-logos/banco-de-bogota.tsx` — Banco de Bogotá SVG.
- `webapp/src/lib/icons/bank-logos/lulo.tsx` — Lulo Bank SVG.
- `webapp/src/lib/icons/bank-logos/confiar.tsx` — Confiar SVG.
- `webapp/src/lib/icons/bank-logos/popular.tsx` — Banco Popular SVG.
- `webapp/src/lib/icons/bank-logos/nequi.tsx` — Nequi SVG.
- `webapp/src/lib/icons/bank-logos/index.ts` — registry mapping `data_provider` enum values to SVG components.
- `webapp/src/components/accounts/account-icon.tsx` — `<AccountIcon>` primitive with provider→SVG + account_type→lucide fallback.
- `webapp/src/components/accounts/account-icon.test.ts` — Vitest cases for the resolver.
- `webapp/src/components/accounts/account-row-identity.tsx` — `<AccountRowIdentity>` composer (three densities).
- `webapp/src/components/accounts/account-row-identity.test.tsx` — Vitest cases for density/mask/null handling.

**Modified:**
- `webapp/src/actions/transactions.ts` — extend `RecentTransaction.accounts` select + type with `provider`, `account_type`, `mask`.
- `webapp/src/components/mobile/v2/inicio/inicio-activity.tsx` — Reciente rows use `<AccountRowIdentity density="compact">`.
- `webapp/src/components/recurring/use-recurring-month.ts` — extend `OccurrenceItem` with `account: AccountDisplay & { name, mask }`; update `mapToOccurrenceItem`.
- `webapp/src/components/mobile/v2/plan/mobile-recurrentes-view.tsx` — occurrence rows use `<AccountRowIdentity density="compact">`.
- `webapp/src/components/mobile/v2/plan/mobile-recurrentes-templates-strip.tsx` — template rows use `<AccountRowIdentity density="picker">`.
- `webapp/src/components/recurring/link-picker-sheet.tsx` — source-account options.
- `webapp/src/components/recurring/recurring-form-dialog.tsx` — account dropdown.
- `webapp/src/components/cashflow-planner/entry-form-dialog.tsx` — account dropdown.
- `webapp/src/components/cashflow-planner/assignment-dialog.tsx` — account options.
- `webapp/src/components/cashflow-planner/pay-expense-dialog.tsx` — source selection.
- `webapp/src/components/mobile/v2/deudas/deudas-accounts-accordion.tsx` — compact rows + detail on expand.
- `webapp/src/app/(dashboard)/accounts/page.tsx` — list rendering.
- `webapp/src/app/(dashboard)/accounts/[id]/page.tsx` — detail hero.
- The account edit dialog file (the implementation task will discover the exact path via grep — Task 8).
- `webapp/src/components/import/import-wizard.tsx` — account-matching step.

---

## Task 1: Bank logo SVGs + `<AccountIcon>` primitive

**Files:**
- Create: 9 SVG component files under `webapp/src/lib/icons/bank-logos/`
- Create: `webapp/src/lib/icons/bank-logos/index.ts`
- Create: `webapp/src/components/accounts/account-icon.tsx`
- Create: `webapp/src/components/accounts/account-icon.test.ts`

- [ ] **Step 1.1: Write the registry + bank SVG template**

Create `webapp/src/lib/icons/bank-logos/bancolombia.tsx`:

```tsx
interface BrandMarkProps {
  className?: string;
  "aria-hidden"?: boolean;
}

export function BancolombiaMark({ className, "aria-hidden": ariaHidden = true }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden={ariaHidden}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="24" height="24" rx="5" fill="#FDDA24" />
      <path
        d="M7.2 7.5h4.6c1.9 0 3.2 1 3.2 2.6 0 .9-.5 1.6-1.2 2 .9.3 1.5 1.1 1.5 2.2 0 1.7-1.4 2.7-3.5 2.7H7.2V7.5zm4.4 3.6c.8 0 1.3-.4 1.3-1s-.5-1-1.3-1H9.2v2h2.4zm.2 3.6c.9 0 1.4-.4 1.4-1.1s-.5-1.1-1.4-1.1H9.2v2.2h2.6z"
        fill="#1A1A1A"
      />
    </svg>
  );
}
```

**Copy-paste-adapt pattern for the other 8 banks** — change the `rx`, `fill`, and path/initial letter. Use these brand colors + initials:

- `nu.tsx` → `NuMark`, bg `#8A05BE`, white letter `N`
- `davivienda.tsx` → `DaviviendaMark`, bg `#E1251B`, white letter `D`
- `falabella.tsx` → `FalabellaMark`, bg `#00A859`, white letter `F`
- `banco-de-bogota.tsx` → `BancoBogotaMark`, bg `#003F87`, white letter `B`
- `lulo.tsx` → `LuloMark`, bg `#00BFA5`, white letter `L`
- `confiar.tsx` → `ConfiarMark`, bg `#002A5C`, white letter `C`
- `popular.tsx` → `PopularMark`, bg `#007A33`, white letter `P`
- `nequi.tsx` → `NequiMark`, bg `#C03BD9`, white letter `N`

Template with a centered letter (use this for 8 of 9 — Bancolombia keeps its custom path):

```tsx
interface BrandMarkProps {
  className?: string;
  "aria-hidden"?: boolean;
}

export function NuMark({ className, "aria-hidden": ariaHidden = true }: BrandMarkProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden={ariaHidden} xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="5" fill="#8A05BE" />
      <text x="12" y="17" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="700" fontSize="14" fill="#FFFFFF">
        N
      </text>
    </svg>
  );
}
```

Repeat the letter-template for `davivienda.tsx` (letter D, `#E1251B`), `falabella.tsx` (F, `#00A859`), `banco-de-bogota.tsx` (B, `#003F87`), `lulo.tsx` (L, `#00BFA5`), `confiar.tsx` (C, `#002A5C`), `popular.tsx` (P, `#007A33`), `nequi.tsx` (N, `#C03BD9`).

- [ ] **Step 1.2: Create the registry**

Create `webapp/src/lib/icons/bank-logos/index.ts`:

```ts
import type { Database } from "@/types/database";
import { BancolombiaMark } from "./bancolombia";
import { NuMark } from "./nu";
import { DaviviendaMark } from "./davivienda";
import { FalabellaMark } from "./falabella";
import { BancoBogotaMark } from "./banco-de-bogota";
import { LuloMark } from "./lulo";
import { ConfiarMark } from "./confiar";
import { PopularMark } from "./popular";
import { NequiMark } from "./nequi";

type Provider = Database["public"]["Enums"]["data_provider"];
type BrandMark = (props: { className?: string; "aria-hidden"?: boolean }) => React.ReactElement;

export const BANK_LOGOS: Partial<Record<Provider, BrandMark>> = {
  BANCOLOMBIA: BancolombiaMark,
  NU: NuMark,
  DAVIVIENDA: DaviviendaMark,
  FALABELLA: FalabellaMark,
  BANCO_DE_BOGOTA: BancoBogotaMark,
  LULO: LuloMark,
  CONFIAR: ConfiarMark,
  POPULAR: PopularMark,
  NEQUI: NequiMark,
};
```

Before saving, open `webapp/src/types/database.ts` and grep for `data_provider:` to confirm the enum value names (they are SCREAMING_SNAKE_CASE matching the registry keys above). If any differ, align the keys to the enum values; do NOT invent new enum values.

- [ ] **Step 1.3: Create the `<AccountIcon>` component**

Create `webapp/src/components/accounts/account-icon.tsx`:

```tsx
import {
  Wallet,
  PiggyBank,
  CreditCard,
  Landmark,
  Banknote,
  TrendingUp,
} from "lucide-react";
import { BANK_LOGOS } from "@/lib/icons/bank-logos";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Provider = Database["public"]["Enums"]["data_provider"];
type AccountType = Database["public"]["Enums"]["account_type"];

const TYPE_GLYPHS: Record<AccountType, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  CHECKING: Wallet,
  SAVINGS: PiggyBank,
  CREDIT_CARD: CreditCard,
  LOAN: Landmark,
  CASH: Banknote,
  INVESTMENT: TrendingUp,
};

interface AccountIconProps {
  provider: Provider;
  account_type: AccountType;
  color?: string | null;
  size?: "sm" | "md";
  className?: string;
}

export function AccountIcon({
  provider,
  account_type,
  color,
  size = "sm",
  className,
}: AccountIconProps) {
  const BankLogo = BANK_LOGOS[provider];
  const dim = size === "sm" ? "size-4" : "size-6";

  if (BankLogo) {
    return <BankLogo className={cn(dim, className)} aria-hidden />;
  }

  const Glyph = TYPE_GLYPHS[account_type] ?? Wallet;
  const tintStyle = color ? { backgroundColor: `${color}1a`, color } : undefined;
  const wrapDim = size === "sm" ? "size-5" : "size-7";
  const iconDim = size === "sm" ? "size-3.5" : "size-5";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md",
        wrapDim,
        !color && "bg-white/5 text-muted-foreground",
        className,
      )}
      style={tintStyle}
    >
      <Glyph className={iconDim} aria-hidden />
    </span>
  );
}
```

Before saving, confirm the `account_type` enum values in `webapp/src/types/database.ts` match the keys in `TYPE_GLYPHS`. The canonical set includes at least `CHECKING | SAVINGS | CREDIT_CARD | LOAN | CASH | INVESTMENT`. If a value exists that is missing from `TYPE_GLYPHS`, add a reasonable glyph mapping rather than falling through to the `?? Wallet` default — every enum value should have an explicit mapping.

- [ ] **Step 1.4: Write the test**

Create `webapp/src/components/accounts/account-icon.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { BANK_LOGOS } from "@/lib/icons/bank-logos";

describe("BANK_LOGOS registry", () => {
  it("has entries for the 9 Colombian banks", () => {
    expect(BANK_LOGOS.BANCOLOMBIA).toBeDefined();
    expect(BANK_LOGOS.NU).toBeDefined();
    expect(BANK_LOGOS.DAVIVIENDA).toBeDefined();
    expect(BANK_LOGOS.FALABELLA).toBeDefined();
    expect(BANK_LOGOS.BANCO_DE_BOGOTA).toBeDefined();
    expect(BANK_LOGOS.LULO).toBeDefined();
    expect(BANK_LOGOS.CONFIAR).toBeDefined();
    expect(BANK_LOGOS.POPULAR).toBeDefined();
    expect(BANK_LOGOS.NEQUI).toBeDefined();
  });

  it("has no entry for MANUAL (falls back to account_type glyph)", () => {
    expect(BANK_LOGOS.MANUAL).toBeUndefined();
  });
});
```

- [ ] **Step 1.5: Run test**

Run: `cd webapp && pnpm vitest run src/components/accounts/account-icon.test.ts`
Expected: 2 passing.

- [ ] **Step 1.6: Verify build**

Run: `cd webapp && pnpm build`
Expected: `✓ Compiled successfully`. No errors.

- [ ] **Step 1.7: Commit**

```bash
git add webapp/src/lib/icons/bank-logos/ webapp/src/components/accounts/account-icon.tsx webapp/src/components/accounts/account-icon.test.ts
git commit -m "feat(accounts): AccountIcon primitive + 9 bank logos

Provider-keyed bank SVG registry (BANCOLOMBIA, NU, DAVIVIENDA, FALABELLA,
BANCO_DE_BOGOTA, LULO, CONFIAR, POPULAR, NEQUI). MANUAL and other providers
fall back to a lucide glyph keyed on account_type (Wallet / PiggyBank /
CreditCard / Landmark / Banknote / TrendingUp).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `<AccountRowIdentity>` composer

**Files:**
- Create: `webapp/src/components/accounts/account-row-identity.tsx`
- Create: `webapp/src/components/accounts/account-row-identity.test.tsx`

- [ ] **Step 2.1: Write the composer**

Create `webapp/src/components/accounts/account-row-identity.tsx`:

```tsx
import { AccountIcon } from "./account-icon";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Provider = Database["public"]["Enums"]["data_provider"];
type AccountType = Database["public"]["Enums"]["account_type"];

export interface AccountIdentity {
  name: string;
  mask: string | null;
  provider: Provider;
  account_type: AccountType;
  color: string | null;
  institution_name?: string | null;
}

interface AccountRowIdentityProps {
  account: AccountIdentity;
  density: "compact" | "picker" | "detail";
  className?: string;
}

export function AccountRowIdentity({ account, density, className }: AccountRowIdentityProps) {
  const iconSize = density === "detail" ? "md" : "sm";
  const showMask = (density === "picker" || density === "detail") && !!account.mask;

  if (density === "detail") {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <AccountIcon
          provider={account.provider}
          account_type={account.account_type}
          color={account.color}
          size="md"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{account.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {account.institution_name ?? ""}
            {account.institution_name && account.mask ? " · " : ""}
            {account.mask ? `****${account.mask}` : ""}
          </p>
        </div>
      </div>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 min-w-0", className)}>
      <AccountIcon
        provider={account.provider}
        account_type={account.account_type}
        color={account.color}
        size={iconSize}
      />
      <span className="truncate">{account.name}</span>
      {showMask && (
        <span className="shrink-0 text-muted-foreground">· ****{account.mask}</span>
      )}
    </span>
  );
}
```

- [ ] **Step 2.2: Write the test**

Create `webapp/src/components/accounts/account-row-identity.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AccountRowIdentity, type AccountIdentity } from "./account-row-identity";

const base: AccountIdentity = {
  name: "Caja",
  mask: "4398",
  provider: "BANCOLOMBIA",
  account_type: "SAVINGS",
  color: "#FDDA24",
  institution_name: "Bancolombia",
};

describe("<AccountRowIdentity>", () => {
  it("renders alias only in compact density", () => {
    const { container } = render(<AccountRowIdentity account={base} density="compact" />);
    expect(container.textContent).toContain("Caja");
    expect(container.textContent).not.toContain("4398");
  });

  it("renders alias + mask in picker density", () => {
    const { container } = render(<AccountRowIdentity account={base} density="picker" />);
    expect(container.textContent).toContain("Caja");
    expect(container.textContent).toContain("****4398");
  });

  it("renders alias + institution + mask in detail density", () => {
    const { container } = render(<AccountRowIdentity account={base} density="detail" />);
    expect(container.textContent).toContain("Caja");
    expect(container.textContent).toContain("Bancolombia");
    expect(container.textContent).toContain("****4398");
  });

  it("omits mask cleanly when account.mask is null in picker density", () => {
    const { container } = render(
      <AccountRowIdentity account={{ ...base, mask: null }} density="picker" />,
    );
    expect(container.textContent).toContain("Caja");
    expect(container.textContent).not.toContain("****");
  });
});
```

- [ ] **Step 2.3: Confirm test deps are in place**

`@testing-library/react` is required by the `.test.tsx` render helper. Before running, confirm it's installed:

Run: `cd webapp && grep '"@testing-library/react"' package.json`
Expected: the dependency appears. If it does NOT, install it:

```bash
cd webapp && pnpm add -D @testing-library/react
```

Then re-run `pnpm install` from the repo root to sync the root lockfile:

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta && pnpm install
```

- [ ] **Step 2.4: Run tests**

Run: `cd webapp && pnpm vitest run src/components/accounts/account-row-identity.test.tsx`
Expected: 4 passing.

- [ ] **Step 2.5: Verify build**

Run: `cd webapp && pnpm build`
Expected: clean.

- [ ] **Step 2.6: Commit**

```bash
git add webapp/src/components/accounts/account-row-identity.tsx webapp/src/components/accounts/account-row-identity.test.tsx
# Also add package.json / pnpm-lock.yaml if the testing-library dep was newly added.
git commit -m "feat(accounts): AccountRowIdentity composer

Three densities — compact (row), picker (row + mask), detail (icon + alias
+ institution · mask). Null mask gracefully disappears. Tested with Vitest
across the three densities + the null-mask fallback.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Extend `RecentTransaction` + wire Dashboard Reciente

**Files:**
- Modify: `webapp/src/actions/transactions.ts:573-621` (type + select)
- Modify: `webapp/src/components/mobile/v2/inicio/inicio-activity.tsx`

- [ ] **Step 3.1: Extend the `RecentTransaction.accounts` projection**

Open `webapp/src/actions/transactions.ts`. Replace the `accounts` field in the type (line ~585) AND the select string (line ~610):

```ts
// Type — around line 585:
accounts: {
  name: string;
  color: string | null;
  mask: string | null;
  provider: Database["public"]["Enums"]["data_provider"];
  account_type: Database["public"]["Enums"]["account_type"];
} | null;
```

```ts
// Select — around line 610, extend the accounts join:
accounts!transactions_account_id_fkey(name, color, mask, provider, account_type),
```

Confirm `Database` is already imported at the top of the file — it is via `import type { Database } from "@/types/database";` (grep before editing; if absent, add it).

- [ ] **Step 3.2: Wire Reciente rows**

Open `webapp/src/components/mobile/v2/inicio/inicio-activity.tsx`. Find every render site that uses `tx.accounts?.name` or equivalent (grep inside the file for `accounts?.name` and `accounts?.color`). Replace each with `<AccountRowIdentity account={...} density="compact" />`, passing an `AccountIdentity` built from the projected fields:

```tsx
import { AccountRowIdentity } from "@/components/accounts/account-row-identity";
```

Render snippet — adapt to whatever wrapper currently exists in the row:

```tsx
{tx.accounts && (
  <AccountRowIdentity
    account={{
      name: tx.accounts.name,
      mask: tx.accounts.mask,
      provider: tx.accounts.provider,
      account_type: tx.accounts.account_type,
      color: tx.accounts.color,
    }}
    density="compact"
    className="text-[11px] text-muted-foreground"
  />
)}
```

If the existing inicio-activity renders account info as raw text alongside other chips (date, amount), keep the surrounding structure; only the account span is replaced.

- [ ] **Step 3.3: Verify build**

Run: `cd webapp && pnpm build`
Expected: clean. Type errors here mean the select/type mismatch — fix the type until it compiles.

- [ ] **Step 3.4: Visual check**

Start dev if not running (background). Navigate with Playwright MCP to `/dashboard` at 390×844. Capture `audit/2026-04-18/01-reciente-compact.png`. Confirm:
- Each Reciente row shows a bank SVG next to the account name.
- Account names render without the `****` mask suffix.
- Merchant name isn't truncated any worse than today.

- [ ] **Step 3.5: Commit**

```bash
git add webapp/src/actions/transactions.ts webapp/src/components/mobile/v2/inicio/inicio-activity.tsx
git commit -m "feat(dashboard): Reciente rows use AccountRowIdentity

Extend RecentTransaction.accounts projection with provider, account_type,
and mask. Reciente swaps its inline account name for <AccountRowIdentity
density='compact'>, showing bank logo + alias only.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Extend `OccurrenceItem` + wire Recurrentes occurrences

**Files:**
- Modify: `webapp/src/components/recurring/use-recurring-month.ts:35-90`
- Modify: `webapp/src/components/mobile/v2/plan/mobile-recurrentes-view.tsx`

- [ ] **Step 4.1: Extend OccurrenceItem with account subset**

Open `webapp/src/components/recurring/use-recurring-month.ts`. Add the new field to `OccurrenceItem`:

```ts
export interface OccurrenceItem {
  // ...existing fields unchanged...
  accountName: string;
  accountId: string;
  // NEW — account display data for AccountRowIdentity
  account: {
    name: string;
    mask: string | null;
    provider: Database["public"]["Enums"]["data_provider"];
    account_type: Database["public"]["Enums"]["account_type"];
    color: string | null;
  };
  // ...rest unchanged...
}
```

Import `Database` at the top of the file if not already imported:

```ts
import type { Database } from "@/types/database";
```

- [ ] **Step 4.2: Populate `account` in `mapToOccurrenceItem`**

Still in `use-recurring-month.ts`, extend the mapper (~line 63). The function already receives `accounts: Account[]` so look up the right one:

```ts
function mapToOccurrenceItem(
  o: RecurringOccurrence,
  accounts: Account[]
): OccurrenceItem {
  const isDebtPayment =
    o.account_type === "CREDIT_CARD" || o.account_type === "LOAN";
  const acct = accounts.find((a) => a.id === o.account_id);
  return {
    // ...existing keys preserved...
    account: {
      name: acct?.name ?? o.account_name,
      mask: acct?.mask ?? null,
      provider: acct?.provider ?? "MANUAL",
      account_type: o.account_type,
      color: acct?.color ?? null,
    },
    // ...rest unchanged...
  };
}
```

The existing `accountLastFour: accounts.find((a) => a.id === o.account_id)?.mask ?? ""` can now reference `acct?.mask` to avoid the double `find`. Update that line:

```ts
accountLastFour: acct?.mask ?? "",
```

- [ ] **Step 4.3: Wire the occurrence row**

Open `webapp/src/components/mobile/v2/plan/mobile-recurrentes-view.tsx`. Find the row that renders `{item.accountName}` (around line 325–330 based on the current file). Import the component + replace:

```tsx
import { AccountRowIdentity } from "@/components/accounts/account-row-identity";

// replace:
<p className="truncate text-[10px] text-muted-foreground">
  {item.accountName}
</p>

// with:
<AccountRowIdentity
  account={item.account}
  density="compact"
  className="truncate text-[10px] text-muted-foreground"
/>
```

- [ ] **Step 4.4: Verify build + visual**

Run: `cd webapp && pnpm build`
Expected: clean.

Visual: `/plan?tab=recurrentes` at 390×844, capture `audit/2026-04-18/02-recurrentes-compact.png`. Confirm each occurrence row shows a bank logo beside the account alias, no `****` suffix.

- [ ] **Step 4.5: Commit**

```bash
git add webapp/src/components/recurring/use-recurring-month.ts webapp/src/components/mobile/v2/plan/mobile-recurrentes-view.tsx
git commit -m "feat(recurrentes): occurrence rows use AccountRowIdentity

Extend OccurrenceItem with an account display subset. mapToOccurrenceItem
populates it from the accounts array already passed in. Row renders bank
logo + alias in compact density.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Wire Recurrentes templates strip

**File:**
- Modify: `webapp/src/components/mobile/v2/plan/mobile-recurrentes-templates-strip.tsx`

- [ ] **Step 5.1: Replace the account info line**

Open the file. Find the `<p>` that renders `{t.account?.name ?? "—"} · {t.frequency ?? "mensual"}` (around line 76). Split into two spans — alias stays in the identity component, frequency stays as its own span:

```tsx
import { AccountRowIdentity } from "@/components/accounts/account-row-identity";

// Replace:
<p className="text-[10px] text-muted-foreground">
  {t.account?.name ?? "—"} · {t.frequency ?? "mensual"}
  {!t.is_active && " · Pausada"}
</p>

// With:
<p className="flex items-center gap-1 text-[10px] text-muted-foreground">
  {t.account ? (
    <AccountRowIdentity
      account={{
        name: t.account.name,
        mask: t.account.mask ?? null,
        provider: t.account.provider,
        account_type: t.account.account_type,
        color: t.account.color,
      }}
      density="picker"
    />
  ) : (
    <span>—</span>
  )}
  <span className="shrink-0"> · {t.frequency ?? "mensual"}</span>
  {!t.is_active && <span className="shrink-0"> · Pausada</span>}
</p>
```

If `t.account` as typed by `RecurringTemplateWithRelations` lacks `mask` / `provider` / `account_type` / `color`, extend the account select in `recurring-templates.ts`'s `TEMPLATE_SELECT` constant to include those fields:

Run `grep -n "TEMPLATE_SELECT" webapp/src/actions/recurring-templates.ts` to confirm the current projection. If it joins `accounts!recurring_transaction_templates_account_id_fkey(id, name, icon, color, account_type, currency_code)`, extend to include `mask, provider` as well.

Edit `webapp/src/actions/recurring-templates.ts` line ~37:

```ts
const TEMPLATE_SELECT = `
  *,
  account:accounts!recurring_transaction_templates_account_id_fkey(id, name, icon, color, account_type, currency_code, mask, provider),
  category:categories!recurring_transaction_templates_category_id_fkey(id, name, name_es, icon, color),
  transfer_source_account:accounts!recurring_transaction_templates_transfer_source_account_id_fkey(id, name, account_type, currency_code)
`;
```

Also update the shared `RecurringTemplateWithRelations` type (likely in `webapp/src/types/domain.ts`) to include the new fields on the `account` relation if it's strongly typed there. If it's a loose `any`-adjacent shape, leave the type alone and rely on the runtime projection.

- [ ] **Step 5.2: Verify build + visual**

Run: `cd webapp && pnpm build`
Expected: clean.

Visual: `/plan?tab=recurrentes` at 390×844, expand the templates strip. Capture `audit/2026-04-18/03-templates-strip-picker.png`. Confirm each template row shows `<logo> <alias> · ****<mask>` followed by `· <frequency>`.

- [ ] **Step 5.3: Commit**

```bash
git add webapp/src/actions/recurring-templates.ts webapp/src/components/mobile/v2/plan/mobile-recurrentes-templates-strip.tsx
git commit -m "feat(recurrentes): templates strip rows use AccountRowIdentity

Extend TEMPLATE_SELECT with mask + provider so template.account carries
everything AccountRowIdentity needs. Strip rows now show bank logo +
alias · mask · frequency.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Wire Deudas accounts accordion

**File:**
- Modify: `webapp/src/components/mobile/v2/deudas/deudas-accounts-accordion.tsx`

- [ ] **Step 6.1: Inspect the file**

Run: `head -60 webapp/src/components/mobile/v2/deudas/deudas-accounts-accordion.tsx`

Identify:
- The compact row that shows the account summary (collapsed state).
- The expanded detail panel.

Note what `Account` fields are already projected — likely name, mask, balance, account_type, color. Confirm `provider` is in scope; if not, extend whichever action feeds this component.

- [ ] **Step 6.2: Swap row + expanded panel**

For the compact row (collapsed accordion trigger), replace the account-name rendering with:

```tsx
import { AccountRowIdentity } from "@/components/accounts/account-row-identity";

<AccountRowIdentity
  account={{
    name: account.name,
    mask: account.mask,
    provider: account.provider,
    account_type: account.account_type,
    color: account.color,
  }}
  density="compact"
/>
```

For the expanded panel header, use `density="detail"`:

```tsx
<AccountRowIdentity
  account={{
    name: account.name,
    mask: account.mask,
    provider: account.provider,
    account_type: account.account_type,
    color: account.color,
    institution_name: account.institution_name,
  }}
  density="detail"
/>
```

If `account.institution_name` isn't currently projected into the type this component receives, trace back to the action and add it to the select.

- [ ] **Step 6.3: Verify build + visual**

Run: `cd webapp && pnpm build`
Expected: clean.

Visual: `/deudas` at 390×844 collapsed + one account expanded. Capture `audit/2026-04-18/04-deudas-compact.png` and `04b-deudas-expanded.png`.

- [ ] **Step 6.4: Commit**

```bash
git add webapp/src/components/mobile/v2/deudas/deudas-accounts-accordion.tsx
# Also add any action file if the select was extended.
git commit -m "feat(deudas): account rows use AccountRowIdentity

Compact density on the accordion trigger, detail density on the expanded
panel header. institution_name projected where the accordion needs it.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Wire source-account pickers + import wizard

**Files:**
- Modify: `webapp/src/components/recurring/link-picker-sheet.tsx`
- Modify: `webapp/src/components/recurring/recurring-form-dialog.tsx`
- Modify: `webapp/src/components/cashflow-planner/entry-form-dialog.tsx`
- Modify: `webapp/src/components/cashflow-planner/assignment-dialog.tsx`
- Modify: `webapp/src/components/cashflow-planner/pay-expense-dialog.tsx`
- Modify: `webapp/src/components/import/import-wizard.tsx`

- [ ] **Step 7.1: Sweep for every picker usage**

Run: `grep -rn "accounts\.find\|account\.name\|sourceAccounts" webapp/src/components/recurring webapp/src/components/cashflow-planner webapp/src/components/import 2>&1 | head -40`

List each picker and note what `Account` subset it receives. Each one either takes:
- A full `Account[]` (most) — already has all fields needed.
- A narrowed `{ id, name }` shape (some) — needs the shape widened to include `mask`, `provider`, `account_type`, `color`.

If a picker takes a narrowed shape, widen both the prop type on the component and any parent call site that prepares the list.

- [ ] **Step 7.2: Replace each picker's account-label render**

In every identified file, where the picker renders an option like `{acct.name} · ****{acct.mask}`, replace with:

```tsx
import { AccountRowIdentity } from "@/components/accounts/account-row-identity";

<AccountRowIdentity
  account={{
    name: acct.name,
    mask: acct.mask,
    provider: acct.provider,
    account_type: acct.account_type,
    color: acct.color,
  }}
  density="picker"
/>
```

For each file, the dropdown item / radio label / button text typically wraps this span; preserve the wrapper (e.g., `DropdownMenuItem`, `CommandItem`, `<button>`) and replace only the text label.

- [ ] **Step 7.3: Verify build**

Run: `cd webapp && pnpm build`
Expected: clean.

- [ ] **Step 7.4: Visual spot-checks**

Playwright captures at 390×844 for each:
- `/transactions` → tap `+` → New transaction → account dropdown open.
- `/plan?tab=recurrentes` → tap a pending occurrence → Actions → "Pagar" → source account dropdown open.
- `/plan?tab=periodo` → "Pagar" an expense → source account picker.
- `/import` → upload step → account-matching step.

Save under `audit/2026-04-18/05-picker-*.png`.

- [ ] **Step 7.5: Commit**

```bash
git add webapp/src/components/recurring/link-picker-sheet.tsx webapp/src/components/recurring/recurring-form-dialog.tsx webapp/src/components/cashflow-planner/ webapp/src/components/import/import-wizard.tsx
# Also add any parent files whose prop shapes were widened.
git commit -m "feat(pickers): source-account options use AccountRowIdentity

Every source-account picker in the app now renders bank logo + alias +
mask for disambiguation: LinkPickerSheet, RecurringFormDialog,
EntryFormDialog, AssignmentDialog, PayExpenseDialog, ImportWizard.
Any picker that previously took a narrowed { id, name } shape now takes
the full AccountIdentity subset.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Wire `/accounts` list, `/accounts/[id]` detail, edit dialog helper caption

**Files:**
- Modify: `webapp/src/app/(dashboard)/accounts/page.tsx` (and any child list component)
- Modify: `webapp/src/app/(dashboard)/accounts/[id]/page.tsx` (and any hero component)
- Modify: the account edit form component — located via grep in Step 8.1

- [ ] **Step 8.1: Locate the edit form**

Run: `grep -rln "name.*Editar\|edit.*account\|account-form\|account-edit" webapp/src/components/accounts webapp/src/app/\(dashboard\)/accounts 2>&1 | head -10`

Identify the file that owns the account edit form. Likely candidates:
- `webapp/src/components/accounts/account-edit-dialog.tsx`
- `webapp/src/components/accounts/account-form.tsx`

Read the file to find the `<Input name="name">` (or equivalent) field.

- [ ] **Step 8.2: Wire `/accounts` list**

Open `webapp/src/app/(dashboard)/accounts/page.tsx` (and the child list component if the page delegates). Each account row in the list uses `<AccountRowIdentity density="picker">` — picker density because the list is a browsing surface where mask aids recognition.

```tsx
import { AccountRowIdentity } from "@/components/accounts/account-row-identity";

<AccountRowIdentity
  account={{
    name: account.name,
    mask: account.mask,
    provider: account.provider,
    account_type: account.account_type,
    color: account.color,
  }}
  density="picker"
/>
```

- [ ] **Step 8.3: Wire `/accounts/[id]` hero**

Open `webapp/src/app/(dashboard)/accounts/[id]/page.tsx` (and the hero component). Replace the existing hero name/mask rendering with:

```tsx
<AccountRowIdentity
  account={{
    name: account.name,
    mask: account.mask,
    provider: account.provider,
    account_type: account.account_type,
    color: account.color,
    institution_name: account.institution_name,
  }}
  density="detail"
/>
```

- [ ] **Step 8.4: Add the helper caption in the edit form (D7)**

In the file identified in Step 8.1, find the `<label>` or `<FormLabel>` + `<Input>` pair for the `name` field. Add a description element directly underneath — use whatever description pattern the form already uses (shadcn forms typically use `<FormDescription>`). Example:

```tsx
<FormField
  control={form.control}
  name="name"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Nombre</FormLabel>
      <FormControl>
        <Input {...field} />
      </FormControl>
      <FormDescription>
        Puedes renombrar tu cuenta con un alias corto — p. ej. “Caja”, “Ahorros mamá”, “Tarjeta amarilla”. Se usa en listas y movimientos.
      </FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

If the form is not react-hook-form/shadcn — e.g., raw input + label — insert a sibling `<p className="text-[11px] text-muted-foreground">` with the same copy directly below the input.

- [ ] **Step 8.5: Verify build + visual**

Run: `cd webapp && pnpm build`
Expected: clean.

Playwright captures:
- `/accounts` list → `audit/2026-04-18/06-accounts-list.png`
- `/accounts/[id]` detail (pick any account) → `06b-account-detail.png`
- Edit dialog open → `06c-account-edit-caption.png`

- [ ] **Step 8.6: Commit**

```bash
git add webapp/src/app/\(dashboard\)/accounts/ webapp/src/components/accounts/
git commit -m "feat(accounts): list/detail/edit use AccountRowIdentity + alias caption

/accounts list uses picker density. /accounts/[id] hero uses detail density
(shows institution_name + mask on the secondary line). Account edit form
gains a helper caption explaining alias intent (D7).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Playwright verification pass

- [ ] **Step 9.1: Dev server**

```bash
lsof -i :3000 -P -sTCP:LISTEN -t >/dev/null || (cd webapp && pnpm dev &)
```

Wait ~5s.

- [ ] **Step 9.2: Full sweep at 390×844**

Using the Playwright MCP, capture the canonical surfaces. Save under `audit/2026-04-18/`:

1. `/dashboard` — Reciente rows (already captured in Task 3, reshoot for final state).
2. `/plan` root — no account rows directly, but confirm no regressions.
3. `/plan?tab=periodo` — expense rows that mention account → now use AccountRowIdentity via pickers if any.
4. `/plan?tab=recurrentes` — occurrence rows (already captured) + templates strip expanded (already captured).
5. `/deudas` — accounts list + expanded panel (already captured).
6. `/transactions/new` — account source dropdown open.
7. `/accounts` list + `/accounts/[id]` detail + edit dialog helper.
8. Any existing picker — re-verify.

- [ ] **Step 9.3: Regression check**

For each capture, verify:
- Bank logo renders at the correct size and provider-appropriate color.
- MANUAL accounts fall back to account_type glyph.
- Mask is absent in compact density everywhere.
- Mask is present in picker density.
- Detail density shows institution_name + mask on the secondary line.
- No row overflow, no clipped merchant names.
- No residual `accounts.name` text that wasn't swapped to AccountRowIdentity.

- [ ] **Step 9.4: Build gate**

Run: `cd webapp && pnpm build`
Expected: `✓ Compiled successfully` clean.

- [ ] **Step 9.5: Test gate**

Run: `cd webapp && pnpm vitest run src/components/accounts`
Expected: 6 passing (2 from account-icon, 4 from account-row-identity).

- [ ] **Step 9.6: Commit (captures only)**

If `audit/` is gitignored (confirmed in the Plan polish session), captures stay on disk — no git action.

---

## Task 10: Review gate

The same layered pattern as PR #170.

- [ ] **Step 10.1: Parallel — zetas-front-guy + perf-auditor**

Spawn both agents in a single message with the diff scope. Prompts:

**zetas-front-guy:**
- Audit token compliance across the 10 new bank SVGs and the 2 new primitives.
- Bank SVGs intentionally use non-token brand colors (hardcoded hex for BANCOLOMBIA yellow, NU purple, etc.). That is allowed — they are brand marks, not UI colors. Confirm the hex values don't leak outside the SVGs.
- Check `<AccountIcon>` fallback glyph uses design tokens (`bg-white/5 text-muted-foreground` when color is null, `account.color` at 10% when set).
- Verify `<AccountRowIdentity>` uses `text-muted-foreground` for the mask (not hardcoded gray).

**perf-auditor:**
- New bank SVGs add to client bundle. Confirm no barrel-import regression — each SVG must be tree-shakable by provider.
- The extended `accounts` select in `RecentTransaction` + `TEMPLATE_SELECT` adds columns per row. Confirm no N+1 shape regressions.
- Confirm `<AccountRowIdentity>` is a pure Server-Component-eligible render (no `"use client"`, no hooks).

Apply findings as `fix(accounts): apply zetas-front-guy + perf-auditor feedback`.

- [ ] **Step 10.2: Push + open PR (USER GATE)**

Do NOT push without user approval. Post the branch status and the generated PR body to the user; wait for "push". Once approved:

```bash
git push -u origin feat/account-aliases
gh pr create --title "feat(accounts): aliases + bank-logo icons across every row surface" --body "..."
```

PR body outline (fill in from session context):

```
## Summary
- AccountIcon: 9 Colombian bank SVGs + lucide fallback by account_type.
- AccountRowIdentity: three densities (compact / picker / detail).
- Zero migrations (reuses accounts.name as alias).
- Surfaces wired: Reciente, Recurrentes occurrences + templates, Deudas accordion, all source-account pickers, import wizard, /accounts list, /accounts/[id] detail.
- /accounts edit form gains helper caption explaining alias intent (D7).

## Spec & Plan
- docs/superpowers/specs/2026-04-17-account-aliases-design.md
- docs/superpowers/plans/2026-04-17-account-aliases.md

## Test plan
- [x] Vitest unit tests (AccountIcon registry + AccountRowIdentity density cases)
- [x] pnpm build clean
- [x] Playwright captures at 390×844 (audit/2026-04-18/)
- [x] zetas-front-guy token sweep
- [x] perf-auditor bundle / cache sweep
- [ ] Gemini pending
- [ ] frontend-auditor + ux-analyst pending
- [ ] /simplify pending
```

Wait ~2 min after push for Gemini's bot review; `gh pr view --comments` to collect findings.

- [ ] **Step 10.3: Parallel — frontend-auditor + ux-analyst**

After the commit that applies Gemini's findings (or immediately if Gemini found nothing), spawn both:

**frontend-auditor:**
- A11y of the new primitives: icons have `aria-hidden`, identity component text is the accessible label, picker dropdowns still have accessible labels.
- Responsive: 320w doesn't overflow when the picker density renders `<logo> <longer alias> · ****1234`.
- Localization: all user-facing copy in Spanish (Spec D7 caption verbatim).

**ux-analyst:**
- Cohesion: does the app feel more compact and identifiable? Walk the primary flows with Playwright.
- Density payoff: does Reciente actually feel less cluttered?
- Onboarding: is the edit caption discoverable enough that existing users will rename their accounts?

Apply findings as `fix(accounts): apply frontend-auditor + ux-analyst feedback`.

- [ ] **Step 10.4: `/simplify` pass**

Invoke the `/simplify` skill against the branch diff. Focus: any dead props left after the swaps, any duplicated account-mapping helpers that could unify. Apply as `refactor(accounts): apply /simplify review`.

- [ ] **Step 10.5: Final build gate**

Run: `cd webapp && pnpm build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 10.6: Wait for merge approval**

User merges PR from GitHub UI. Do not self-merge.

---

## Success criteria (from spec)

- Every row surface renders `<AccountIcon>` + alias. ✅
- Dashboard Reciente drops the `****` mask suffix (compact density). ✅
- Source-account pickers show alias + mask for disambiguation. ✅
- MANUAL accounts render a lucide `account_type` glyph, not a blank box. ✅
- `/accounts/[id]` edit dialog has the D7 helper caption. ✅
- No new schema migrations. ✅
- `pnpm build` passes; bank SVGs don't leak brand colors outside the icon component. ✅

---

## Spec coverage self-check

| Spec decision | Task coverage |
|---|---|
| D1 — reuse `accounts.name` | No-op (no task needed — existing column) |
| D2 — bank logos by provider + lucide fallback | Task 1 |
| D3 — three densities | Task 2 (composer) + Tasks 3–8 (consumers) |
| D4 — silent onboarding | Task 8 (edit helper caption, no forced prompt) |
| D5 — MANUAL fallback | Task 1 (inside AccountIcon) |
| D6 — no user icon picker | Explicitly out of scope (not implemented) |
| D7 — reuse edit form + helper caption | Task 8 (Step 8.4) |
| Review gate | Task 10 |
