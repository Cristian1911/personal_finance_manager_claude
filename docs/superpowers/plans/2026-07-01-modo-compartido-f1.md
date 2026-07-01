# Modo compartido (Fase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir un modo en un pool de gastos compartidos single-user: marcar el modo como compartido con contraparte(s) + ratio, y repartir en lote sus pagos entre el usuario y esas personas reusando el split-ledger existente.

**Architecture:** El modo gana `is_shared` + config de reparto + tabla `modo_participants`. La lógica de "repartir una tx existente" se extrae de `createSharedPayment` a un helper webapp-side reutilizable. Dos acciones batch (`shareModoTransactions`/`unshareModoTransactions`) aplican/quitan el reparto sobre los pagos del modo. El resumen del modo agrega el settle-up por persona (solo pagos de este modo).

**Tech Stack:** Next.js 15 Server Actions, Supabase (RLS + defense-in-depth), Zod 4, `@zeta/shared` (`computeSplit`), Vitest.

## Global Constraints

- Spanish-first UI — todos los strings de cara al usuario en español.
- Package manager: **pnpm** (desde repo root para lockfile). Build gate: `pnpm build` verde + `pnpm audit --audit-level high` limpio antes de PR.
- Auth en server actions: `getAuthenticatedClient()`. Defense-in-depth: `.eq("user_id", user.id)` incluso con RLS.
- Cache: mutaciones usan `updateTag("tag")` (importado como `expireTag` en `modos.ts`), NUNCA `revalidateTag`. Tags afectados: `modos`, `personal-debts` + `revalidateFinancialViews()`.
- **NUNCA full-regen `webapp/src/types/database.ts`** — el CLI mueve vistas cifradas a `Views` y rompe inserts. Hand-add columnas/tabla nuevas.
- Split: solo `equal` | `percent` en este flujo (`amount` no aplica). La validación exact-sum de ratios la hace `computeSplit`, no duplicar en Zod.
- Destinatario picker: pasar `createKind='person'` en TODOS los paths de creación (footgun: `kindFilter` solo filtra lecturas).
- UI: tokens de `docs/design-system/TOKENS.md` (`text-z-brass`, `bg-z-surface-2`, `border-white/6`); botones solo `BRASS_BUTTON_CLASS`/`GHOST_BUTTON_CLASS`/`BRASS_GHOST_BUTTON_CLASS`. Reusar `BulkActionBar` y `record-repayment-dialog`.

## File Structure

- `supabase/migrations/<ts>_modo_compartido.sql` — columnas en `modos` + tabla `modo_participants` + RLS + grants + índices.
- `webapp/src/types/database.ts` — hand-add (modos cols + `modo_participants` Row/Insert/Update).
- `webapp/src/lib/validators/modo.ts` — extender `modoSchema`.
- `webapp/src/lib/validators/__tests__/modo.test.ts` — casos nuevos.
- `webapp/src/actions/shared-payments.ts` — extraer `splitExistingTransaction`; `createSharedPayment` la consume.
- `webapp/src/actions/modos.ts` — `shareModoTransactions`, `unshareModoTransactions`; extender `parseModoForm`/`createModo`/`updateModo` + sync de participantes; leer participantes en `getModoSummary`.
- `webapp/src/lib/utils/modo-summary.ts` — `settleUpByPerson()` (pura).
- `webapp/src/lib/utils/__tests__/modo-summary.test.ts` — casos de `settleUpByPerson`.
- `webapp/src/components/modos/modo-form-dialog.tsx` — toggle compartir + pickers.
- `webapp/src/components/modos/modo-summary-view.tsx` — "Compartir todos" + selección + settle-up por persona.
- `webapp/src/types/domain.ts` — tipos `ModoParticipant`, `Modo` (extender), `SettleUpPerson`.

---

## Task 1: Migración DB + tipos

**Files:**
- Create: `supabase/migrations/<ts>_modo_compartido.sql`
- Modify: `webapp/src/types/database.ts` (hand-add)
- Modify: `webapp/src/types/domain.ts`

**Interfaces:**
- Produces: tabla `modo_participants`; `modos` += `is_shared boolean`, `split_method text`, `user_included boolean`. Tipos `Modo` (extendido), `ModoParticipant`.

- [ ] **Step 1: Escribir la migración**

Archivo `supabase/migrations/<ts>_modo_compartido.sql` (usar timestamp real, formato `YYYYMMDDHHMMSS`, posterior a `20260701180000`):

```sql
-- Modo compartido (Fase 1): el modo puede ser un pool de gastos compartidos.
alter table public.modos
  add column is_shared boolean not null default false,
  add column split_method text not null default 'equal',
  add column user_included boolean not null default true,
  add constraint modos_split_method_chk check (split_method in ('equal','percent'));

-- Participantes del pool (Fase 1: single-user; destinatario tipo persona).
-- Forward-compat Fase 2: se añadirán member_user_id + invite_status aquí.
create table public.modo_participants (
  id uuid primary key default gen_random_uuid(),
  modo_id uuid not null references public.modos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  destinatario_id uuid not null references public.destinatarios(id) on delete cascade,
  share_value numeric,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (modo_id, destinatario_id)
);

alter table public.modo_participants enable row level security;

create policy "modo_participants_select_own" on public.modo_participants
  for select using ((select auth.uid()) = user_id);
create policy "modo_participants_insert_own" on public.modo_participants
  for insert with check ((select auth.uid()) = user_id);
create policy "modo_participants_update_own" on public.modo_participants
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "modo_participants_delete_own" on public.modo_participants
  for delete using ((select auth.uid()) = user_id);

create index modo_participants_modo_id_idx on public.modo_participants (modo_id);
create index modo_participants_user_id_idx on public.modo_participants (user_id);

-- Grants (RLS filtra; los grants dan el privilegio). Precedente: modos, personal_debts.
grant select, insert, update, delete on public.modo_participants to authenticated;
grant all on public.modo_participants to postgres, service_role;
```

- [ ] **Step 2: Aplicar la migración**

Run: `npx supabase db push`
Expected: aplica sin error; confirma `modo_participants` creada.

- [ ] **Step 3: Hand-add tipos en `database.ts`**

En `webapp/src/types/database.ts`, dentro de `public.Tables`, extender el bloque `modos` (Row/Insert/Update) con:
```ts
is_shared: boolean
split_method: string
user_included: boolean
```
(en Insert/Update como opcionales: `is_shared?: boolean`, etc.)

Y añadir el bloque `modo_participants` (mismo shape que la tabla), copiando el patrón de otra tabla plana (`personal_debts`):
```ts
modo_participants: {
  Row: {
    id: string
    modo_id: string
    user_id: string
    destinatario_id: string
    share_value: number | null
    position: number
    created_at: string
  }
  Insert: {
    id?: string
    modo_id: string
    user_id: string
    destinatario_id: string
    share_value?: number | null
    position?: number
    created_at?: string
  }
  Update: {
    id?: string
    modo_id?: string
    user_id?: string
    destinatario_id?: string
    share_value?: number | null
    position?: number
    created_at?: string
  }
  Relationships: []
}
```

- [ ] **Step 4: Tipos de dominio en `domain.ts`**

Añadir/extender en `webapp/src/types/domain.ts`:
```ts
export type ModoParticipant = Database["public"]["Tables"]["modo_participants"]["Row"];
```
Verificar que `Modo` (aliased de la Row de `modos`) ahora incluye los 3 campos nuevos (es automático si `Modo = ...Tables["modos"]["Row"]`).

- [ ] **Step 5: Build gate**

Run: `cd webapp && pnpm build`
Expected: compila sin errores de tipo.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations webapp/src/types/database.ts webapp/src/types/domain.ts
git commit -m "feat(modos): schema modo compartido + modo_participants"
```

---

## Task 2: Validador extendido

**Files:**
- Modify: `webapp/src/lib/validators/modo.ts`
- Test: `webapp/src/lib/validators/__tests__/modo.test.ts`

**Interfaces:**
- Produces: `modoSchema` acepta `is_shared`, `split_method`, `user_included`, `participants[]`; `ModoInput` extendido.

- [ ] **Step 1: Escribir el test que falla**

Añadir a `webapp/src/lib/validators/__tests__/modo.test.ts`:
```ts
it("acepta un modo compartido con participantes", () => {
  const r = modoSchema.safeParse({
    name: "Viaje", date_from: "2026-07-01", date_to: "2026-07-10",
    tag_ids: [], is_shared: true, split_method: "equal", user_included: true,
    participants: [{ destinatario_id: "11111111-1111-1111-1111-111111111111" }],
  });
  expect(r.success).toBe(true);
});

it("rechaza modo compartido sin participantes", () => {
  const r = modoSchema.safeParse({
    name: "Viaje", date_from: "2026-07-01", date_to: "2026-07-10",
    tag_ids: [], is_shared: true, participants: [],
  });
  expect(r.success).toBe(false);
});

it("modo no compartido no exige participantes (default false)", () => {
  const r = modoSchema.safeParse({
    name: "X", date_from: "2026-07-01", date_to: "2026-07-10", tag_ids: [],
  });
  expect(r.success).toBe(true);
  if (r.success) expect(r.data.is_shared).toBe(false);
});
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run: `cd webapp && pnpm vitest run src/lib/validators/__tests__/modo.test.ts`
Expected: FAIL (el schema aún no tiene los campos / no aplica el refine).

- [ ] **Step 3: Extender el schema**

En `webapp/src/lib/validators/modo.ts`, dentro del `.object({...})` (antes del primer `.refine`):
```ts
    is_shared: z.boolean().default(false),
    split_method: z.enum(["equal", "percent"]).default("equal"),
    user_included: z.boolean().default(true),
    participants: z
      .array(
        z.object({
          destinatario_id: uuidStr("Persona inválida"),
          value: z.coerce.number().nonnegative().optional(),
        }),
      )
      .default([]),
```
Y añadir un segundo `.refine` después del existente:
```ts
  .refine((d) => !d.is_shared || d.participants.length >= 1, {
    message: "Agrega al menos una persona para compartir",
    path: ["participants"],
  })
```

- [ ] **Step 4: Correr el test (debe pasar)**

Run: `cd webapp && pnpm vitest run src/lib/validators/__tests__/modo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/lib/validators/modo.ts webapp/src/lib/validators/__tests__/modo.test.ts
git commit -m "feat(modos): validador de config compartida"
```

---

## Task 3: Extraer `splitExistingTransaction`

**Files:**
- Modify: `webapp/src/actions/shared-payments.ts`

**Interfaces:**
- Produces:
```ts
type SplitTxConfig = {
  method: "equal" | "amount" | "percent";
  userIncluded: boolean;
  participants: { destinatario_id: string; value?: number }[];
  due_date?: string | null;
  description?: string | null;
};
async function splitExistingTransaction(
  supabase: SupabaseClient<Database>,
  userId: string,
  tx: { id: string; amount: number; currency_code: string },
  config: SplitTxConfig,
): Promise<{ ok: true; split_group_id: string; debt_ids: string[] } | { ok: false; error: string }>;
```
- Consumes: `computeSplit`, `getCurrencyDecimals`, `SPLIT_ERROR_MESSAGES` (ya en el archivo).

- [ ] **Step 1: Escribir el helper**

En `webapp/src/actions/shared-payments.ts`, añadir (importar `SupabaseClient` de `@supabase/supabase-js` si falta). El caller garantiza que `tx` es OUTFLOW, `split_group_id` null y `personal_debt_id` null (esas comprobaciones se quedan también en `createSharedPayment` para el modo `existing` directo):
```ts
async function splitExistingTransaction(
  supabase: SupabaseClient<Database>,
  userId: string,
  tx: { id: string; amount: number; currency_code: string },
  config: SplitTxConfig,
): Promise<{ ok: true; split_group_id: string; debt_ids: string[] } | { ok: false; error: string }> {
  const decimals = getCurrencyDecimals(tx.currency_code as CurrencyCode);
  const split = computeSplit({
    total: tx.amount,
    method: config.method,
    participants: config.participants.map((x) => ({ destinatario_id: x.destinatario_id, value: x.value })),
    userIncluded: config.userIncluded,
    decimals,
  });
  if (!split.ok) return { ok: false, error: SPLIT_ERROR_MESSAGES[split.reason] };

  const splitGroupId = crypto.randomUUID();
  const { error: updErr } = await supabase
    .from("transactions")
    .update({ split_group_id: splitGroupId, split_repaid_amount: 0 })
    .eq("id", tx.id)
    .eq("user_id", userId);
  if (updErr) return { ok: false, error: "Error al marcar la transacción como pago compartido" };

  const debtIds: string[] = [];
  const debtsToInsert: PersonalDebtInsert[] = split.shares.map((share) => {
    const debtId = crypto.randomUUID();
    debtIds.push(debtId);
    return {
      id: debtId,
      user_id: userId,
      destinatario_id: share.destinatario_id!,
      direction: "lent",
      principal_amount: share.amount,
      outstanding_amount: share.amount,
      currency_code: tx.currency_code,
      opened_on: undefined as unknown as string, // set by caller-provided paid_on below
      due_date: config.due_date ?? null,
      notes: config.description ?? null,
      status: "active",
      split_group_id: splitGroupId,
      origin_transaction_id: tx.id,
    };
  });
  // opened_on = fecha de la tx; el caller la resuelve, así que la pasamos por config.
  return finalizeDebts();

  async function finalizeDebts() {
    const { error: debtsErr } = await supabase.from("personal_debts").insert(debtsToInsert);
    if (debtsErr) {
      // Compensating: un-tag (no hubo delta de saldo — la tx ya estaba posteada).
      await supabase.from("transactions")
        .update({ split_group_id: null, split_repaid_amount: null })
        .eq("id", tx.id).eq("user_id", userId);
      return { ok: false as const, error: "Error al crear las deudas del reparto" };
    }
    return { ok: true as const, split_group_id: splitGroupId, debt_ids: debtIds };
  }
}
```
> Nota: `opened_on` debe ser la fecha de la tx. Añadir `opened_on: string` a `SplitTxConfig` (el caller lo provee: en `existing` = `tx.transaction_date`; en el batch del modo = la fecha de cada tx) y usarlo en el `map`. Corregir el placeholder `undefined as unknown` → `config.opened_on`.

Ajustar `SplitTxConfig`:
```ts
type SplitTxConfig = {
  method: "equal" | "amount" | "percent";
  userIncluded: boolean;
  participants: { destinatario_id: string; value?: number }[];
  opened_on: string;
  due_date?: string | null;
  description?: string | null;
};
```

- [ ] **Step 2: Refactorizar `createSharedPayment` modo `existing` para usar el helper**

Reemplazar el bloque inline de `existing` (pasos 1+2 del código actual: el `update` del split_group_id y el insert de `debtsToInsert`) por:
```ts
if (p.mode === "existing") {
  const res = await splitExistingTransaction(
    supabase, user.id,
    { id: existingTxId!, amount: total, currency_code: currency },
    { method: p.method, userIncluded: p.user_included, participants: p.participants,
      opened_on: paidOn, due_date: p.due_date, description: p.description },
  );
  if (!res.ok) return { success: false, error: res.error };
  revalidateFinancialViews();
  updateTag("personal-debts");
  return { success: true, data: { split_group_id: res.split_group_id, debt_ids: res.debt_ids } };
}
```
El modo `new` (crea tx + aplica delta de saldo) queda **sin cambios**.

- [ ] **Step 3: Build gate**

Run: `cd webapp && pnpm build`
Expected: compila. El comportamiento del sheet de pago-único (modo existing) queda idéntico (misma lógica, ahora en el helper).

- [ ] **Step 4: Commit**

```bash
git add webapp/src/actions/shared-payments.ts
git commit -m "refactor(shared-payments): extraer splitExistingTransaction"
```

---

## Task 4: Acciones batch + persistir config del modo

**Files:**
- Modify: `webapp/src/actions/modos.ts`
- Modify: `webapp/src/actions/shared-payments.ts` (exportar `splitExistingTransaction` + `SplitTxConfig`)

**Interfaces:**
- Consumes: `splitExistingTransaction`, `getModoTransactionIds`.
- Produces:
```ts
async function shareModoTransactions(modoId: string, txIds?: string[]):
  Promise<ActionResult<{ shared: number; skipped: { id: string; reason: "already_shared"|"inflow"|"linked_to_person" }[]; failed: string[] }>>;
async function unshareModoTransactions(modoId: string, txIds?: string[]):
  Promise<ActionResult<{ unshared: number }>>;
async function getModoParticipants(modoId, userId, accessToken): Promise<ModoParticipant[]>; // helper interno
```

- [ ] **Step 1: Exportar el helper**

En `shared-payments.ts`, añadir `export` a `splitExistingTransaction` y `export type SplitTxConfig`.

- [ ] **Step 2: `shareModoTransactions`**

En `modos.ts` (importar `splitExistingTransaction` y `revalidateFinancialViews`):
```ts
export async function shareModoTransactions(
  modoId: string,
  txIds?: string[],
): Promise<ActionResult<{ shared: number; skipped: { id: string; reason: "already_shared"|"inflow"|"linked_to_person" }[]; failed: string[] }>> {
  const { supabase, user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };

  const { data: modo, error: modoErr } = await supabase
    .from("modos").select("*").eq("id", modoId).eq("user_id", user.id).single();
  if (modoErr || !modo) return { success: false, error: "Modo no encontrado" };
  if (!modo.is_shared) return { success: false, error: "Este modo no es compartido" };

  const { data: parts } = await supabase
    .from("modo_participants").select("destinatario_id, share_value")
    .eq("modo_id", modoId).eq("user_id", user.id);
  if (!parts || parts.length === 0) return { success: false, error: "El modo no tiene personas para compartir" };

  const candidateIds = txIds && txIds.length
    ? txIds
    : await getModoTransactionIds(modo, user.id, accessToken);
  if (candidateIds.length === 0) return { success: true, data: { shared: 0, skipped: [], failed: [] } };

  const { data: txs } = await supabase
    .from("transactions")
    .select("id, amount, currency_code, direction, transaction_date, split_group_id, personal_debt_id")
    .eq("user_id", user.id).in("id", candidateIds);

  const skipped: { id: string; reason: "already_shared"|"inflow"|"linked_to_person" }[] = [];
  const failed: string[] = [];
  let shared = 0;

  for (const tx of txs ?? []) {
    if (tx.direction !== "OUTFLOW") { skipped.push({ id: tx.id, reason: "inflow" }); continue; }
    if (tx.split_group_id) { skipped.push({ id: tx.id, reason: "already_shared" }); continue; }
    if (tx.personal_debt_id) { skipped.push({ id: tx.id, reason: "linked_to_person" }); continue; }
    if (tx.amount == null || tx.currency_code == null) { failed.push(tx.id); continue; }
    const res = await splitExistingTransaction(
      supabase, user.id,
      { id: tx.id, amount: Number(tx.amount), currency_code: tx.currency_code },
      { method: modo.split_method as "equal"|"percent", userIncluded: modo.user_included,
        participants: parts.map((p) => ({ destinatario_id: p.destinatario_id, value: p.share_value ?? undefined })),
        opened_on: tx.transaction_date, description: modo.name },
    );
    if (res.ok) shared += 1; else failed.push(tx.id);
  }

  revalidateFinancialViews();
  expireTag("personal-debts");
  expireTag("modos");
  return { success: true, data: { shared, skipped, failed } };
}
```
> ponytail: reparto secuencial (loop `await`) — un modo tiene decenas de pagos, no miles. Si un modo llegara a cientos, paralelizar con `Promise.all` acotado. Ceiling conocido, upgrade trivial.

- [ ] **Step 3: `unshareModoTransactions`**

```ts
export async function unshareModoTransactions(
  modoId: string,
  txIds?: string[],
): Promise<ActionResult<{ unshared: number }>> {
  const { supabase, user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };

  const { data: modo, error: modoErr } = await supabase
    .from("modos").select("*").eq("id", modoId).eq("user_id", user.id).single();
  if (modoErr || !modo) return { success: false, error: "Modo no encontrado" };

  const scope = txIds && txIds.length ? txIds : await getModoTransactionIds(modo, user.id, accessToken);
  if (scope.length === 0) return { success: true, data: { unshared: 0 } };

  const { data: txs } = await supabase
    .from("transactions").select("id, split_group_id")
    .eq("user_id", user.id).in("id", scope).not("split_group_id", "is", null);
  const groupIds = [...new Set((txs ?? []).map((t) => t.split_group_id).filter((x): x is string => !!x))];
  if (groupIds.length === 0) return { success: true, data: { unshared: 0 } };

  // Mismo efecto que deleteSharedPayment, batcheado por grupos del modo:
  await supabase.from("personal_debts").delete().eq("user_id", user.id).in("split_group_id", groupIds);
  await supabase.from("transactions")
    .update({ split_group_id: null, split_repaid_amount: null })
    .eq("user_id", user.id).in("split_group_id", groupIds);

  revalidateFinancialViews();
  expireTag("personal-debts");
  expireTag("modos");
  return { success: true, data: { unshared: groupIds.length } };
}
```
> ponytail: no borra los abonos (`transactions.personal_debt_id` con `pd_role='repayment'`) — igual que `deleteSharedPayment`; el `ON DELETE SET NULL` los deja como INFLOW real recibido. Comportamiento intencional heredado.

- [ ] **Step 4: Persistir config + participantes en create/update del modo**

Extender `parseModoForm` para leer los campos nuevos:
```ts
  let participants: unknown = [];
  try { participants = JSON.parse((formData.get("participants") as string) || "[]"); }
  catch { return { success: false, error: "Personas inválidas" }; }
  const parsed = modoSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color") || null,
    emoji: formData.get("emoji") || null,
    date_from: formData.get("date_from"),
    date_to: formData.get("date_to"),
    tag_ids: tagIds,
    is_shared: formData.get("is_shared") === "true",
    split_method: formData.get("split_method") || "equal",
    user_included: formData.get("user_included") !== "false",
    participants,
  });
```
En `createModo`: tras insertar el modo, si `parsed.data.participants.length`, insertar filas en `modo_participants`. **No** pasar `participants` al insert de `modos` (no es columna) — desestructurar:
```ts
  const { participants: parts, ...modoRow } = parsed.data;
  const { data, error } = await supabase.from("modos")
    .insert({ ...modoRow, user_id: user.id }).select("id").single();
  if (error || !data) return { success: false, error: error?.message ?? "Error al crear el modo" };
  if (modoRow.is_shared && parts.length) {
    await supabase.from("modo_participants").insert(
      parts.map((p, i) => ({ modo_id: data.id, user_id: user.id, destinatario_id: p.destinatario_id, share_value: p.value ?? null, position: i })),
    );
  }
  expireTag("modos");
```
En `updateModo`: actualizar `modos` (sin `participants`), luego **reemplazar** participantes (delete + insert diff simple):
```ts
  const { participants: parts, ...modoRow } = parsed.data;
  const { error } = await supabase.from("modos").update(modoRow).eq("id", id).eq("user_id", user.id);
  if (error) return { success: false, error: error.message };
  await supabase.from("modo_participants").delete().eq("modo_id", id).eq("user_id", user.id);
  if (modoRow.is_shared && parts.length) {
    await supabase.from("modo_participants").insert(
      parts.map((p, i) => ({ modo_id: id, user_id: user.id, destinatario_id: p.destinatario_id, share_value: p.value ?? null, position: i })),
    );
  }
  expireTag("modos");
```
> ponytail: delete-all + re-insert en vez de diff fino. N participantes ≈ 1–3. Diff real si escala.

- [ ] **Step 5: Exponer participantes en `getModoSummary`**

Añadir la lectura de participantes al `Promise.all` de `getModoSummary` y devolverlos:
```ts
  const [{ data: modo, error }, groupsResult, { data: participants }] = await Promise.all([
    supabase.from("modos").select("*").eq("id", id).eq("user_id", user.id).single(),
    getSharedPaymentGroups(),
    supabase.from("modo_participants").select("*").eq("modo_id", id).eq("user_id", user.id).order("position"),
  ]);
```
Extender el tipo de retorno con `participants: ModoParticipant[]` (default `participants ?? []`).

- [ ] **Step 6: Build gate**

Run: `cd webapp && pnpm build`
Expected: compila.

- [ ] **Step 7: Commit**

```bash
git add webapp/src/actions/modos.ts webapp/src/actions/shared-payments.ts
git commit -m "feat(modos): acciones batch compartir/quitar + persistir config"
```

---

## Task 5: Settle-up por persona (util pura)

**Files:**
- Modify: `webapp/src/lib/utils/modo-summary.ts`
- Test: `webapp/src/lib/utils/__tests__/modo-summary.test.ts`

**Interfaces:**
- Produces:
```ts
type SettleUpPerson = { destinatarioId: string; name: string; principal: number; outstanding: number; oldestActiveDebtId: string | null };
function settleUpByPerson(groups: SharedPaymentGroup[], txIds: string[]): SettleUpPerson[];
```

- [ ] **Step 1: Escribir el test que falla**

Añadir a `modo-summary.test.ts` (construir `SharedPaymentGroup[]` mínimos: cada grupo con `debts: [{ destinatario_id, destinatario_name, principal_amount, outstanding_amount, status, origin_transaction_id, ... }]`; solo los campos que usa la función):
```ts
import { settleUpByPerson } from "../modo-summary";

it("agrega pendiente por persona solo de tx del modo", () => {
  const groups = [
    { split_group_id: "g1", debts: [
      { destinatario_id: "p1", destinatario_name: "Estefa", principal_amount: 100, outstanding_amount: 60, status: "active", origin_transaction_id: "tx1", id: "d1" },
    ] },
    { split_group_id: "g2", debts: [
      { destinatario_id: "p1", destinatario_name: "Estefa", principal_amount: 50, outstanding_amount: 0, status: "paid", origin_transaction_id: "tx2", id: "d2" },
    ] },
    { split_group_id: "g3", debts: [
      { destinatario_id: "p2", destinatario_name: "Ana", principal_amount: 30, outstanding_amount: 30, status: "active", origin_transaction_id: "txZ", id: "d3" },
    ] },
  ] as unknown as import("@/types/domain").SharedPaymentGroup[];

  const res = settleUpByPerson(groups, ["tx1", "tx2"]); // txZ fuera del modo
  expect(res).toHaveLength(1);
  expect(res[0].destinatarioId).toBe("p1");
  expect(res[0].principal).toBe(150);
  expect(res[0].outstanding).toBe(60);
  expect(res[0].oldestActiveDebtId).toBe("d1");
});
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run: `cd webapp && pnpm vitest run src/lib/utils/__tests__/modo-summary.test.ts`
Expected: FAIL (`settleUpByPerson` no existe).

- [ ] **Step 3: Implementar**

En `modo-summary.ts`:
```ts
export type SettleUpPerson = {
  destinatarioId: string;
  name: string;
  principal: number;
  outstanding: number;
  oldestActiveDebtId: string | null;
};

export function settleUpByPerson(
  groups: SharedPaymentGroup[],
  txIds: string[],
): SettleUpPerson[] {
  const set = new Set(txIds);
  const byPerson = new Map<string, SettleUpPerson>();
  for (const g of groups) {
    for (const d of g.debts) {
      if (d.origin_transaction_id == null || !set.has(d.origin_transaction_id)) continue;
      const cur = byPerson.get(d.destinatario_id) ?? {
        destinatarioId: d.destinatario_id, name: d.destinatario_name ?? "—",
        principal: 0, outstanding: 0, oldestActiveDebtId: null,
      };
      cur.principal += d.principal_amount;
      if (d.status === "active") {
        cur.outstanding += d.outstanding_amount;
        if (cur.oldestActiveDebtId == null) cur.oldestActiveDebtId = d.id;
      }
      byPerson.set(d.destinatario_id, cur);
    }
  }
  return [...byPerson.values()].sort((a, b) => b.outstanding - a.outstanding);
}
```

- [ ] **Step 4: Correr el test (debe pasar)**

Run: `cd webapp && pnpm vitest run src/lib/utils/__tests__/modo-summary.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/lib/utils/modo-summary.ts webapp/src/lib/utils/__tests__/modo-summary.test.ts
git commit -m "feat(modos): settleUpByPerson (agregación por persona del modo)"
```

---

## Task 6: UI — form dialog (config compartida)

**Files:**
- Modify: `webapp/src/components/modos/modo-form-dialog.tsx`

**Interfaces:**
- Consumes: `createModo`/`updateModo` (FormData ahora con `is_shared`, `split_method`, `user_included`, `participants` JSON).

- [ ] **Step 1: Añadir estado + toggle**

En `modo-form-dialog.tsx`, añadir estado local:
```tsx
const [isShared, setIsShared] = useState(modo?.is_shared ?? false);
const [splitMethod, setSplitMethod] = useState<"equal" | "percent">((modo?.split_method as "equal"|"percent") ?? "equal");
const [userIncluded, setUserIncluded] = useState(modo?.user_included ?? true);
const [participants, setParticipants] = useState<{ destinatario_id: string; value?: number }[]>(initialParticipants ?? []);
```
(Si el dialog aún no recibe participantes iniciales, aceptar una prop `initialParticipants?: {destinatario_id:string; value?:number}[]` y pasarla desde el caller que ya tiene el modo.)

- [ ] **Step 2: Render de la sección compartida**

Debajo de los campos existentes, con tokens del design system (usar `Checkbox` de shadcn con `checked`/`onCheckedChange`, segmented para método):
```tsx
<label className="flex items-center gap-2 text-sm">
  <Checkbox checked={isShared} onCheckedChange={(v) => setIsShared(v === true)} />
  Compartir gastos de este modo
</label>
{isShared && (
  <div className="space-y-3 rounded-xl border border-white/6 bg-z-surface-2 p-3">
    <DestinatarioZonePicker
      kindFilter="person"
      createKind="person"
      value={participants.map((p) => p.destinatario_id)}
      onChange={(ids: string[]) => setParticipants(ids.map((id) => participants.find((p) => p.destinatario_id === id) ?? { destinatario_id: id }))}
      multiple
    />
    <div className="flex gap-2">
      {(["equal", "percent"] as const).map((m) => (
        <button key={m} type="button" onClick={() => setSplitMethod(m)}
          className={splitMethod === m ? BRASS_BUTTON_CLASS : GHOST_BUTTON_CLASS}>
          {m === "equal" ? "Partes iguales" : "Porcentaje"}
        </button>
      ))}
    </div>
    {splitMethod === "percent" && participants.map((p, i) => (
      <input key={p.destinatario_id} type="number" min={0} max={100}
        className="w-full rounded-md border border-white/6 bg-transparent px-2 py-1 text-sm"
        placeholder="% de esta persona" value={p.value ?? ""}
        onChange={(e) => setParticipants(participants.map((x, j) => j === i ? { ...x, value: Number(e.target.value) } : x))} />
    ))}
    <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={userIncluded} onCheckedChange={(v) => setUserIncluded(v === true)} />
      Incluirme en el reparto
    </label>
  </div>
)}
```
> Verificar imports: `DestinatarioZonePicker`, `Checkbox`, `BRASS_BUTTON_CLASS`/`GHOST_BUTTON_CLASS` desde `@/lib/constants/styles`. Confirmar la API real de `DestinatarioZonePicker` (props `kindFilter`/`createKind`/multiselección) y ajustar el binding si difiere.

- [ ] **Step 3: Serializar al submit**

Donde se arma el `FormData` antes de `createModo`/`updateModo`, añadir:
```ts
formData.set("is_shared", String(isShared));
formData.set("split_method", splitMethod);
formData.set("user_included", String(userIncluded));
formData.set("participants", JSON.stringify(isShared ? participants : []));
```

- [ ] **Step 4: Build gate**

Run: `cd webapp && pnpm build`
Expected: compila.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/modos/modo-form-dialog.tsx
git commit -m "feat(modos): UI config de modo compartido en el form"
```

---

## Task 7: UI — resumen (compartir todos + selección + settle-up)

**Files:**
- Modify: `webapp/src/components/modos/modo-summary-view.tsx`
- Modify: caller de `ModoSummaryView` (la page `/modos/[id]`) para pasar `participants` si hace falta.

**Interfaces:**
- Consumes: `shareModoTransactions`, `unshareModoTransactions`, `settleUpByPerson`, `record-repayment-dialog`.

- [ ] **Step 1: Convertir a client-aware las acciones**

`modo-summary-view.tsx` hoy es server-friendly. Añadir `"use client"` (o extraer un sub-componente cliente para la parte interactiva) con estado de selección:
```tsx
const [selected, setSelected] = useState<Set<string>>(new Set());
const [pending, startTransition] = useTransition();
```

- [ ] **Step 2: Botón "Compartir todos"** (solo si `modo.is_shared`)

```tsx
{modo.is_shared && (
  <button type="button" disabled={pending} className={BRASS_BUTTON_CLASS}
    onClick={() => startTransition(async () => {
      const r = await shareModoTransactions(modo.id);
      if (r.success) toast.success(`${r.data.shared} repartidos · ${r.data.skipped.length} omitidos · ${r.data.failed.length} con error`);
      else toast.error(r.error);
    })}>
    Compartir todos los pagos
  </button>
)}
```

- [ ] **Step 3: Checkboxes en la lista (Bloque 4) + BulkActionBar**

En cada fila de transacción añadir un `Checkbox` que togglea `selected`. Cuando `selected.size > 0` y `modo.is_shared`, renderizar `BulkActionBar` con dos acciones:
```tsx
{modo.is_shared && selected.size > 0 && (
  <BulkActionBar count={selected.size} onClear={() => setSelected(new Set())}>
    <button type="button" className={BRASS_BUTTON_CLASS} disabled={pending}
      onClick={() => startTransition(async () => {
        const r = await shareModoTransactions(modo.id, [...selected]);
        if (r.success) { toast.success(`${r.data.shared} repartidos`); setSelected(new Set()); }
        else toast.error(r.error);
      })}>Compartir seleccionados</button>
    <button type="button" className={GHOST_BUTTON_CLASS} disabled={pending}
      onClick={() => startTransition(async () => {
        const r = await unshareModoTransactions(modo.id, [...selected]);
        if (r.success) { toast.success(`${r.data.unshared} quitados`); setSelected(new Set()); }
        else toast.error(r.error);
      })}>Quitar de compartidos</button>
  </BulkActionBar>
)}
```
> Confirmar la API real de `BulkActionBar` (`webapp/src/components/categorize/bulk-action-bar.tsx`) y adaptar props (`count`/`onClear`/children) a su firma.

- [ ] **Step 4: Bloque 3 → settle-up por persona**

Reemplazar el Bloque 3 actual (lista plana de grupos) por:
```tsx
{modo.is_shared && (() => {
  const people = settleUpByPerson(sharedGroups, transactions.map((t) => t.id));
  if (people.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="font-medium">Settle-up por persona</h2>
      {people.map((p) => (
        <div key={p.destinatarioId} className="flex items-center justify-between rounded-xl border border-white/6 bg-z-surface-2 px-3 py-2 text-sm">
          <span>{p.name}</span>
          <span className="flex items-center gap-3">
            <span className="tabular-nums text-muted-foreground">pendiente {formatCurrency(p.outstanding)}</span>
            {p.oldestActiveDebtId && p.outstanding > 0 && (
              <RecordRepaymentTrigger debtId={p.oldestActiveDebtId} />
            )}
          </span>
        </div>
      ))}
    </section>
  );
})()}
```
> ponytail: "Registrar abono" abre `record-repayment-dialog` sobre la deuda activa más antigua de la persona en el modo (FIFO), no reparte el abono entre varias deudas. `// ponytail: abono a la deuda más antigua; allocation multi-deuda si se pide`. `RecordRepaymentTrigger` = wrapper del `record-repayment-dialog` existente pasando `debtId`. Si el dialog ya expone un trigger reusable, usarlo directo.

- [ ] **Step 5: Ajustar el caller/tipo**

Asegurar que la page `/modos/[id]` pasa `sharedGroups`, `transactions` (ya lo hace) y que `ModoSummaryView` sigue recibiendo `modo` con los campos nuevos.

- [ ] **Step 6: Build gate + tests**

Run: `cd webapp && pnpm build && pnpm vitest run`
Expected: build verde, tests verdes.

- [ ] **Step 7: Commit**

```bash
git add webapp/src/components/modos/modo-summary-view.tsx webapp/src/app/\(dashboard\)/modos
git commit -m "feat(modos): resumen compartir todos + selección + settle-up"
```

---

## Task 8: Gates de verificación + review agents

**Files:** ninguno nuevo (revisión).

- [ ] **Step 1: Install + build + audit**

```bash
pnpm install            # desde repo root (lockfile)
cd webapp && pnpm build
pnpm audit --audit-level high
```
Expected: build limpio; audit sin high/critical (si hay, arreglar con overrides antes de PR).

- [ ] **Step 2: Review agents (gates del repo)**

Correr en foreground y aplicar fixes inline:
- `supabase-migrator` — migración + `modo_participants` (RLS, grants, índices, hand-add a `database.ts`).
- `server-action-reviewer` — `shareModoTransactions`/`unshareModoTransactions` + create/update (auth, defense-in-depth `user_id`, `updateTag` correcto, return types).
- `perf-auditor` — el batch no mete queries sin cache en render path; `getModoSummary` sigue en `Promise.all`.
- `zetas-front-guy` — tokens + reuso de `BulkActionBar`/`record-repayment-dialog` + variantes de botón en form-dialog y summary-view.

- [ ] **Step 3: Dry-merge contra main (antes de PR)**

```bash
git fetch origin main && git merge --no-commit --no-ff origin/main
# revisar conflictos; luego:
git merge --abort
```

- [ ] **Step 4: Commit final / abrir PR**

Crear PR desde `feat/modos` con resumen de la Fase 1 y nota de que Fase 2 (couples multi-usuario) es follow-up en BACKLOG.

---

## Self-Review (cobertura del spec)

- Modelo de datos (`is_shared`/`split_method`/`user_included` + `modo_participants`) → Task 1. ✔
- Refactor `splitExistingTransaction` → Task 3. ✔
- `shareModoTransactions`/`unshareModoTransactions` + persistir config → Task 4. ✔
- Settle-up por persona (solo pagos del modo) → Task 5 (util) + Task 7 (UI). ✔
- UI form (toggle + pickers + `createKind='person'`) → Task 6. ✔
- UI resumen (Compartir todos + selección + settle-up + abono) → Task 7. ✔
- Validación (`is_shared`/method/user_included/participants + refine) → Task 2. ✔
- No-goals Fase 1 (sin auto-share, sin 2º usuario, sin `amount` bulk) → respetados. ✔
- Gates + review agents → Task 8. ✔

**Backlog a registrar tras Fase 1:** Fase 2 (invitar usuario real → pool multi-usuario, RLS 2º usuario, publicación de entradas del pool, cifrado de entradas); allocation de abono multi-deuda por persona; diff fino de participantes; paralelizar batch si un modo escala a cientos de pagos.
