# Creación participativa de presupuesto — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el paso de presupuesto pre-llenado (split parejo falso) por una creación participativa: el usuario elige qué categorías presupuestar, desglosa por líneas con calculadora, deriva montos de transacciones reales (categorizándolas), y opcionalmente usa un modo 50/30/20 por sets.

**Architecture:** Enfoque A — el `BudgetWizard` hace ingreso+estilo y enruta a `/presupuesto/armar` (`BudgetBuilder`), que se vuelve la superficie única de creación y edición. Se reusa `BudgetGroupLines` (ya tiene calculadora vía `CurrencyInput` y "−" quitar). Se agrega: arranque-vacío + selección de categorías, un sheet selector de transacciones que categoriza + rellena montos, y un modo `50_30_20` que agrupa categorías en 3 sets con caps informativos.

**Tech Stack:** Next.js 15 (App Router, Server Components/Actions), TypeScript strict, Tailwind v4 + shadcn/ui, Supabase (`@supabase/ssr`), Vitest. `@zeta/shared` para lógica compartida.

## Global Constraints

- UI en **español** (todas las strings de cara al usuario).
- Tokens de diseño únicamente: `text-z-*`, `bg-z-*`, `border-white/6`, etc. Sin colores hardcodeados. Botones: `BRASS_BUTTON_CLASS` / `GHOST_BUTTON_CLASS` / `BRASS_GHOST_BUTTON_CLASS` de `@/lib/constants/styles`.
- Server actions: auth con `getAuthenticatedClient()`, defensa en profundidad (`.eq("user_id", user.id)`), invalidación con `updateTag(...)` (no `revalidateTag`).
- **Gate de tipos con dev server vivo en :3000:** `pnpm -C webapp exec tsc --noEmit` (NUNCA `pnpm build` — corrompe el `.next` del dev).
- Tests de lógica pura: Vitest (`pnpm -C webapp exec vitest run <archivo>`). UI: gate de tipos + verificación manual.
- Gates de proyecto antes de PR: `zetas-front-guy` (UI), `server-action-reviewer` (acciones nuevas/modificadas).
- **Sin migración de DB:** `budget_mode` es columna `text` (`types/database.ts:1932` = `string | null`).
- DRY/YAGNI: reusar `BudgetBuilder`, `BudgetGroupLines`, `CurrencyInput`, `applyBudgetComposition`, `categorizeTransaction`. No duplicar UI.

## Señales y firmas existentes (verificadas)

- `types/domain.ts:145` — `export type BudgetMode = "per_category" | "zero_based";`
- `actions/budget.ts:25` — `setBudgetMode(mode: "per_category" | "zero_based"): Promise<ActionResult<null>>` (widen en P3) — escribe `profiles.budget_mode`, `updateTag("budgets")`+`updateTag("attention")`.
- `actions/budget.ts:45` — `bulkUpsertBudgets(budgets: { category_id: string; amount: number }[]): Promise<ActionResult<null>>`.
- `actions/budget.ts:76` — `updateEstimatedIncome(income)`.
- `actions/budget.ts:9` — `getBudgetMode(): Promise<ActionResult<string | null>>`.
- `actions/budgets.ts:155` — `applyBudgetComposition(input: BudgetCompositionInput): Promise<ActionResult<null>>` (input = `CompositionDiff`).
- `lib/utils/budget-rollup.ts:33` — `computeCompositionDiff(initial: Record<string,number>, draft: Record<string,number>): CompositionDiff` (`{ upserts: {category_id,amount}[]; deletes: string[] }`).
- `actions/categorize.ts:140` — `getUncategorizedTransactions()`; `:219` — `categorizeTransaction(...)` (leer firma exacta al implementar P2).
- `components/budget/budget-builder.tsx` — `BudgetBuilder({ groups: CategoryBudgetData[]; income: number; currency: CurrencyCode })`; estado `draft: Record<string,string>`, `setLine`, `removeLine`, `handleCreateSub`, `createdSubs`, `groupTotal`, `applyBudgetComposition` al guardar. Página: `app/(dashboard)/presupuesto/armar/page.tsx`.
- `components/budget/budget-group-lines.tsx` — `BudgetGroupLines({ group, currency, draft, onChange, onAddLine, onRemoveLine?, onCreateSub?, showSpend? })`.
- `components/budget/budget-wizard.tsx` — `BudgetWizard({ categories, estimatedIncome, currency, allocationData, onComplete })`; `StepIncome`, `StepStylePreview`+`StyleCard` (Paso 2), `StepAllocation`+`initAllocations` (Paso 3 — a eliminar), `handleFinalize` (`setBudgetMode`+`updateEstimatedIncome`+`bulkUpsertBudgets`).
- `components/plan/tabs/plan-tab-presupuesto.tsx:117` — renderiza `<BudgetWizard>` cuando `!budgetMode`.
- `components/recurring/link-picker-sheet.tsx:31` — `LinkPickerSheetProps` (patrón de sheet de selección con búsqueda + confirmación, referencia para el selector de tx).
- `@zeta/shared` — `categoryBudgetGroup(c)` mapea categoría → grupo de presupuesto; `isFixedBudgetCategory(slug)`.

---

## File Structure

**Fase 1**
- Modify: `webapp/src/components/budget/budget-wizard.tsx` — Paso 2 continúa → persiste modo+ingreso y enruta a `/presupuesto/armar`; eliminar `StepAllocation`+`initAllocations`; indicador a 2 pasos.
- Modify: `webapp/src/components/budget/budget-builder.tsx` — arranque vacío + selección de categorías ("+ Agregar categoría"); aceptar `mode`.
- (Sin cambios de datos en P1.)

**Fase 2**
- Create: `webapp/src/components/budget/budget-tx-picker-sheet.tsx` — sheet selector de transacciones (multi-select → categoriza + devuelve suma).
- Modify: `webapp/src/components/budget/budget-group-lines.tsx` — botón "Desde transacciones" por línea/categoría.
- Modify: `webapp/src/components/budget/budget-builder.tsx` — pasa contexto/handler del picker a las líneas.
- (Reusa `getUncategorizedTransactions`, `categorizeTransaction` — sin nuevas acciones salvo un helper de búsqueda si hace falta.)

**Fase 3**
- Modify: `webapp/src/types/domain.ts` — `BudgetMode` gana `"50_30_20"`.
- Modify: `webapp/src/actions/budget.ts` — `setBudgetMode` acepta `BudgetMode`.
- Create: `webapp/src/lib/utils/allocation-sets.ts` — helper puro `groupCategoriesByAllocationSet(...)` + caps por set.
- Create: `webapp/src/lib/utils/allocation-sets.test.ts` — Vitest del helper.
- Modify: `webapp/src/components/budget/budget-wizard.tsx` — tercera opción de estilo `50_30_20`.
- Modify: `webapp/src/components/budget/budget-builder.tsx` — render por sets cuando `mode==="50_30_20"` con caps informativos.
- Modify: cualquier `switch`/label de modo que asuma 2 valores (p.ej. `StylePreview`, `BudgetAjustesSheet`).

---

## FASE 1 — Routing wizard→builder + arranque vacío + selección de categorías

### Task 1.1: Eliminar el paso plano y enrutar al builder

**Files:**
- Modify: `webapp/src/components/budget/budget-wizard.tsx`

**Interfaces:**
- Produces: el wizard ya no asigna budgets; tras Paso 2 navega a `/presupuesto/armar` con `budget_mode` e ingreso persistidos.

- [ ] **Step 1: Quitar `initAllocations`, `allocations` state y `StepAllocation`.** Borrar `const [allocations, setAllocations] = useState<...>` (`budget-wizard.tsx:47`), la función `initAllocations` (`:52-94`), la rama `{step === 3 && <StepAllocation .../>}` del render, y la definición de `StepAllocation` (`:573-718`). Quitar imports que queden sin uso (`CheckCircle2`, `CurrencyInput`, `Loader2` si solo los usaba StepAllocation — verificar).

- [ ] **Step 2: Reemplazar `handleFinalize` por `handleStartBuilding`.**

```tsx
function handleStartBuilding() {
  if (!selectedMode) return;
  startTransition(async () => {
    await Promise.all([
      setBudgetMode(selectedMode),
      updateEstimatedIncome(income),
    ]);
    router.push("/presupuesto/armar");
  });
}
```

- [ ] **Step 3: Cambiar el flujo a 2 pasos.** Indicador `Paso {step} de 2`; `[1, 2].map(...)`. El botón "Continuar" del Paso 2 (`StepStylePreview` `onContinue`) ahora llama `handleStartBuilding` en vez de `handleGoToStep3`. Quitar `handleGoToStep3`.

- [ ] **Step 4: Gate de tipos.** Run: `pnpm -C webapp exec tsc --noEmit` → 0 errores. Quitar imports/vars sin uso que reporte el LSP.

- [ ] **Step 5: Commit.**

```bash
git add webapp/src/components/budget/budget-wizard.tsx
git commit -m "feat(budget): wizard routes to builder, drop flat allocate step"
```

### Task 1.2: Builder arranca vacío + selección de categorías

**Files:**
- Modify: `webapp/src/components/budget/budget-builder.tsx`

**Interfaces:**
- Consumes: `groups: CategoryBudgetData[]` (ya recibido), `draft` (ya existe).
- Produces: separación entre categorías "activas" (con monto en draft) y "disponibles" (selector "+ Agregar categoría").

- [ ] **Step 1: Derivar activas vs disponibles.** En `BudgetBuilder`, tras `sortedGroups`:

```tsx
const isActive = (g: CategoryBudgetData) =>
  (parseFloat(draft[g.id] ?? "") || 0) > 0 ||
  g.children.some((c) => draft[c.id] !== undefined);
const activeGroups = useMemo(() => sortedGroups.filter(isActive), [sortedGroups, draft]);
const availableGroups = useMemo(() => sortedGroups.filter((g) => !isActive(g)), [sortedGroups, draft]);
```

- [ ] **Step 2: Renderizar solo `activeGroups`** en el `.map` de secciones (cambiar `sortedGroups.map` → `activeGroups.map`). Mantener `openId` por defecto en la primera activa o `null`.

- [ ] **Step 3: Selector "+ Agregar categoría".** Debajo de la lista activa, render condicional cuando `availableGroups.length > 0`: chips por categoría disponible que al tocarse abren su sección (sembrar `setOpenId(g.id)` y opcional `setLine(g.id, "")` para activarla aunque sea en 0, o marcar activa al expandir). Usar tokens y patrón de chip existente (`border-dashed border-white/6`).

```tsx
{availableGroups.length > 0 && (
  <div className="space-y-2">
    <p className={SECTION_EYEBROW_CLASS}>Agregar categoría</p>
    <div className="flex flex-wrap gap-1.5">
      {availableGroups.map((g) => (
        <button key={g.id} type="button"
          onClick={() => { setLine(g.id, ""); setOpenId(g.id); }}
          className="flex items-center gap-1.5 rounded-full border border-dashed border-white/6 px-2.5 py-1 text-[11px] text-z-sage-light transition-colors active:bg-white/5">
          <span className="flex size-4 items-center justify-center rounded" style={{ backgroundColor: `color-mix(in srgb, ${g.color} 18%, transparent)`, color: g.color }}>
            <CategoryIcon icon={g.icon} className="size-2.5" />
          </span>
          {g.name_es ?? g.name}
        </button>
      ))}
    </div>
  </div>
)}
```
(Importar `SECTION_EYEBROW_CLASS` de `@/lib/constants/styles`.)

- [ ] **Step 4: Empty state del builder.** Si `activeGroups.length === 0`, sobre el selector mostrar copy honesto: "Aún no presupuestas nada. Agrega las categorías que te importan." (sin tarjetas vacías). Reusar `EmptyState` (`@/components/ui/empty-state`) o copy simple con tokens.

- [ ] **Step 5: Gate de tipos.** `pnpm -C webapp exec tsc --noEmit` → 0 errores.

- [ ] **Step 6: Verificación manual.** En cuenta sin presupuesto: `/plan?tab=presupuesto` → wizard → Paso 2 estilo → Continuar → `/presupuesto/armar` arranca vacío; "+ Agregar categoría" agrega secciones; desglose por líneas + calculadora + "−" funcionan; Guardar persiste. (Dev server vivo; recarga.)

- [ ] **Step 7: Commit.**

```bash
git add webapp/src/components/budget/budget-builder.tsx
git commit -m "feat(budget): builder starts empty with category selection"
```

---

## FASE 2 — Selector de transacciones (categoriza + rellena monto)

### Task 2.1: Sheet selector de transacciones

**Files:**
- Create: `webapp/src/components/budget/budget-tx-picker-sheet.tsx`
- Test: `webapp/src/components/budget/budget-tx-picker.test.ts` (lógica pura de suma)

**Interfaces:**
- Consumes: `getUncategorizedTransactions()` (`actions/categorize.ts:140`), `categorizeTransaction(...)` (`:219` — leer firma exacta al implementar).
- Produces:

```tsx
export interface BudgetTxPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Categoría/subcategoría destino a la que se asignarán las tx elegidas. */
  targetCategoryId: string;
  targetCategoryName: string;
  currency: CurrencyCode;
  /** Devuelve la suma de las tx elegidas (ya categorizadas) para rellenar el monto. */
  onConfirm: (sum: number) => void;
}
export function sumSelectedTx(txs: { id: string; amount: number }[], selected: Set<string>): number;
```

- [ ] **Step 1: Test de `sumSelectedTx` (falla).**

```ts
// budget-tx-picker.test.ts
import { describe, it, expect } from "vitest";
import { sumSelectedTx } from "./budget-tx-picker-sheet";
describe("sumSelectedTx", () => {
  it("suma solo las seleccionadas", () => {
    const txs = [{ id: "a", amount: 100 }, { id: "b", amount: 50 }, { id: "c", amount: 30 }];
    expect(sumSelectedTx(txs, new Set(["a", "c"]))).toBe(130);
  });
  it("0 si nada seleccionado", () => {
    expect(sumSelectedTx([{ id: "a", amount: 100 }], new Set())).toBe(0);
  });
});
```

- [ ] **Step 2: Run test → FAIL** (`Cannot find module`/`sumSelectedTx is not a function`). `pnpm -C webapp exec vitest run src/components/budget/budget-tx-picker.test.ts`.

- [ ] **Step 3: Implementar el sheet + `sumSelectedTx`.** `"use client"`. Estructura tipo `LinkPickerSheet` (Drawer/Sheet móvil): título "Desde transacciones · {targetCategoryName}", buscador, lista de `getUncategorizedTransactions()` (cargar al abrir), cada fila checkbox + comercio + fecha + `formatCurrency(amount)`, footer con "Asignar N · {formatCurrency(sum)}". `sumSelectedTx` es la función pura exportada. Tokens + español. Al confirmar (Step 4).

- [ ] **Step 4: Run test → PASS.** `pnpm -C webapp exec vitest run src/components/budget/budget-tx-picker.test.ts`.

- [ ] **Step 5: Confirmar = categorizar + devolver suma.** En el handler de confirmación: por cada tx seleccionada `await categorizeTransaction(<args con targetCategoryId>)` (leer firma exacta), con `Promise.all`; luego `onConfirm(sumSelectedTx(...))` y `onOpenChange(false)`. Manejar error con `toast.error`. Tras categorizar, las vistas se invalidan vía la propia acción (`updateTag`).

- [ ] **Step 6: Estado vacío.** Si `getUncategorizedTransactions()` devuelve `[]`, mostrar "No hay movimientos sin categorizar" + (opcional) toggle "ver todas". (El botón disparador se oculta cuando no hay tx — Task 2.2 Step 3.)

- [ ] **Step 7: Gate de tipos.** `pnpm -C webapp exec tsc --noEmit` → 0 errores.

- [ ] **Step 8: Commit.**

```bash
git add webapp/src/components/budget/budget-tx-picker-sheet.tsx webapp/src/components/budget/budget-tx-picker.test.ts
git commit -m "feat(budget): transaction picker sheet (categorize + sum)"
```

### Task 2.2: Botón "Desde transacciones" en las líneas

**Files:**
- Modify: `webapp/src/components/budget/budget-group-lines.tsx`
- Modify: `webapp/src/components/budget/budget-builder.tsx`

**Interfaces:**
- Consumes: `BudgetTxPickerSheetProps`, `BudgetGroupLines`.
- Produces: nuevo prop opcional en `BudgetGroupLines`:

```tsx
/** Abre el selector de transacciones para una categoría/subcategoría destino. */
onPickFromTransactions?: (categoryId: string, categoryName: string) => void;
/** Hay transacciones sin categorizar disponibles (si false, no se ofrece). */
hasUncategorized?: boolean;
```

- [ ] **Step 1: Agregar el botón en `BudgetGroupLines`.** Junto a "Otra línea…", cuando `onPickFromTransactions && hasUncategorized`, un chip "Desde transacciones" que llama `onPickFromTransactions(group.id, group.name_es ?? group.name)` (y por línea hija, con el id/nombre de la hija). Tokens + ícono (`ListPlus`/`Search` de lucide).

- [ ] **Step 2: Cablear en `BudgetBuilder`.** Estado: `const [picker, setPicker] = useState<{ id: string; name: string } | null>(null);`. Pasar `onPickFromTransactions={(id, name) => setPicker({ id, name })}` y `hasUncategorized={hasUncategorized}` a `BudgetGroupLines`. Renderizar `<BudgetTxPickerSheet open={!!picker} ... onConfirm={(sum) => { if (picker) setLine(picker.id, String(sum)); setPicker(null); }} />`.

- [ ] **Step 3: `hasUncategorized` desde el servidor.** En `app/(dashboard)/presupuesto/armar/page.tsx`, además de `groups`, obtener si hay tx sin categorizar (`getUncategorizedTransactions()` → `.length > 0`) y pasarlo a `BudgetBuilder` como `hasUncategorized`. Si es `false`, el botón no se ofrece.

- [ ] **Step 4: Gate de tipos.** `pnpm -C webapp exec tsc --noEmit` → 0 errores.

- [ ] **Step 5: Verificación manual.** Con tx sin categorizar: en una categoría → "Desde transacciones" → seleccionar varias → "Asignar" → el monto de la categoría se rellena con la suma y esas tx quedan categorizadas (verificar en /categorizar o /transactions). Sin tx sin categorizar: el botón no aparece.

- [ ] **Step 6: Commit.**

```bash
git add webapp/src/components/budget/budget-group-lines.tsx webapp/src/components/budget/budget-builder.tsx "webapp/src/app/(dashboard)/presupuesto/armar/page.tsx"
git commit -m "feat(budget): derive category amount from transactions (and categorize them)"
```

---

## FASE 3 — Modo 50/30/20 por sets

### Task 3.1: Tipo `BudgetMode` + `setBudgetMode`

**Files:**
- Modify: `webapp/src/types/domain.ts:145`
- Modify: `webapp/src/actions/budget.ts:25`

**Interfaces:**
- Produces: `BudgetMode = "per_category" | "zero_based" | "50_30_20"`.

- [ ] **Step 1: Widen el tipo.** `export type BudgetMode = "per_category" | "zero_based" | "50_30_20";`

- [ ] **Step 2: `setBudgetMode` acepta `BudgetMode`.** Cambiar la firma `mode: "per_category" | "zero_based"` → `mode: BudgetMode` (importar el tipo). Sin migración (columna `text`).

- [ ] **Step 3: Gate de tipos** — esto revelará todos los `switch (mode)` que asumen 2 valores. `pnpm -C webapp exec tsc --noEmit`. Anotar los sitios que fallen por exhaustividad y arreglarlos en Task 3.3.

- [ ] **Step 4: Commit.**

```bash
git add webapp/src/types/domain.ts webapp/src/actions/budget.ts
git commit -m "feat(budget): add 50_30_20 to BudgetMode"
```

### Task 3.2: Helper de sets 50/30/20 (lógica pura + test)

**Files:**
- Create: `webapp/src/lib/utils/allocation-sets.ts`
- Test: `webapp/src/lib/utils/allocation-sets.test.ts`

**Interfaces:**
- Consumes: `categoryBudgetGroup` (`@zeta/shared`), `CategoryBudgetData`.
- Produces:

```ts
export type AllocationSet = "needs" | "wants" | "savings";
export interface AllocationSetGroup {
  set: AllocationSet;
  label: string;      // "Necesidades" | "Deseos" | "Ahorro/Deuda"
  cap: number;        // income * (0.5 | 0.3 | 0.2)
  groups: CategoryBudgetData[];
}
export function groupCategoriesByAllocationSet(
  groups: CategoryBudgetData[],
  income: number,
): AllocationSetGroup[];
```

- [ ] **Step 1: Test (falla).** Tres categorías mapeadas a sets distintos vía `categoryBudgetGroup`; income 1.000.000; esperar caps 500k/300k/200k y la asignación correcta de cada grupo a su set. `pnpm -C webapp exec vitest run src/lib/utils/allocation-sets.test.ts` → FAIL.

- [ ] **Step 2: Implementar el helper** mapeando cada `group` a un `AllocationSet` con `categoryBudgetGroup(group)` (mapear su resultado a needs/wants/savings; fijar el mapeo según los grupos que devuelva — leer `@zeta/shared`), caps = `income * {0.5,0.3,0.2}`.

- [ ] **Step 3: Run test → PASS.**

- [ ] **Step 4: Commit.**

```bash
git add webapp/src/lib/utils/allocation-sets.ts webapp/src/lib/utils/allocation-sets.test.ts
git commit -m "feat(budget): 50/30/20 allocation-set grouping helper"
```

### Task 3.3: Estilo 50/30/20 en el wizard + render por sets en el builder

**Files:**
- Modify: `webapp/src/components/budget/budget-wizard.tsx` (Paso 2: `StepStylePreview`/`StyleCard`, `StylePreview`)
- Modify: `webapp/src/components/budget/budget-builder.tsx`
- Modify: sitios con `switch (mode)`/labels de modo detectados en Task 3.1 Step 3.

- [ ] **Step 1: Tercera `StyleCard`** en `StepStylePreview`: `mode="50_30_20"`, título "50/30/20", descripción "Reparte por sets: 50% necesidades, 30% deseos, 20% ahorro y deuda.", ícono adecuado, `selected`/`onSelect`. Manejar `50_30_20` en `StylePreview`.

- [ ] **Step 2: Render por sets en `BudgetBuilder`.** Aceptar prop `mode: BudgetMode`. Cuando `mode === "50_30_20"` y `income > 0`: agrupar con `groupCategoriesByAllocationSet(groups, income)` y renderizar cada set como encabezado (label + barra "asignado vs cap", **avisa si se pasa, no bloquea**), con las categorías activas del set dentro (mismo render de secciones). En otros modos, lista plana como hoy. Pasar `mode` desde `app/(dashboard)/presupuesto/armar/page.tsx` (obtener de `getBudgetMode()`), y desde el wizard ya queda en `budget_mode`.

- [ ] **Step 3: Caps informativos.** Por set: `assigned = Σ groupTotal(g in set)`; barra brass/`z-debt` si `assigned > cap`; texto "asignado vs cap" (sin bloquear el guardar).

- [ ] **Step 4: Resolver los `switch (mode)`/labels** que el tsc marcó en Task 3.1 (etiqueta de modo en `BudgetAjustesSheet`, cualquier `mode === "per_category" ? ... : ...` binario). Agregar el caso `50_30_20`.

- [ ] **Step 5: Gate de tipos.** `pnpm -C webapp exec tsc --noEmit` → 0 errores.

- [ ] **Step 6: Verificación manual.** Wizard → estilo "50/30/20" → builder agrupa por 3 sets con caps; asignar de más solo avisa; guardar persiste `budget_mode="50_30_20"`. Sin ingreso: sin caps (solo agrupación) + nudge.

- [ ] **Step 7: Commit.**

```bash
git add -A
git commit -m "feat(budget): 50/30/20 set mode in wizard + builder"
```

---

## Cierre (tras P1–P3)

- [ ] Gates de proyecto: spawn `zetas-front-guy` (UI nueva: builder selección de categorías, tx-picker, sets) y `server-action-reviewer` (si se tocó alguna acción). Aplicar findings.
- [ ] Gate final de tipos: `pnpm -C webapp exec tsc --noEmit` (NO `pnpm build` con dev vivo).
- [ ] Branch/PR: definir branch dedicada para presupuesto (separada de la guided-experience) antes de commitear/abrir PR — el usuario commitea cuando lo pida.

## Self-Review (hecho)

1. **Cobertura del spec:** §1 routing → T1.1; §2 builder participativo (arranque vacío + selección) → T1.2; §3 selector de transacciones → T2.1/T2.2; §4 modo 50/30/20 → T3.1–3.3; §5 datos/persistencia (sin migración, `BudgetMode`, `applyBudgetComposition`, `categorizeTransaction`) → cubierto; §6 estados honestidad (sin ingreso/sin tx) → T1.2 Step 4, T2.2 Step 3, T3.3 Step 6. Decisiones (a) cap avisa-no-bloquea → T3.3 Step 3; (b) tx categoriza → T2.1 Step 5.
2. **Placeholders:** las firmas exactas de `categorizeTransaction`/`getUncategorizedTransactions` se leen al implementar P2 (referencias reales a `actions/categorize.ts:140/:219`, no placeholders); el resto tiene firmas verificadas.
3. **Consistencia de tipos:** `BudgetMode` (T3.1) usado consistentemente; `sumSelectedTx`/`BudgetTxPickerSheetProps` (T2.1) consumidos en T2.2; `groupCategoriesByAllocationSet`/`AllocationSetGroup` (T3.2) consumidos en T3.3; `onPickFromTransactions`/`onRemoveLine` consistentes en `BudgetGroupLines`.
