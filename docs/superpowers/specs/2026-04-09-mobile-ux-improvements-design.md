# Mobile UX Improvements — Import, Transaction Rows, Tag Colors

**Date:** 2026-04-09  
**Scope:** Mobile webapp only (responsive views, not React Native)  
**Visual companion:** `docs/visual-companions/ux-improvements-april-2026.html`

---

## Problem

Three systemic issues in the mobile webapp:

1. **Import is buried.** PDF import — the foundational action — is only reachable via the hamburger drawer. No starter mode exists on mobile. The "Importar" chip in Movimientos only shows email counts and looks inactive when there are none.

2. **Transaction rows are inconsistent.** `InicioActivity` renders plain text (description + amount) with no direction icon, no account, no category. `MovimientosTransactionRow` collapsed state shows account + date but omits direction icon and category. Two sibling surfaces feel like different apps.

3. **Tag colors are invisible inline.** Tags have colors in Settings > Etiquetas (via `TagChip`), but transaction rows don't render tags at all in collapsed state. The `#` icon in expanded state communicates nothing about which tags are assigned.

---

## Design

### 1. Import as Primary CTA

#### 1A — Starter mode (`InicioStarter`)

**New file:** `webapp/src/components/mobile/v2/inicio/inicio-starter.tsx`

**Trigger:** `MobileZone` passes `starterMode: boolean` to `InicioRoot`. Computed as `hasAccounts && recentTx.length === 0` (same logic as desktop `dashboard/page.tsx:138`).

**Content:**
- Welcome text: "Tu base esta lista" / "Falta activar tu flujo con datos reales."
- Single CTA card (brass border, gradient background):
  - Icon (document), title "Importa tu primer extracto"
  - Description explaining what import activates
  - Primary brass button → `/import`
  - Secondary text link → `/transactions` ("registrar manual")
- "Despues de importar" row: 3 compact icons showing what unlocks (Metricas, Auto-categorias, Alertas)

**When `starterMode=true`:** `InicioRoot` renders `InicioStarter` instead of hero + metrics + attention + discovery + activity.

#### 1B — Stale import banner (`InicioImportStrip`)

**New file:** `webapp/src/components/mobile/v2/inicio/inicio-import-strip.tsx`

**Data:** `MobileZone` fetches `getLatestSnapshotDates()` (already exists, used in desktop's `AccountsSection`). Computes `daysSinceImport` as max days since any account's latest snapshot. Passes to `InicioRoot`.

**Rendering:** Between hero and metrics grid when `daysSinceImport > 15`. Layout:
- 36px icon box (brass-accented document icon)
- Text block: bold "{N} dias sin importar" + description
- Brass "Importar" button → `/import`

Uses `import-strip` class pattern: `border-z-brass/20`, gradient background, `rounded-[14px]`.

Hidden when `daysSinceImport <= 15` or `starterMode=true`.

#### 1C — Importar chip includes PDF

**File:** `webapp/src/components/mobile/v2/movimientos/movimientos-herramientas.tsx`

**Changes:**
1. "Importar" chip always shows sage accent styling (remove the conditional that makes it gray when `pendingEmailCount === 0`)
2. Chip subtitle: show "Subir PDF" when `pendingEmailCount === 0`, show "{N} emails pendientes" otherwise
3. `ImportarDetail` expanded panel: add a "Subir PDF del banco" row at the top, above the email list. Row has: document icon + title + description + brass "Subir" button → `/import`. Below it, a divider, then the existing email list.

### 2. Standardized Transaction Rows

#### 2A — `InicioActivity` rewrite

**File:** `webapp/src/components/mobile/v2/inicio/inicio-activity.tsx`

**Current interface:**
```ts
interface Transaction {
  id: string;
  description: string;
  amount: number;
  currency_code: string;
  direction: "INFLOW" | "OUTFLOW";
}
```

**New interface:**
```ts
interface RecentTransactionMobile {
  id: string;
  description: string;
  amount: number;
  currency_code: string;
  direction: "INFLOW" | "OUTFLOW";
  account_name: string;
  account_color: string | null;
  category_name: string | null;
  category_icon: string | null;
  tags: Array<{ id: string; name: string; color: string | null; group_color: string | null }>;
}
```

**Data source:** `MobileZone` already maps `recentTx`. Extend the mapping to include account, category, and tags from the `RecentTransaction` type (which already includes `account_name`, `account_color`). For category and tags, either extend `getRecentTransactions()` to join them, or use `AppDataProvider` category map for lookup.

**Layout:** Same visual as `MovimientosTransactionRow` collapsed state:
- Direction icon (22px rounded box, inflow=green, outflow=orange)
- Description (12px, font-medium, truncate)
- Meta line: account dot + account name · category icon + category name
- Tags row (if any): `TagChip size="sm"` aligned with text
- Amount (right side, green for inflow, tabular-nums)

**Interaction:** Tap → navigate to `/transactions/{id}` (no expand/collapse). "Ver todos →" link at bottom.

#### 2B — `MovimientosTransactionRow` enrichment

**File:** `webapp/src/components/mobile/v2/movimientos/movimientos-transaction-row.tsx`

**Changes to collapsed state:**

1. **Add direction icon** to the left:
   ```tsx
   <div className={cn(
     "flex size-[22px] shrink-0 items-center justify-center rounded-md",
     tx.direction === "INFLOW" ? "bg-green-500/12 text-z-income" : "bg-orange-500/12 text-z-expense"
   )}>
     {tx.direction === "INFLOW" ? <ArrowDownLeft className="size-3" /> : <ArrowUpRight className="size-3" />}
   </div>
   ```

2. **Replace date with category** in meta line. Date is already shown in the date group header, so it's redundant:
   - Has category: `{category.icon} {category.name_es ?? category.name}`
   - No category: `Sin cat.` in `text-z-brass` (implicit CTA)

3. **Add tags below meta line** when `tags.length > 0`:
   ```tsx
   {tags.length > 0 && (
     <div className="flex flex-wrap gap-1 mt-1 pl-[30px]">
       {tags.map(t => (
         <TagChip key={t.id} tag={t} groupColor={t.group_color} size="sm" />
       ))}
     </div>
   )}
   ```
   `pl-[30px]` aligns with text (past the direction icon width).

4. **Remove chevron `›`** — the direction icon already communicates that the row is interactive.

**Props change:** Add `tags` to `MovimientosTransactionRowProps`:
```ts
interface MovimientosTransactionRowProps {
  transaction: TransactionWithAccount;
  categories: CategoryWithChildren[];
  tags?: Array<{ id: string; name: string; color: string | null; group_color: string | null }>;
  onCategorized?: (txId: string, categoryId: string) => void;
}
```

### 3. Tag Colors Inline

#### Data pipeline

**Query change:** The transaction query in `movimientos-root.tsx` (or wherever `MovimientosRoot` fetches transactions) needs to join tags. Using Supabase:

```ts
.select(`*, account:accounts!inner(*), transaction_tags(tag:tags(id, name, color, group:tag_groups(color)))`)
```

This is a single join, not N+1. The response shape nests `transaction_tags[].tag.{id, name, color, group.color}`.

**Mapping:** Flatten to the simple `{id, name, color, group_color}` shape expected by the row component.

#### Rendering

`TagChip` already handles everything:
- Color cascade: `tag.color ?? groupColor ?? "rgba(255,255,255,0.15)"`
- `size="sm"`: `text-xs px-2 py-0.5`
- Border + background + text all colored

No changes to `TagChip` needed.

#### Where tags render

| Surface | Shows tags? |
|---------|------------|
| `MovimientosTransactionRow` collapsed | Yes, below meta line |
| `InicioActivity` rows | Yes, below meta line |
| `MovimientosTransactionRow` expanded | Keep existing `TagZonePicker` for editing |

---

## Files Changed

| File | Type | Description |
|------|------|-------------|
| `zones/mobile-zone.tsx` | Modified | Add `starterMode`, `daysSinceImport` computation and props |
| `inicio-root.tsx` | Modified | Accept new props, conditionally render starter/import strip |
| `inicio-activity.tsx` | Modified | Rewrite with canonical row layout + tags |
| `movimientos-transaction-row.tsx` | Modified | Add direction icon, category, tags in collapsed |
| `movimientos-herramientas.tsx` | Modified | Extend ImportarDetail with PDF CTA, always-sage chip |
| `movimientos-root.tsx` | Modified | Pass tags data to transaction rows |
| `inicio-starter.tsx` | **New** | Starter mode CTA card |
| `inicio-import-strip.tsx` | **New** | Stale import contextual banner |

**Not changed:** Desktop components, `TagChip`, server actions, database schema, `tag-chip.tsx`.

---

## Agent Review Gates

After implementation, run these review agents before claiming done:

1. **`zetas-front-guy`** — every TSX change (tokens, component reuse, design system compliance)
2. **`perf-auditor`** — verify the tags join doesn't regress query performance
3. **`cache-doctor`** — if any new cached queries are added for `latestSnapshotDates` in `MobileZone`

---

## Out of Scope

- Desktop transaction table changes
- Desktop starter mode changes
- Desktop hero import CTAs
- New server actions or API endpoints
- Database migrations
- `TagChip` component changes
- Mobile tab bar restructuring (Bandeja vs Deudas — separate task)
- Onboarding retheme (separate task)
- Page header standardization (separate task)
