# Modo compartido — split de pagos en un modo (Fase 1: pool single-user)

**Fecha:** 2026-07-01
**Estado:** Diseño aprobado — listo para plan de implementación
**Antecesor:** Modos (PR #342), Pago compartido / split-ledger (PR en `claude/shared-payment-debt-duq182`, migración `20260630180000` en prod)

## Resumen

Un **modo** hoy es un filtro guardado (`tag_ids[]` OR + `date_from/date_to`) con un resumen de 4 bloques. Esta evolución convierte un modo en un **pool de gastos compartidos**: el usuario marca el modo como compartido, define contraparte(s) y ratio, y reparte en lote los pagos del modo entre él y esas personas (ej. dividir un viaje 50/50 con Estefa).

Fase 1 se construye sobre el **split-ledger existente de un solo usuario** (Estefa = destinatario tipo persona; cada pago repartido genera su `split_group_id` + N `personal_debts` direction `lent`). Fase 2 (invitar a Estefa como usuario real) es una extensión limpia del mismo modelo, no una reescritura.

## Restricción arquitectónica (fija, no negociable)

Las transacciones de cada usuario están cifradas por-usuario (envelope encryption). **Un segundo usuario no puede leer el ledger de otro** — es un non-goal documentado. Por eso el pago compartido actual es un split-ledger de un solo usuario, y por eso Fase 2 modela el pool como **objeto compartido separado**: solo las *entradas del pool* (monto + descripción + reparto + settle-up) cruzan el muro; el ledger privado de cada quien nunca. Este spec respeta esa restricción en ambas fases.

## Decisiones tomadas (con el usuario)

1. **Contraparte / pool** = objeto compartido. Fase 1 single-user (Estefa = destinatario). Fase 2 = usuario invitado real que ve solo el pool.
2. **Secuencia** = Fase 1 (bulk-split en el modo) ahora; couples/pool multi-usuario después.
3. **El modo ES el pool** (persistente): el modo gana flag `is_shared` + participantes + ratio por defecto. En Fase 2 ese mismo modo se convierte en pool multi-usuario (cero trabajo tirado).
4. **`split_method`** en bulk = solo `equal` | `percent` (`amount` no aplica a montos distintos por tx).
5. **Settle-up por persona en el resumen** agrega **solo** los pagos de este modo, no la deuda global con la persona.

## Alcance Fase 1

### Modelo de datos

**`modos` (columnas nuevas):**
- `is_shared boolean NOT NULL DEFAULT false` — el modo es un pool compartido.
- `split_method text NOT NULL DEFAULT 'equal'` — `'equal'` | `'percent'`. CHECK constraint.
- `user_included boolean NOT NULL DEFAULT true` — el usuario cuenta como participante del reparto.

**Nueva tabla `modo_participants` (plana, no `_enc` — sigue el patrón de `personal_debts`):**

| columna | tipo | notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `modo_id` | uuid FK → `modos(id)` ON DELETE CASCADE | |
| `user_id` | uuid | defense-in-depth + RLS |
| `destinatario_id` | uuid FK → `destinatarios(id)` | la persona (kind=`person`) |
| `share_value` | numeric NULL | peso/porcentaje cuando `split_method='percent'`; NULL en `equal` |
| `position` | int NOT NULL DEFAULT 0 | orden estable en la UI |
| `created_at` | timestamptz DEFAULT now() | |

- Unique `(modo_id, destinatario_id)`.
- RLS: `(select auth.uid()) = user_id` en SELECT/INSERT/UPDATE/DELETE (WITH CHECK en INSERT/UPDATE). Defense-in-depth `.eq("user_id", …)` en todas las queries.
- **Forward-compat Fase 2:** aquí se añadirán luego `member_user_id uuid NULL` (la cuenta real de la persona) + `invite_status text` (`pending`|`accepted`). No se crean ahora (YAGNI), pero la tabla ya es "miembros del pool".

La config de reparto de un modo = `{ method: split_method, userIncluded: user_included, participants: modo_participants[] }`, que mapea 1:1 al input de `computeSplit` (`@zeta/shared`). Ejemplo 50/50 con Estefa: `method='equal'`, `userIncluded=true`, 1 participante.

Regenerar `src/types/database.ts` **a mano** para estas columnas/tabla (nunca full-regen — mueve vistas cifradas a `Views` y rompe inserts; ver [[feedback_supabase_type_gen_breakage]]).

### Reuso / refactor (deuda dirigida)

`createSharedPayment` (`actions/shared-payments.ts`) tiene inline la lógica de repartir **una tx existente** (validar OUTFLOW / no ya repartida / no ligada a persona → `computeSplit` → tag `split_group_id` + insertar N `personal_debts` lent). Se extrae a un helper reutilizable **del lado webapp** (recibe el cliente Supabase; no va a `@zeta/shared`, que es framework-free — la regla pura de reparto ya vive ahí en `computeSplit`):

```
splitExistingTransaction(supabase, userId, tx, config) → { split_group_id, debt_ids } | { error }
```

- `config` = `{ method, userIncluded, participants:[{destinatario_id, value}], due_date?, description? }`.
- No aplica delta de saldo (la tx ya posteó su efectivo).
- Reusa `computeSplit`, `getCurrencyDecimals`, los mismos `SPLIT_ERROR_MESSAGES`.
- `createSharedPayment` modo `"existing"` pasa a llamar este helper; la acción batch también. Una sola regla de reparto.

Este es el único refactor de código existente; no se toca la lógica de saldo del modo `"new"` ni `deleteSharedPayment`/`recordRepayment`.

### Server actions (`actions/modos.ts`)

**`shareModoTransactions(modoId, txIds?)` → `ActionResult<{ shared: number; skipped: {id,reason}[]; failed: {id}[] }>`**
- Auth + carga el modo (defense-in-depth `user_id`) + sus `modo_participants`. Si `!is_shared` o sin participantes → error.
- Determina el conjunto de tx: si `txIds` viene, esas; si no, todos los OUTFLOW del filtro del modo (reusa `getModoTransactionIds`).
- Filtra elegibles: `direction='OUTFLOW'`, `split_group_id IS NULL`, `personal_debt_id IS NULL`. Los no elegibles → `skipped` con razón (`already_shared` | `inflow` | `linked_to_person`).
- Por cada elegible: `splitExistingTransaction(...)` con la config del modo. Acumula `shared` / `failed`.
- **Atomicidad:** por-tx, no todo-o-nada (cada `splitExistingTransaction` ya es consistente vía su cleanup compensatorio). Devuelve conteos; la UI muestra el resumen.
- Cache: `revalidateFinancialViews()` + `updateTag("personal-debts")` + `updateTag("modos")`.

**`unshareModoTransactions(modoId, txIds?)` → `ActionResult<{ unshared: number }>`**
- Para las tx del modo con `split_group_id`: reusa la lógica de `deleteSharedPayment` por grupo (borra deudas, des-taggea la tx, conserva la tx real). Mismos tags de cache.

**Create/update del modo** (extender las acciones existentes):
- Persistir `is_shared`, `split_method`, `user_included`.
- Sincronizar `modo_participants` (upsert/delete diff). Al crear personas nuevas desde el picker, `createKind='person'` en **todos** los paths de creación (footgun [[feedback_destinatario_kind_filter_vs_write]]).

### UI

**`modo-form-dialog.tsx`**
- Toggle "Compartir gastos de este modo" → revela:
  - Picker de contraparte(s): `DestinatarioZonePicker` con `kindFilter='person'` **y** `createKind='person'`.
  - Método: `equal` | `percent` (segmented).
  - `user_included` (checkbox "Incluirme en el reparto").
  - Si `percent`: input de % por participante; validación de suma vía `computeSplit` al guardar/repartir.

**`modo-summary-view.tsx`** cuando `modo.is_shared`:
- Botón primario **"Compartir todos"** → `shareModoTransactions(modoId)` → toast con conteos (`X repartidos, Y ya estaban, Z sin repartir`).
- Bloque 4 (lista de tx) gana checkboxes de selección → `BulkActionBar` (componente existente) con "Compartir seleccionados" (`shareModoTransactions(modoId, ids)`) y "Quitar de compartidos" (`unshareModoTransactions(modoId, ids)`).
- Bloque 3 pasa de lista plana de grupos a **"Settle-up por persona"**: por destinatario, Σ `outstanding` de los grupos cuyo origen cae en este modo (reusa `filterSharedGroupsByOrigin` + agregación por `destinatario_id`), con "Registrar abono" (reusa el flujo `recordRepayment`). Muestra "Tu parte" total del modo y "pendiente" por persona.

Nada en `/transactions` cambia; el round-trip "Ver en Movimientos" sigue igual y los pagos repartidos ya muestran su marca de pago compartido existente.

### Validación (`validators/modo.ts`)

Extender `modoSchema`:
- `is_shared: z.boolean().default(false)`.
- `split_method: z.enum(["equal","percent"]).default("equal")`.
- `user_included: z.boolean().default(true)`.
- `participants: z.array(z.object({ destinatario_id: uuidStr(...), value: z.number().optional() })).default([])`.
- Refine: si `is_shared` → `participants.length >= 1`. La validación de ratios (suma de %, exact-sum) la hace `computeSplit` al momento de repartir (no duplicar aquí).

### No-goals Fase 1
- Sin auto-repartir al importar/crear tx nuevas en el rango del modo (el usuario corre "Compartir todos" manualmente). Añadir si se pide.
- Sin segundo usuario / invitación / RLS cross-user.
- `split_method='amount'` no se soporta en bulk.
- El settle-up del modo no refleja la deuda global con la persona (solo pagos de este modo).

## Fase 2 (bosquejo — NO se construye en este spec)

Extensión, no reescritura:
- `modo_participants` += `member_user_id` + `invite_status`. Flujo de invitación por email → pending/accepted.
- **Publicación al pool:** al repartir, se escriben *entradas del pool* (monto + descripción + fecha + reparto + settle-up) en un store legible por `member_user_id` vía RLS de membresía — **nunca** la tx origen ni el ledger privado. Esto realiza el backlog `shared_pools`/`pool_members`/`pool_allocations` (el modo = pool, `modo_participants` = miembros).
- Settle-up bidireccional + notificaciones.
- **Decisión de cifrado de las entradas del pool** (plano-para-miembros vs por-clave-de-miembro) se define en el spec de Fase 2, no aquí.

## Gates de verificación
- `pnpm install` (si cambian deps) + `pnpm build` verde.
- `pnpm audit --audit-level high` limpio antes de PR.
- Agentes de review (gates del repo): `supabase-migrator` (migración + tabla nueva + RLS + grants + hand-add a `database.ts`), `server-action-reviewer` (las 2 acciones batch + create/update), `perf-auditor` (batch no mete queries sin cache en render path), `zetas-front-guy` (tokens en form-dialog + summary-view, reuso de `BulkActionBar`).
- Tests: extender `modo-summary.test.ts` (agregación settle-up por persona) + tests de `splitExistingTransaction` (elegibilidad + reparto equal/percent) + validador `modo.test.ts`.

## Archivos afectados (estimado)
- **Migración:** `supabase/migrations/<ts>_modo_compartido.sql` (columnas + tabla + RLS + grants).
- `webapp/src/types/database.ts` (hand-add).
- `webapp/src/actions/shared-payments.ts` (extraer `splitExistingTransaction`, webapp-side).
- `webapp/src/actions/modos.ts` (2 acciones batch + extender create/update).
- `webapp/src/lib/validators/modo.ts`.
- `webapp/src/lib/utils/modo-summary.ts` (agregación settle-up por persona).
- `webapp/src/components/modos/modo-form-dialog.tsx`, `modo-summary-view.tsx`.
- Tests correspondientes.
