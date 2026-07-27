# Coherencia visual en móvil — canon de patrones y aplicación por olas

**Fecha:** 2026-07-27
**Alcance:** webapp, viewport móvil
**Estado:** diseño aprobado, pendiente de plan de implementación

---

## 1. Problema

La app resuelve el mismo problema visual de formas distintas en cada pantalla. Tres
observaciones del usuario, todas en móvil:

1. La lista de cuentas usa tarjetas de ~350px por cuenta; la pestaña de deudas usa filas
   de ~80px con más información útil. La forma de tarjeta "no es muy diciente para la
   información general y no está bien para mobile".
2. Crear un movimiento y ver un movimiento "se sienten desconectadas".
3. Los préstamos saldados siguen apareciendo en la lista, y archivarlos exige entrar a
   la cuenta, abrir un menú de overflow y confirmar — cinco pasos por obligación.

La causa raíz es la misma: no hay patrones canónicos. Cada pantalla inventó los suyos, y
el árbol `src/components/mobile/v2/` evolucionó en paralelo a los componentes de
escritorio sin primitivas compartidas.

### Evidencia medida

**Densidad de lista** — `AccountCard` (`src/components/accounts/account-card.tsx`, 214
líneas) ocupa ~350px y muestra: nombre, banco, máscara, saldo, moneda, badge de
utilización, cupo total, disponible. La fila de `deudas-cuentas-lens.tsx:501` ocupa ~80px
y muestra: nombre, medidor de uso con porcentaje, cuota, tasa EA, saldo — y expande a una
grilla de detalle con acciones. Más información en menos de un cuarto del espacio.

**Los mismos campos, tres renderizados** — comparando `/transactions/new`
(`mobile-transaction-form.tsx`) con `/transactions/[id]`
(`transaction-detail-client.tsx`):

| | Creación | Detalle | Drawer "Editar datos" |
|---|---|---|---|
| Etiqueta | `<Label>` sentence case | `text-sm text-muted-foreground` | `text-[10px] uppercase tracking-[0.18em]` |
| Layout | etiqueta arriba, control abajo | etiqueta izq., valor der. | etiqueta arriba, control abajo |
| Monto | display grande, primero | hero, primero | dentro del drawer |
| Fecha / Hora | en sección "Detalles" | ausente de la página | única vía de edición |
| Agrupación | Detalles · Asignar · Más opciones | Clasificación · Acciones · Recurrente · Pago compartido · Ubicación · Notas | — |

Cambiar el monto de un movimiento lleva a un tercer chrome que no se parece ni a donde se
creó ni a donde se estaba viendo.

**Archivado enterrado** — `archiveDebtObligation` (`src/actions/accounts.ts:295`) hace lo
correcto: pone saldo en 0, marca `is_active: false` y desactiva las plantillas recurrentes
asociadas vía `deactivateTemplatesForPaidOffAccount`. Pero solo se dispara desde el menú
`···` de `QuickActionsBar` en `/accounts/[id]`. Nada observa `current_balance === 0` para
sugerirlo. El hueco es de descubrimiento, no de capacidad.

---

## 2. Decisiones

| Decisión | Elección | Motivo |
|---|---|---|
| Alcance | Un spec de canon + aplicación por olas | Las tres quejas son síntomas del mismo problema; arreglarlas por separado deja que sigan divergiendo |
| Viewports | Móvil primero; escritorio documentado como deuda | Es donde están los dolores reportados; ~1/3 del trabajo |
| Crear vs ver | Vistas separadas con el mismo lenguaje visual | Menos invasivo que fusionarlas; el detalle tiene lógica pesada que no conviene tocar |
| Fila → detalle | Toda la fila expande; la navegación es una acción explícita dentro de la expansión | Un solo blanco táctil en la fila colapsada; evita el problema de dos destinos compitiendo |
| Cumplimiento del canon | Primitivas donde duele, documento para el resto | Un design system completo no se pidió; dos primitivas se cobran solas |

---

## 3. El canon

Tres reglas, aplicables a móvil:

1. **Una lista de entidades es una lista de filas, nunca una grilla de tarjetas.** La
   tarjeta se justifica solo cuando es la única entidad en pantalla, como el hero de
   `/accounts/[id]`.
2. **Tocar la fila expande in situ.** Navegar es una acción explícita dentro de la
   expansión, nunca un segundo blanco táctil en la fila colapsada.
3. **Crear y ver la misma entidad comparten orden de secciones y componentes de campo.**
   Si el detalle muestra Monto → Cuenta → Fecha → Categoría → Destinatario, la creación
   pide lo mismo en ese orden.

Las primitivas viven en `src/components/ui/`, no en `mobile/v2/`. Ese árbol separado es
cómo empezó la divergencia; escritorio tiene que poder consumirlas cuando llegue su ola.

---

## 4. Primitivas

### 4.1 `<EntityRow>`

```tsx
// src/components/ui/entity-row.tsx
export interface EntityRowProps {
  /** BankBadge, AccountIcon, PersonAvatar — la pantalla decide. */
  leading: React.ReactNode;
  title: string;
  /** Barra de tics. Omitir en entidades sin progreso (ahorro, corriente). */
  gauge?: { pct: number; label: string; tone: "brass" | "alert" | "income" };
  /** Partes unidas por " · ": ["cuota $ 159.477", "10.3% EA", "faltan 8 meses"]. */
  meta?: string[];
  trailing: { value: string; caption?: string; tone?: "debt" | "income" | "neutral" };
  /** Contenido de la expansión: grilla de DetailCell + acciones. */
  children?: React.ReactNode;
  /** Estado abierto controlado, para deep-links y "expandir saldadas". */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}
```

Todo lo opcional es lo que varía entre consumidores. Una cuenta de ahorro pasa
`leading + title + trailing` y nada más.

**La primitiva no hace fetching y no define acciones.** Las acciones van en `children`,
decididas por cada pantalla. Es lo que permite que `/accounts` ponga `Archivar (pagada)`
donde `/deudas` pone `Abonar`, sin que la primitiva sepa qué es una obligación.

Deriva de `AccountRow` en `deudas-cuentas-lens.tsx:501`, que hoy está tipada contra
`DebtAccount` (cuota, tasa, cupo). Generalizarla es el grueso del trabajo de la ola 0.

### 4.2 `<FormShell>`, `<FieldSection>`, `<Field>`

```tsx
// Cascarón: header + cuerpo scrolleable + CTA fija abajo.
// Lo usan la página de creación y los drawers de edición: mismo esqueleto,
// distinto contenedor.
<FormShell title="Nueva transacción" onBack={...} submit={{ label: "Registrar gasto", pending }}>

// Una sola implementación del eyebrow de sección. Hoy hay dos.
<FieldSection eyebrow="Detalles">

// Un solo estilo de etiqueta. `layout` decide la disposición, no la tipografía.
<Field label="Cuenta" layout="stacked" | "row">
```

`layout="row"` (etiqueta izquierda, valor derecha, tap para editar) es el modo de lectura
del detalle. `layout="stacked"` es el modo de captura. **Misma tipografía de etiqueta en
ambos** — es el cambio que hace que las dos pantallas se reconozcan entre sí.

### 4.3 Orden canónico de campos de transacción

Idéntico en creación y detalle:

```
Monto · Tipo                                    ← hero, siempre primero
Detalles:   Descripción · Cuenta · Fecha · Hora · Categoría
Asignar:    Destinatario · Etiquetas
Extras:     Suscripción · Recurrente · Notas
```

El detalle añade después sus bloques propios —Acciones, Recurrente vinculada, Pago
compartido, Ubicación— que no tienen equivalente en creación y conservan su posición
actual.

---

## 5. Olas de aplicación

Cada ola es entregable por separado y tiene su propio criterio de aceptación. **No son un
solo plan de implementación**: las olas 0 y 1 forman el primer plan; las olas 2, 3 y 4
reciben el suyo cuando la anterior esté verificada.

### Ola 0 — Primitivas, sin consumidores

Crear `<EntityRow>`, `<FormShell>`, `<FieldSection>` y `<Field>` en `src/components/ui/`,
cada una con su `.stories.tsx`. Ningún cambio visible en la app.

**Criterio de aceptación:** Storybook renderiza las tres formas de `<EntityRow>` (ahorro,
tarjeta, préstamo) y los dos `layout` de `<Field>`. `pnpm build:web` limpio, `vitest` en
verde.

Es la ola reversible sin costo si la abstracción no convence.

### Ola 1 — `/accounts`

Sustituir `AccountCard` por `<EntityRow>` en `accounts-section.tsx` y en
`src/app/(dashboard)/accounts/page.tsx`. Tres formas:

- **Ahorro / corriente**: sin medidor. `trailing` = saldo, tono neutro. `meta` = ["sin
  actualizar 20d"] cuando aplique.
- **Tarjeta de crédito**: medidor = uso (`balance / credit_limit`), tono `alert` a partir
  de 75%. `trailing` = saldo, tono `debt`. `meta` = cuota, tasa.
- **Préstamo**: medidor = pagado, tono `income`. `trailing` = saldo. `meta` = cuota, tasa,
  meses restantes.

La expansión contiene la grilla de `DetailCell` y, como acción explícita, **Ver detalle →**
hacia `/accounts/[id]`, que conserva hero, gráfico de saldo, movimientos y extractos.

**Archivado de obligaciones saldadas**, en esta misma ola:

- En la expansión, si la entidad es obligación (`CREDIT_CARD` o `LOAN`) y
  `current_balance === 0`, la acción primaria pasa de `Abonar` a **`Archivar (pagada)`**,
  reutilizando el diálogo de confirmación existente y la acción `archiveDebtObligation`.
- Nueva señal de atención. `AttentionPage` hoy es
  `"transactions" | "categories" | "destinatarios" | "recurrentes" | "pendientes"`; añadir
  `"cuentas"`. La señal emite `key: "obligaciones-saldadas"`, `priority: "action"`,
  `label: "obligaciones saldadas sin archivar"`, `actionHref: "/accounts?saldadas=1"`. El
  parámetro abre `/accounts` con esas filas ya expandidas, vía el `open` controlado de
  `<EntityRow>`.

**Sin archivado en lote y sin archivado automático.** Con tres obligaciones, tres toques
desde la señal resuelven el caso; una pantalla de selección múltiple es maquinaria
prematura. Y saldo cero no siempre significa cuenta cerrada — archivar apaga plantillas
recurrentes, así que la confirmación del usuario es correcta. Solo tiene que costar un
toque, no cinco.

**Criterio de aceptación:** a 375px, una fila colapsada mide ≤ 88px y se ven al menos 6
cuentas por pantalla, sin scroll horizontal. (Hoy se ven 1,5.) La señal aparece en Inicio
con el número de obligaciones en saldo cero. Archivar desde la expansión deja la
obligación en la sección de cerradas de `/deudas` y desactiva su plantilla recurrente.
Cero elementos interactivos sin nombre accesible.

### Ola 2 — Creación y detalle de transacción

Aplicar `<FormShell>`, `<FieldSection>` y `<Field>` a `mobile-transaction-form.tsx` y a
`transaction-detail-client.tsx`. Imponer el orden canónico. Eliminar el drawer "Editar
datos": Monto, Fecha y Hora pasan a ser campos `layout="row"` editables in situ dentro de
Detalles, como ya lo son Cuenta y Categoría. El aviso "Cambiar el monto recalcula los
saldos de la cuenta y las métricas" se conserva como texto bajo el campo.

**No se toca** la lógica del detalle: vincular a recurrente, repartir gasto, excluir de
métricas, ubicación ni pago compartido. El cambio es de renderizado de campos y orden de
secciones.

**Criterio de aceptación:** los cinco campos compartidos usan la misma tipografía de
etiqueta en ambas pantallas. El monto se puede editar sin abrir un contenedor nuevo. Los
tests existentes de acciones de transacción siguen en verde.

Esta ola es divisible. Si al ejecutarla el resultado no convence, se puede entregar solo
la primera mitad —orden canónico y estilo de etiqueta único— y dejar la eliminación del
drawer para una iteración posterior.

### Ola 3 — Resto de listas

`/destinatarios`, `/recurrentes` y `/suscripciones` a `<EntityRow>`. Mecánica una vez que
la primitiva aguantó las tres formas de `/accounts`.

**Criterio de aceptación:** ninguna de las tres pantallas conserva una grilla de tarjetas
en móvil.

### Ola 4 — `/deudas` migra a la primitiva

Reemplazar `AccountRow` de `deudas-cuentas-lens.tsx` por `<EntityRow>`, eliminando la
implementación original.

Va **al final** deliberadamente: si `<EntityRow>` resulta ser la abstracción equivocada,
la pantalla que hoy funciona bien nunca se rompió.

**Criterio de aceptación:** `/deudas` es visualmente idéntica a como está hoy, con ~200
líneas menos.

---

## 6. Fuera de alcance

**Escritorio.** Queda como deuda documentada. El patrón a eliminar en su ola es la
duplicación de pantallas: `plan-tab-recurrentes.tsx` (escritorio) y
`mobile-recurrentes-view.tsx` (móvil) son dos implementaciones de la misma vista, que ya
divergieron en datos y hubo que reconciliar con un helper compartido
(`src/lib/utils/occurrence-counts.ts`).

**El resto de patrones** —hojas de acciones, diálogos, tiles de métricas— quedan como
reglas escritas con ejemplos señalados, sin refactor. Se documentan aquí como referencia,
no como trabajo comprometido.

---

## 7. Verificación

Por ola, en este orden:

1. `pnpm build:web` limpio y `pnpm --dir webapp exec vitest run` en verde.
2. Story de Storybook por cada forma real de cada primitiva.
3. Recorrido manual a 375px en `localhost:3000`, con capturas antes/después.
4. Cero elementos interactivos sin nombre accesible en las pantallas tocadas.

**Límite conocido:** la verificación en navegador usa eventos sintéticos. El gesto táctil
real —si la fila se siente bien al pulgar, si la expansión responde como se espera— solo
lo puede juzgar el usuario en su teléfono.

---

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| `<EntityRow>` resulta ser la abstracción equivocada | Se prueba en `/accounts` (tres formas distintas) antes de tocar `/deudas`, que se migra al final |
| La ola 2 no resuelve la sensación de desconexión | El diagnóstico —tres estilos de etiqueta, orden distinto, drawer como tercer chrome— es una interpretación de "se sienten desconectadas". La ola es divisible; se puede entregar solo el orden y la tipografía |
| Romper lógica del detalle de transacción al reordenar | El cambio es de renderizado, no de lógica. Los bloques con estado propio (vincular, repartir, ubicación) conservan su posición |
| Añadir `"cuentas"` a `AttentionPage` rompe consumidores | El tipo es una unión; los consumidores filtran por `page`, así que un valor nuevo se ignora donde no aplica |
