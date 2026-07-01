# Modos — Filtro guardado + resumen

**Fecha:** 2026-07-01
**Estado:** Diseño aprobado, listo para plan de implementación
**Alcance:** Opción 2 (Modo = filtro guardado + resumen). Opción 3 (entidad activable con auto-etiquetado) queda anotada como futuro, no se construye.

## Problema

El filtro de transacciones solo permite un tag a la vez (`tagId`). Para un viaje con gastos compartidos (ej. Cartagena con Estefa) se etiquetaron varias transacciones con tags relacionados, pero no hay forma de extraerlas todas juntas ni de ver un resumen del viaje.

## Solución

Un **Modo** es un filtro `(tags[], rango de fechas)` guardado con nombre, más una vista de resumen. No es una entidad que "se activa"; es una consulta guardada que se deriva en tiempo de query. Nada de auto-etiquetado ni denormalización por transacción.

Como subproducto, el filtro de transacciones existente pasa de un tag a multi-tag (OR), lo que resuelve el dolor inmediato aunque nunca se cree un Modo.

## Modelo de datos

Tabla nueva `modos`:

| columna      | tipo        | notas                                              |
|--------------|-------------|----------------------------------------------------|
| `id`         | uuid pk     |                                                    |
| `user_id`    | uuid        | RLS: `(select auth.uid()) = user_id`               |
| `name`       | text        | no nulo                                            |
| `color`      | text        | nullable, para la tarjeta                          |
| `emoji`      | text        | nullable                                           |
| `date_from`  | date        | no nulo (requerido para membresía)                 |
| `date_to`    | date        | no nulo (requerido para membresía)                 |
| `tag_ids`    | uuid[]      | set OR; ids sobrantes (tag borrado) se ignoran     |
| `created_at` | timestamptz | default now()                                      |

`tag_ids` es **columna array**, no tabla junction — es un set de solo lectura para filtrar; si se borra un tag, el id sobrante simplemente no matchea. Cero joins de mantenimiento.

RLS habilitado. Defense-in-depth: toda query filtra por `.eq("user_id", user.id)` además de RLS.

### Regla de membresía (derivada, nunca guardada por transacción)

> Una transacción pertenece al Modo si
> `transaction_date` ∈ [`date_from`, `date_to`] **Y** tiene al menos uno de `tag_ids` (semántica OR).

## Núcleo — una sola fuente de verdad

`getModoTransactionIds(modo)` devuelve los tx ids que cumplen la membresía. **Todos** los bloques del resumen se construyen sobre ese set con `.in("id", txIds)`. Esto mantiene la lógica de membresía en un solo lugar y reusa las agregaciones existentes.

Implementación: pre-fetch de `transaction_tags` con `.in("tag_id", tag_ids)` → dedupe de `transaction_id`, luego query de `transactions` con `.in("id", ids)` + `.gte/.lte("transaction_date", ...)`.

## Server actions — `src/actions/modos.ts`

- `createModo`, `updateModo`, `deleteModo`, `listModos`, `getModo(id)` — CRUD estándar, patrón `getAuthenticatedClient()`, revalidación de tags de caché.
- `getModoSummary(id)` → corre la membresía y arma:
  - **Total + conteo + rango real**: suma de gasto, número de tx, fechas mín/máx observadas.
  - **Por categoría**: desglose de gasto por categoría (reusa el patrón de agregación existente, scoped a txIds).
  - **Pagos compartidos / por persona**: reusa la lógica de `shared-payments` / deudas personales, filtrada a los txIds — cuánto fue compartido, cuánto te deben / debes.
  - **Lista de transacciones**: las tx del Modo con acceso al detalle.

## Filtro multi-tag (subproducto)

- Validador: `tagId` → `tagIds: string[]` (opcional).
- `src/actions/transactions.ts:456`: el pre-fetch cambia de `.eq("tag_id", tagId)` a `.in("tag_id", tagIds)` con dedupe de `transaction_id` (semántica OR).
- `src/components/transactions/transaction-filters.tsx`: el selector de tag pasa a multi-select.
- Este mismo filtro alimenta el **preview de conteo en vivo** al crear/editar un Modo.

## UI

- **`/modos`** — grid de tarjetas (nombre, color/emoji, rango, total gastado). Sigue el patrón de layout de `/deudas`.
- **`/modos/[id]`** — vista de resumen con los 4 bloques.
- **Diálogo crear/editar** — nombre, color, emoji opcional, date-range picker, multi-select de tags (reusa el tag picker existente), preview del conteo en vivo mientras se ajustan tags/fechas.
- **Entradas**: link en el nav shell + botón "Guardar como Modo" desde el filtro de transacciones (pre-llena tags + rango con el filtro actual).

## Boundaries / reuse

- Membresía en una sola función (`getModoTransactionIds`). Los bloques nunca reimplementan el criterio.
- Category breakdown y shared breakdown reusan helpers existentes, scoped por `.in("id", txIds)`.
- El filtro multi-tag y el preview del Modo comparten la misma semántica OR.

## Testing

- Self-check de la regla de membresía: dado un set de tx con tags y fechas conocidas, `getModoTransactionIds` devuelve exactamente las que están en rango Y tienen algún tag. Casos borde: tx en rango sin tag (excluida), tx con tag fuera de rango (excluida), tag_id apuntando a tag borrado (ignorado sin romper).
- Verificación de auth/RLS: todas las actions filtran por user_id.

## Futuro (Opción 3 — anotado, no se construye)

- `is_active` + ventana de activación en el tiempo.
- Auto-tag de transacciones creadas mientras el Modo está activo.
- Banner global de "modo activo".
- Scoping del dashboard al modo activo.
