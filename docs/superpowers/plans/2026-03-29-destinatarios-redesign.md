# Destinatarios Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat table-based destinatarios list with a card grid featuring avatars, category filter pills, expandable quick actions, and tags.

**Architecture:** Redesign is isolated to the list component and its parent page. The existing `getDestinatarios()` action already returns all needed data (name, category, rule_count, transaction_count). We add a lightweight server action to compute monthly average spend per destinatario. The card grid, category filter pills, and expand/collapse behavior are all client-side state in the redesigned list component.

**Tech Stack:** Next.js 15 (Server Components + Client Components), TypeScript, Tailwind v4, shadcn/ui, Supabase

**Spec:** `docs/superpowers/specs/2026-03-29-destinatarios-budget-redesign.md` (Part 1)

---

## Task 1: Add Monthly Average Spend to Destinatario Data

**Files:**
- Modify: `webapp/src/actions/destinatarios.ts`
- Modify: `webapp/src/types/domain.ts` (if needed for type export)

- [ ] **Step 1: Add `getDestinatariosWithSpend` action**

In `webapp/src/actions/destinatarios.ts`, add a new function after `getDestinatarios()` that enriches destinatarios with average monthly spend. This avoids modifying the existing function which is used elsewhere.

```typescript
export async function getDestinatariosWithSpend(): Promise<
  ActionResult<(DestinatarioWithCounts & { avg_monthly_spend: number })[]>
> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Get base destinatarios
  const baseResult = await getDestinatarios();
  if (!baseResult.success) return baseResult as ActionResult<never>;

  // Get 3-month spend per destinatario
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const since = threeMonthsAgo.toISOString().split("T")[0];

  const { data: spendData } = await supabase
    .from("transactions")
    .select("destinatario_id, amount")
    .eq("user_id", user.id)
    .eq("direction", "OUTFLOW")
    .eq("is_excluded", false)
    .gte("transaction_date", since)
    .not("destinatario_id", "is", null);

  // Aggregate by destinatario
  const spendMap = new Map<string, number>();
  for (const tx of spendData ?? []) {
    if (!tx.destinatario_id) continue;
    spendMap.set(
      tx.destinatario_id,
      (spendMap.get(tx.destinatario_id) ?? 0) + tx.amount,
    );
  }

  const enriched = baseResult.data.map((d) => ({
    ...d,
    avg_monthly_spend: Math.round((spendMap.get(d.id) ?? 0) / 3),
  }));

  return { success: true, data: enriched };
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add webapp/src/actions/destinatarios.ts
git commit -m "feat(destinatarios): add getDestinatariosWithSpend action

Enriches destinatarios with 3-month average monthly spend
for display in the redesigned card grid."
```

---

## Task 2: Redesign Destinatario List — Card Grid with Category Filter

**Files:**
- Rewrite: `webapp/src/components/destinatarios/destinatario-list.tsx`

This is the main redesign task. The component is a client component that currently renders a searchable/sortable table. We replace it with:
- Category filter pills (horizontal scrollable)
- Card grid (3/2/1 columns responsive)
- Expandable cards with avatar, tags, quick actions
- Inactive merchants at bottom with reduced opacity

- [ ] **Step 1: Rewrite the component**

Read the current `webapp/src/components/destinatarios/destinatario-list.tsx` to understand the full interface (props, callbacks, merge dialog integration). Then rewrite it with the new card grid design.

Key changes:
- **Props:** Change `items` type to include `avg_monthly_spend: number`. Add `categories: CategoryWithChildren[]` and `tagGroups: TagGroupWithTags[]` props for the filter pills and tag display.
- **State:** Add `categoryFilter: string | null` (category ID or null for "Todos"), `expandedId: string | null`.
- **Filter pills:** Derive from `categories` prop — only show categories that appear in at least one destinatario's `default_category_id`. Render as a scrollable row of zone-colored pills.
- **Card layout:** `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3`
- **Sorting:** Active items first, inactive at bottom (`opacity-60`). Within active, sort by current sort state.
- **Expand/collapse:** Click card toggles `expandedId`. Expanded view shows tags (TagChip) and action buttons.
- **Quick actions in expanded view:**
  - "Editar" — `Link` to `/destinatarios/[id]`
  - "Categoría" — `CategoryZonePicker` popover variant, calls `updateDestinatario` on change
  - "Activar/Desactivar" — Switch with optimistic update

The card component:

```tsx
function DestinatarioCard({
  item,
  categoryName,
  categoryColor,
  isExpanded,
  onToggle,
  onCategoryChange,
  onToggleActive,
  categories,
  tags,
  tagGroups,
  isPending,
}: {
  item: DestinatarioItem & { avg_monthly_spend: number };
  categoryName: string | null;
  categoryColor: string;
  isExpanded: boolean;
  onToggle: () => void;
  onCategoryChange: (categoryId: string | null) => void;
  onToggleActive: (active: boolean) => void;
  categories: CategoryWithChildren[];
  tags: Tag[];
  tagGroups: TagGroupWithTags[];
  isPending: boolean;
}) {
  const initial = item.name.charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/6 bg-card p-4 transition-colors hover:bg-white/[0.02]",
        !item.is_active && "opacity-60",
      )}
    >
      <button
        type="button"
        className="flex w-full items-start gap-3 text-left"
        onClick={onToggle}
      >
        {/* Avatar */}
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
          style={{
            backgroundColor: chipBackground(categoryColor),
            color: zoneTextColor(categoryColor),
          }}
        >
          {initial}
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{item.name}</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {categoryName && (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: chipBackground(categoryColor),
                  color: zoneTextColor(categoryColor),
                }}
              >
                {categoryName}
              </span>
            )}
            {item.avg_monthly_spend > 0 && (
              <span>{formatCurrency(item.avg_monthly_spend, "COP")}/mes</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.rule_count} {item.rule_count === 1 ? "regla" : "reglas"} · {item.is_active ? "Activo" : "Inactivo"}
          </p>
        </div>

        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            isExpanded && "rotate-180",
          )}
        />
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-3 space-y-3 border-t border-white/6 pt-3">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <TagChip key={tag.id} tag={tag} size="sm" />
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/destinatarios/${item.id}`}>Editar</Link>
            </Button>
            <CategoryZonePicker
              categories={categories}
              value={item.default_category_id}
              onValueChange={onCategoryChange}
              variant="popover"
              placeholder="Categoría"
              triggerClassName="h-8 text-xs"
            />
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {item.is_active ? "Activo" : "Inactivo"}
              </span>
              <Switch
                checked={item.is_active}
                onCheckedChange={onToggleActive}
                disabled={isPending}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

Imports needed: `Link` from next/link, `Button` from ui/button, `Switch` from ui/switch, `ChevronDown` from lucide-react, `TagChip` from tags/tag-chip, `CategoryZonePicker` from categories/category-zone-picker, `chipBackground`/`zoneTextColor` from zone-colors, `formatCurrency` from currency, `cn` from utils. Types: `Tag`, `TagGroupWithTags`, `CategoryWithChildren` from domain.

The main list component handles state, filtering, sorting, and renders the grid of cards. Keep the existing merge dialog and bulk selection logic (checkbox on each card, merge button in header).

- [ ] **Step 2: Verify build**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/destinatarios/destinatario-list.tsx
git commit -m "feat(destinatarios): redesign list as card grid with category filter

- Card grid (3/2/1 cols responsive) with avatar, category chip, spend
- Category filter pills derived from linked categories
- Expand/collapse with tags, quick category change, active toggle
- Inactive merchants at bottom with reduced opacity"
```

---

## Task 3: Update Destinatarios Page to Pass New Props

**Files:**
- Modify: `webapp/src/app/(dashboard)/destinatarios/page.tsx`

- [ ] **Step 1: Update data fetching and props**

The page needs to:
1. Call `getDestinatariosWithSpend()` instead of `getDestinatarios()`
2. Fetch tag groups and per-destinatario tags
3. Pass `categories` and `tagGroups` to `DestinatarioList`

Read the current page file. Update the `Promise.all` to include:
```typescript
import { getDestinatariosWithSpend } from "@/actions/destinatarios";
import { getTagGroups, getTagsForEntity } from "@/actions/tags";

// In the component:
const [destResult, catResult, suggestionsResult, tagGroupsResult] =
  await Promise.all([
    getDestinatariosWithSpend(),
    getCategories(),
    getDestinatarioSuggestions(),
    getTagGroups(),
  ]);

const tagGroups = tagGroupsResult.success ? tagGroupsResult.data : [];
```

Update the `DestinatarioList` usage to pass the new props:
```tsx
<DestinatarioList
  items={destinatarios}
  categoryMap={categoryMap}
  categories={categories}
  tagGroups={tagGroups}
/>
```

Also fetch tags for each destinatario. Since fetching tags per-destinatario in a loop would be slow, add a bulk query. Either:
- Fetch all destinatario_tags for the user's destinatarios in one query and pass as a map
- Or let each card fetch its own tags on expand (lazy)

Recommended: **lazy fetch on expand** — most cards won't be expanded, so fetching all tags upfront wastes data. The TagPicker already handles fetching on mount. For display-only tags in the collapsed-expanded card, the card can call `getTagsForEntity("destinatario", id)` when expanded. Since this is a server action called from a client component, it works via `startTransition`.

- [ ] **Step 2: Verify build**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add webapp/src/app/(dashboard)/destinatarios/page.tsx
git commit -m "feat(destinatarios): pass categories and tag groups to redesigned list"
```

---

## Task 4: Final Polish and Verification

**Files:**
- Read: `webapp/src/components/destinatarios/destinatario-list.tsx` (verify)

- [ ] **Step 1: Build and verify**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp
pnpm install
pnpm build
```

- [ ] **Step 2: Manual smoke test**

Open the app and verify:
1. `/destinatarios` shows card grid (3 cols desktop, responsive)
2. Category filter pills appear, clicking one filters the list
3. Clicking a card expands to show tags and quick actions
4. "Categoría" popover works inline
5. Active/Inactive toggle works with optimistic update
6. Inactive merchants appear at bottom with reduced opacity
7. Search still filters by name
8. Sort dropdown still works
9. Bulk selection + merge still works
10. Sugerencias tab is unchanged

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(destinatarios): polish card grid after smoke test"
```
