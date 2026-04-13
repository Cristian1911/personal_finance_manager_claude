# Inline Drawer Pickers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add action chips to mobile transaction rows that open improved zone pickers as drawers, with visual polish, better creation flows, and recent items.

**Architecture:** Extend existing `movimientos-transaction-row.tsx` expanded state with destinatario/tag/edit chips. Add `"drawer"` variant to `DestinatarioZonePicker` and `TagZonePicker` (matching `CategoryZonePicker`'s pattern). Add cached `getRecentDestinatarios` and `getRecentTags` server actions. Improve picker visual polish and creation flow.

**Tech Stack:** Next.js 15, React 19, Tailwind v4, shadcn/ui (Drawer from vaul), Supabase

**Spec:** `docs/superpowers/specs/2026-04-13-inline-drawer-pickers-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `webapp/src/actions/destinatarios.ts` | Modify | Add `getRecentDestinatarios` cached query |
| `webapp/src/actions/tags.ts` | Modify | Add `getRecentTags` cached query |
| `webapp/src/components/destinatarios/destinatario-zone-picker.tsx` | Modify | Add drawer variant, recents section, creation flow with category + pattern, visual polish |
| `webapp/src/components/tags/tag-zone-picker.tsx` | Modify | Add drawer variant, recents section, group count badges, visual polish |
| `webapp/src/components/mobile/v2/movimientos/movimientos-transaction-row.tsx` | Modify | Add destinatario/tag/edit action chips to expanded state |

---

### Task 1: Add `getRecentDestinatarios` cached query

**Files:**
- Modify: `webapp/src/actions/destinatarios.ts`

- [ ] **Step 1: Add the cached inner function and public wrapper**

At the end of the "Reads" section (after `fetchDestinatarioRules`), add:

```ts
async function getRecentDestinatariosCached(
  userId: string,
  accessToken: string,
  limit: number
): Promise<Array<{ id: string; name: string }>> {
  "use cache";
  cacheTag("destinatarios");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const { data } = await supabase
    .from("transactions")
    .select("destinatario_id, destinatarios!transactions_destinatario_id_fkey(id, name)")
    .eq("user_id", userId)
    .not("destinatario_id", "is", null)
    .order("transaction_date", { ascending: false })
    .limit(50);

  if (!data) return [];

  const seen = new Set<string>();
  const result: Array<{ id: string; name: string }> = [];
  for (const row of data) {
    const dest = row.destinatarios as unknown as { id: string; name: string } | null;
    if (!dest || seen.has(dest.id)) continue;
    seen.add(dest.id);
    result.push({ id: dest.id, name: dest.name });
    if (result.length >= limit) break;
  }
  return result;
}

export async function getRecentDestinatarios(
  limit = 3
): Promise<Array<{ id: string; name: string }>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return [];
  return getRecentDestinatariosCached(user.id, accessToken, limit);
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd webapp && pnpm build`
Expected: Build passes clean.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/actions/destinatarios.ts
git commit -m "feat: add getRecentDestinatarios cached query"
```

---

### Task 2: Add `getRecentTags` cached query

**Files:**
- Modify: `webapp/src/actions/tags.ts`

- [ ] **Step 1: Add the cached inner function and public wrapper**

After the existing cached read functions, add:

```ts
async function getRecentTagsCached(
  userId: string,
  accessToken: string,
  limit: number
): Promise<Array<{ id: string; name: string; color: string | null }>> {
  "use cache";
  cacheTag("tags");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  // Get recent transaction_tags joined with tag info
  const { data } = await supabase
    .from("transaction_tags")
    .select("tag_id, tags!inner(id, name, color)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!data) return [];

  // Filter by user ownership: transaction_tags doesn't have user_id,
  // but RLS ensures only user's rows are returned
  const seen = new Set<string>();
  const result: Array<{ id: string; name: string; color: string | null }> = [];
  for (const row of data) {
    const tag = row.tags as unknown as { id: string; name: string; color: string | null } | null;
    if (!tag || seen.has(tag.id)) continue;
    seen.add(tag.id);
    result.push({ id: tag.id, name: tag.name, color: tag.color });
    if (result.length >= limit) break;
  }
  return result;
}

export async function getRecentTags(
  limit = 5
): Promise<Array<{ id: string; name: string; color: string | null }>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return [];
  return getRecentTagsCached(user.id, accessToken, limit);
}
```

Note: `createCachedClient` must be imported if not already present. Check the existing imports at the top of `tags.ts`.

- [ ] **Step 2: Verify build passes**

Run: `cd webapp && pnpm build`
Expected: Build passes clean.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/actions/tags.ts
git commit -m "feat: add getRecentTags cached query"
```

---

### Task 3: Add drawer variant + recents + visual polish to DestinatarioZonePicker

**Files:**
- Modify: `webapp/src/components/destinatarios/destinatario-zone-picker.tsx`

- [ ] **Step 1: Add Drawer imports and update variant type**

Add to imports:

```ts
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { getRecentDestinatarios } from "@/actions/destinatarios";
```

Update the `variant` type in the interface:

```ts
variant?: "popover" | "dialog" | "drawer";
```

Update the auto-detect logic:

```ts
const variant = variantProp ?? (isDesktop ? "popover" : "drawer");
```

- [ ] **Step 2: Add recents state and fetch-on-open**

Add state for recent items and fetch them when the picker opens:

```ts
const [recents, setRecents] = useState<Array<{ id: string; name: string }>>([]);

useEffect(() => {
  if (!open) {
    setSearch("");
    setCreating(false);
    return;
  }
  getRecentDestinatarios(3).then(setRecents);
}, [open]);
```

Replace the existing `useEffect` that resets state on close.

- [ ] **Step 3: Add recents section to the body**

Inside the `body` variable, add a recents section between the search input and the list. This section shows when `recents.length > 0` and `!search`:

```tsx
{/* Recent items — collapse when searching */}
{recents.length > 0 && !search && (
  <div className="flex flex-wrap gap-1.5 px-3 pb-2">
    {recents.map((d) => (
      <button
        key={d.id}
        type="button"
        onClick={() => handleSelect({ ...d, is_active: true })}
        className={cn(
          "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
          d.id === value
            ? "border-z-brass/30 bg-z-brass/10 text-z-brass"
            : "border-white/8 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06]"
        )}
      >
        {d.name}
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 4: Visual polish — improve list items and empty state**

Update the list item buttons to have better spacing, active state, and dividers:

```tsx
{filtered.map((d) => (
  <button
    key={d.id}
    type="button"
    onClick={() => handleSelect(d)}
    className={cn(
      "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/5",
      d.id === value && "bg-z-brass/5"
    )}
  >
    <span className="flex items-center gap-2">
      <UserRound className="size-3.5 text-muted-foreground" />
      <span>{d.name}</span>
    </span>
    {d.id === value && <Check className="size-4 text-z-brass" />}
  </button>
))}
```

Update the empty state when no destinatarios exist (no search active):

```tsx
) : filtered.length === 0 ? (
  <div className="flex flex-col items-center gap-2 py-8 text-center">
    <UserRound className="size-8 text-muted-foreground/40" />
    <p className="text-sm text-muted-foreground">No hay destinatarios</p>
    <p className="text-xs text-muted-foreground/70">Crea uno con el botón de abajo</p>
  </div>
) : null}
```

- [ ] **Step 5: Upgrade creation flow — add category + pattern fields**

Replace the simple inline creation form with an expanded version. When `creating && !search`, show:

```tsx
{creating && !search ? (
  <form
    className="space-y-2.5 px-3 py-2"
    onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const name = fd.get("create_name") as string;
      if (name?.trim()) handleCreateWithDetails(name.trim(), fd.get("create_pattern") as string | null);
    }}
  >
    <input
      ref={createInputRef}
      name="create_name"
      type="text"
      placeholder="Nombre del destinatario..."
      className="w-full rounded-lg border border-white/6 bg-white/[0.03] px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-z-brass/40"
      autoFocus
    />
    <input
      name="create_pattern"
      type="text"
      placeholder="Patrón de texto (opcional)..."
      className="w-full rounded-lg border border-white/6 bg-white/[0.03] px-2.5 py-1.5 text-xs outline-none placeholder:text-muted-foreground focus:border-z-brass/40"
    />
    <div className="flex gap-1.5">
      <button
        type="button"
        onClick={() => setCreating(false)}
        className="flex-1 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-white/5"
      >
        Cancelar
      </button>
      <button
        type="submit"
        className="flex-1 rounded-lg bg-z-brass/15 px-2.5 py-1.5 text-xs font-medium text-z-brass transition-colors hover:bg-z-brass/25"
      >
        Crear
      </button>
    </div>
  </form>
) : (/* existing "Crear nuevo" button */)}
```

Add the `handleCreateWithDetails` function:

```ts
function handleCreateWithDetails(name: string, pattern: string | null) {
  startCreateTransition(async () => {
    const fd = new FormData();
    fd.set("name", name);
    const result = await createDestinatario({ success: false, error: "" }, fd);
    if (result.success) {
      // If pattern provided, create a rule too
      if (pattern?.trim()) {
        const { addDestinatarioRule } = await import("@/actions/destinatarios");
        const ruleFd = new FormData();
        ruleFd.set("destinatario_id", result.data.id);
        ruleFd.set("pattern", pattern.trim());
        ruleFd.set("match_type", "contains");
        await addDestinatarioRule({ success: false, error: "", conflicts: undefined }, ruleFd);
      }
      onValueChange(result.data.id, result.data.name);
      setOpen(false);
      setCreating(false);
      toast.success(`Destinatario "${name}" creado`);
    } else {
      toast.error(result.error || "Error al crear destinatario");
    }
  });
}
```

- [ ] **Step 6: Add the drawer render variant**

After the existing dialog render block, add the drawer variant:

```tsx
// variant === "drawer"
return (
  <>
    {triggerButton}
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <UserRound className="size-4 text-z-brass" />
            Destinatario
          </DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto px-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {body}
        </div>
      </DrawerContent>
    </Drawer>
  </>
);
```

- [ ] **Step 7: Verify build passes**

Run: `cd webapp && pnpm build`
Expected: Build passes clean.

- [ ] **Step 8: Commit**

```bash
git add webapp/src/components/destinatarios/destinatario-zone-picker.tsx
git commit -m "feat: upgrade DestinatarioZonePicker — drawer variant, recents, creation flow, visual polish"
```

---

### Task 4: Add drawer variant + recents + visual polish to TagZonePicker

**Files:**
- Modify: `webapp/src/components/tags/tag-zone-picker.tsx`

- [ ] **Step 1: Add Drawer imports and update variant type**

Add to imports:

```ts
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { getRecentTags } from "@/actions/tags";
```

Update the `variant` type in the interface:

```ts
variant?: "popover" | "dialog" | "drawer";
```

Update the auto-detect logic:

```ts
const variant = variantProp ?? (isDesktop ? "popover" : "drawer");
```

- [ ] **Step 2: Add recents state and fetch-on-open**

Add state and fetch recent tags alongside the existing per-entity tag load:

```ts
const [recentTags, setRecentTags] = useState<Array<{ id: string; name: string; color: string | null }>>([]);

// Update the existing useEffect that fires on open:
useEffect(() => {
  if (!open) {
    setSearch("");
    return;
  }
  getTagsForEntity(entityType, entityId).then((tags) => setCurrentTags(tags));
  getRecentTags(5).then(setRecentTags);
}, [open, entityType, entityId]);
```

- [ ] **Step 3: Add recents section to the body**

After the current tags chips and before the search input, add a recents section. Filter out tags that are already applied:

```tsx
{/* Recent tags — collapse when searching */}
{recentTags.length > 0 && !search && (
  <div className="px-3 pb-1">
    <div className="text-[0.6rem] uppercase tracking-wider text-muted-foreground/60 mb-1">Recientes</div>
    <div className="flex flex-wrap gap-1">
      {recentTags
        .filter((rt) => !currentTagIds.has(rt.id))
        .slice(0, 5)
        .map((rt) => (
          <button
            key={rt.id}
            type="button"
            onClick={() => {
              const fullTag = allTags.find((t) => t.id === rt.id);
              if (fullTag) handleAdd(fullTag);
            }}
            disabled={isPending}
            className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-white/[0.06]"
          >
            {rt.name}
          </button>
        ))}
    </div>
  </div>
)}
```

- [ ] **Step 4: Visual polish — group headers with counts**

Update the group header rendering in the body to include tag count badges:

```tsx
{[...grouped.entries()].map(([groupName, groupTags]) => (
  <div key={groupName}>
    <div className="flex items-center justify-between px-3 py-1.5">
      <span className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
        {groupName}
      </span>
      <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[0.6rem] tabular-nums text-muted-foreground/60">
        {groupTags.length}
      </span>
    </div>
    {groupTags.map((tag) => (
      <button
        key={tag.id}
        type="button"
        onClick={() => handleAdd(tag)}
        disabled={isPending}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-white/5"
      >
        <span
          className="size-2 rounded-full shrink-0"
          style={{ backgroundColor: tag.groupColor ?? tag.color ?? "rgba(255,255,255,0.15)" }}
        />
        <span>{tag.name}</span>
      </button>
    ))}
  </div>
))}
```

Update the empty state:

```tsx
{filtered.length === 0 && !canCreate && (
  <div className="flex flex-col items-center gap-2 py-8 text-center">
    <Hash className="size-8 text-muted-foreground/40" />
    <p className="text-sm text-muted-foreground">
      {search ? "Sin resultados" : "No hay etiquetas disponibles"}
    </p>
  </div>
)}
```

- [ ] **Step 5: Add the drawer render variant**

After the existing dialog render block, add the drawer variant:

```tsx
// variant === "drawer"
return (
  <>
    {triggerButton}
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <Hash className="size-4 text-z-brass" />
            Etiquetas
          </DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto px-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {body}
        </div>
      </DrawerContent>
    </Drawer>
  </>
);
```

- [ ] **Step 6: Verify build passes**

Run: `cd webapp && pnpm build`
Expected: Build passes clean.

- [ ] **Step 7: Commit**

```bash
git add webapp/src/components/tags/tag-zone-picker.tsx
git commit -m "feat: upgrade TagZonePicker — drawer variant, recents, group counts, visual polish"
```

---

### Task 5: Add action chips to mobile transaction row

**Files:**
- Modify: `webapp/src/components/mobile/v2/movimientos/movimientos-transaction-row.tsx`

- [ ] **Step 1: Add imports**

Add the new imports:

```ts
import { UserRound, Hash } from "lucide-react";
import { DestinatarioZonePicker } from "@/components/destinatarios/destinatario-zone-picker";
import { TagZonePicker } from "@/components/tags/tag-zone-picker";
import { assignDestinatario, removeDestinatarioFromTransaction } from "@/actions/categorize";
```

- [ ] **Step 2: Add destinatario optimistic state**

After the existing `localCategory` state, add:

```ts
const [localDestinatario, setLocalDestinatario] = useState(tx.destinatario);
```

- [ ] **Step 3: Add destinatario handler**

After `handleCategorize`, add:

```ts
function handleDestinatarioChange(id: string | null, name: string | null) {
  if (id) {
    setLocalDestinatario({ id, name: name ?? "" });
    startTransition(async () => {
      const result = await assignDestinatario(tx.id, id);
      if (!result.success) {
        setLocalDestinatario(tx.destinatario);
        toast.error("Error al asignar destinatario");
      }
    });
  } else {
    setLocalDestinatario(null);
    startTransition(async () => {
      const result = await removeDestinatarioFromTransaction(tx.id);
      if (!result.success) {
        setLocalDestinatario(tx.destinatario);
        toast.error("Error al quitar destinatario");
      }
    });
  }
}
```

- [ ] **Step 4: Replace the expanded section with action chips**

Replace the entire `{expanded && (...)}` block with:

```tsx
{expanded && (
  <div className="flex flex-wrap items-center gap-1.5 px-2 pb-2.5 pt-0.5">
    {/* Category chip or picker */}
    {categoryName ? (
      <CategoryZonePicker
        categories={categories}
        value={localCategory?.id ?? null}
        onValueChange={handleCategorize}
        direction={tx.direction === "OUTFLOW" ? "OUTFLOW" : undefined}
        variant="drawer"
        triggerClassName="text-[10px] h-auto py-1 px-2.5 rounded-full border border-z-brass/20 bg-z-brass/8 text-z-brass hover:bg-z-brass/12 font-medium"
        selectedCategoryName={categoryName}
      />
    ) : (
      <CategoryZonePicker
        categories={categories}
        value={null}
        onValueChange={handleCategorize}
        direction={tx.direction === "OUTFLOW" ? "OUTFLOW" : undefined}
        placeholder="Categoría"
        variant="drawer"
        triggerClassName="text-[10px] h-auto py-1 px-2.5 rounded-full border border-white/8 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06]"
      />
    )}

    {/* Destinatario chip */}
    <DestinatarioZonePicker
      value={localDestinatario?.id ?? null}
      onValueChange={handleDestinatarioChange}
      selectedName={localDestinatario?.name}
      variant="drawer"
      compact
      triggerClassName={cn(
        "rounded-full text-[10px] h-auto py-1 px-2.5 font-medium",
        localDestinatario
          ? "border-z-brass/20 bg-z-brass/8 text-z-brass hover:bg-z-brass/12"
          : "border-white/8 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06]"
      )}
    />

    {/* Tag chip */}
    <TagZonePicker
      entityType="transaction"
      entityId={tx.id}
      variant="drawer"
      compact
      triggerClassName="rounded-full text-[10px] h-auto py-1 px-2.5"
    />

    <div className="flex-1" />

    {/* Edit link */}
    <Link
      href={`/transactions/${tx.id}`}
      className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-white/[0.06]"
    >
      <Pencil className="size-2.5" />
      Editar
    </Link>
  </div>
)}
```

- [ ] **Step 5: Verify build passes**

Run: `cd webapp && pnpm build`
Expected: Build passes clean.

- [ ] **Step 6: Test in browser**

Run: `cd webapp && pnpm dev`

1. Open the app on a mobile viewport (or Chrome DevTools mobile mode)
2. Navigate to `/transactions` (movimientos page)
3. Tap a transaction row → should expand showing action chips
4. Tap "👤" chip → should open DestinatarioZonePicker as bottom drawer
5. Select a destinatario → chip should update to show the name
6. Tap "#" chip → should open TagZonePicker as bottom drawer
7. Add a tag → should work without errors
8. Tap "Editar" → should navigate to `/transactions/[id]`
9. Verify recents show in both pickers when they have data

- [ ] **Step 7: Commit**

```bash
git add webapp/src/components/mobile/v2/movimientos/movimientos-transaction-row.tsx
git commit -m "feat: add destinatario/tag/edit action chips to mobile transaction row"
```

---

### Task 6: Run review agents + build gate

- [ ] **Step 1: Run full build**

Run: `cd webapp && pnpm build`
Expected: Build passes clean.

- [ ] **Step 2: Run custom review agents**

Spawn these in parallel:
- `zetas-front-guy` — review all modified TSX files for design system compliance
- `server-action-reviewer` — review the new server actions for auth, validation, cache patterns
- `cache-doctor` — verify revalidation paths for the new cached queries
- `perf-auditor` — check for render-path issues, uncached queries, bundle concerns

- [ ] **Step 3: Address any findings from review agents**

Fix issues found by review agents. If no issues, proceed.

- [ ] **Step 4: Final commit + PR**

```bash
git push -u origin feat/inline-drawer-pickers
gh pr create --title "feat: inline drawer pickers + picker improvements" --body "..."
```
