# Handoff — Feature "Modos" (retomar en Claude Code)

**Fecha:** 2026-07-01
**Branch:** `feat/modos` (repo `/Users/cristian/Documents/developing/current-projects/zeta`)
**Modo de ejecución:** inline (executing-plans), NO subagentes.

## Qué es esto

Feature "Modos": agrupar transacciones de un viaje/evento en un filtro guardado (`tags[] + rango de fechas`) con nombre + una vista de resumen. Subproducto: el filtro de transacciones pasa de 1 tag a multi-tag (OR).

- **Spec:** `docs/superpowers/specs/2026-07-01-modos-saved-filter-summary-design.md`
- **Plan (8 tasks, léelo, es la fuente de verdad):** `docs/superpowers/plans/2026-07-01-modos-saved-filter-summary.md`

Decisiones ya tomadas con el usuario: alcance = opción 2 (filtro guardado + resumen); membresía = tags **Y** rango de fechas; tags entre sí = **OR**; resumen = 4 bloques (total+conteo, por categoría, pagos compartidos/persona, lista de transacciones). Opción 3 (modo activable + auto-tag) queda como futuro, NO se construye.

## Estado actual

Commits en `feat/modos`:
- `037421e4` — docs: spec
- `eb74bc6c` — docs: plan

**T1 (migración) a medias:**
- ✅ Archivo creado: `supabase/migrations/20260701171617_create_modos.sql` (tabla `modos` + RLS + índice). NO commiteado aún.
- ❌ `npx supabase db push` — **bloqueado por el classifier de auto-mode** (lo leyó como deploy a producción). En Claude Code lo apruebas en el prompt de permiso y listo.
- ❌ `gen types` pendiente.

## Próximos pasos exactos (retomar aquí)

1. **Aplicar migración** (desde raíz `zeta/`):
   ```bash
   npx supabase db push
   ```
2. **Regenerar tipos** (desde `webapp/`; ojo con el warning `compdef` que puede filtrarse a la 1ª línea):
   ```bash
   cd webapp && npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu > src/types/database.ts
   ```
   Verificar que `src/types/database.ts` contenga `modos:` y que el header `export type Json =` quede intacto.
3. **Build gate:** `cd webapp && pnpm build` → PASS.
4. **Commit T1:**
   ```bash
   git add supabase/migrations/20260701171617_create_modos.sql webapp/src/types/database.ts
   git commit -m "feat(modos): migración tabla modos + RLS"
   ```
5. **Seguir T2 → T8** tal cual el plan. Cada task tiene TDD con código y comandos concretos.

## Notas del entorno (importantes)

- La carpeta `supabase/` está en la **raíz** del repo (`zeta/`), NO en `webapp/`. El plan dice `webapp/supabase/...` en algunos paths — el real es `zeta/supabase/...`.
- Tests: **Vitest**. Correr con `pnpm vitest run <path>` desde `webapp/`.
- Actions: `getAuthenticatedClient()` de `@/lib/supabase/auth` devuelve `{ supabase, user, accessToken }`. Lecturas cacheadas con `createCachedClient(accessToken)` + `"use cache"` + `cacheTag(...)` + `cacheLife("zeta")`. Mutaciones invalidan con `updateTag(...)` (importado como `expireTag`).
- Zod errors: `.issues[0].message`.
- Filtro de transacciones usa URL searchParams; el plan cambia el param `tagId` → `tags` (CSV de uuids, OR). Ref: `src/actions/transactions.ts` (~línea 444-467, 543) y `src/components/transactions/transaction-filters.tsx` (~línea 196-208).
- Reuso para el bloque de pagos compartidos: `getSharedPaymentGroups()` de `src/actions/shared-payments.ts`, filtrado por `origin_transaction_id ∈ txIds`.

## Verificación final (cuando terminen las 8 tasks)

- `cd webapp && pnpm vitest run` → todo verde.
- `cd webapp && pnpm build` → limpio.
- Prueba manual: crear Modo con los tags de Cartagena + rango de julio → `/modos/[id]` muestra total, por categoría, el pago compartido con Estefa, y la lista.
- Luego: skill `superpowers:finishing-a-development-branch`.
