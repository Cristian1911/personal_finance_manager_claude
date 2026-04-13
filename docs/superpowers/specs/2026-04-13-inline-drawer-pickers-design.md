# Inline Drawer Pickers + Picker Improvements

**Date:** 2026-04-13
**Status:** Approved

## Goal

Add inline action chips to mobile transaction rows (tap-to-expand pattern) that open improved zone pickers as drawers. Consolidate on zone pickers for mobile, improve their visual polish, creation flows, and add subtle recent items.

## Scope

- Mobile transaction rows only (`movimientos-transaction-row.tsx`)
- Improve DestinatarioZonePicker and TagZonePicker
- Old pickers (`destinatario-picker.tsx`, `tag-picker.tsx`) stay alive for desktop consumers — desktop consolidation is a follow-up

## NOT in scope

- Desktop transaction table changes
- Account picker / transaction account reassignment
- Deleting old pickers

## Transaction Row: Tap-to-Expand with Action Chips

The mobile v2 `movimientos-transaction-row.tsx` already has an expand/collapse pattern. When expanded, a new section appears below the transaction data with action chips:

### Chips layout (expanded state)

```
┌─────────────────────────────────────────┐
│ ↗ Pago Netflix                 -$49,900 │
│   Bancolombia · Entretenimiento         │
├─────────────────────────────────────────┤
│ 👤 Netflix Inc.  # suscripción  ✏️ Editar │
└─────────────────────────────────────────┘
```

### Chip states

| Chip | Unset | Set |
|---|---|---|
| Destinatario | `👤 + Destinatario` (muted) | `👤 Netflix Inc.` (brass accent) |
| Tags | `# + Etiqueta` (muted) | `# suscripción` chip per tag (brass accent) |
| Edit | `✏️ Editar` (always muted) | N/A — always a link |

### Chip behavior

- **Destinatario chip** → opens DestinatarioZonePicker as drawer
- **Tag chip** → opens TagZonePicker as drawer
- **Edit chip** → navigates to `/transactions/[id]`
- When a picker assigns a value, the chip updates immediately via `startTransition` + server action
- Assigned chips show the value and can be tapped again to change

## DestinatarioZonePicker Improvements

**File:** `webapp/src/components/destinatarios/destinatario-zone-picker.tsx`

### Visual polish
- Better section spacing and dividers
- Empty state with illustration/message when no destinatarios exist
- Selected state with brass accent border
- Group headers styled consistently with CategoryZonePicker

### Creation flow upgrade
- Inline creation form expands below the list (current pattern)
- Add: default category selector (CategoryZonePicker, compact variant)
- Add: single pattern field with match type toggle (contains/exact)
- Keep it one-screen — no modal-in-drawer. Pattern testing is NOT included (too complex for inline; users can test from the destinatario detail page)

### Recent items
- Show last 3 distinct destinatarios assigned by this user
- Displayed as small horizontal chips above the search input
- Collapse/hide when search input is focused or has text
- Data: new `getRecentDestinatarios(userId, accessToken, limit)` cached query

## TagZonePicker Improvements

**File:** `webapp/src/components/tags/tag-zone-picker.tsx`

### Visual polish
- Group headers with tag count badges
- Better chip layout and spacing
- Empty state when no tags exist
- Consistent styling with DestinatarioZonePicker

### Recent items
- Show last 3-5 distinct tags used by this user
- Displayed as small horizontal chips above the search input
- Collapse/hide when search input is focused or has text
- Data: new `getRecentTags(userId, accessToken, limit)` cached query

## Server Actions

### `getRecentDestinatarios`

```ts
// In webapp/src/actions/destinatarios.ts
async function getRecentDestinatariosCached(
  userId: string,
  accessToken: string,
  limit: number
): Promise<Array<{ id: string; name: string }>> {
  "use cache";
  cacheTag("destinatarios");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  // Query: distinct destinatarios from recent transactions
  const { data } = await supabase
    .from("transactions")
    .select("destinatario_id, destinatarios!transactions_destinatario_id_fkey(id, name)")
    .eq("user_id", userId)
    .not("destinatario_id", "is", null)
    .order("transaction_date", { ascending: false })
    .limit(50); // fetch more, then deduplicate

  // Deduplicate and take first N distinct
  // ... return Array<{ id, name }>
}
```

### `getRecentTags`

```ts
// In webapp/src/actions/tags.ts
async function getRecentTagsCached(
  userId: string,
  accessToken: string,
  limit: number
): Promise<Array<{ id: string; name: string }>> {
  "use cache";
  cacheTag("tags");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  // Query: distinct tags from recent transaction_tags
  const { data } = await supabase
    .from("transaction_tags")
    .select("tag_id, tags!inner(id, name), transactions!inner(user_id)")
    .eq("transactions.user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  // Deduplicate and take first N distinct
  // ... return Array<{ id, name }>
}
```

## Files to Modify

| File | Changes |
|---|---|
| `movimientos-transaction-row.tsx` | Add action chips section to expanded state, wire drawer openers |
| `destinatario-zone-picker.tsx` | Visual polish, creation flow with category + pattern, recents section |
| `tag-zone-picker.tsx` | Visual polish, group headers with counts, recents section |
| `destinatarios.ts` (actions) | Add `getRecentDestinatarios` cached query + public wrapper |
| `tags.ts` (actions) | Add `getRecentTags` cached query + public wrapper |

## Revalidation

- Destinatario assignment: existing `assignDestinatario` action already calls `revalidateFinancialViews()` + `revalidateTag("destinatarios")`
- Tag assignment: existing `addTagToEntity` / `removeTagFromEntity` already call `revalidateTag("tags")` + `revalidateTag("transactions")` (fixed in PR #129)
- Recent items caches tagged with `"destinatarios"` / `"tags"` — automatically busted by the above

## Pending Follow-up

- **Desktop transaction table expansion** — same chip pattern for desktop rows, migrate desktop consumers from old pickers to zone pickers, delete `destinatario-picker.tsx` and `tag-picker.tsx`
