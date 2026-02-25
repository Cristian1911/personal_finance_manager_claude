# Diseño: Fixes urgentes de deuda (abonos como ingreso + simulador roto)

**Fecha**: 2026-02-25
**Estado**: Aprobado
**Alcance**: Fix de bugs críticos — no rediseño

---

## Contexto

Dos bugs críticos afectan la credibilidad de la app:

1. Los abonos a tarjeta de crédito se cuentan como "ingresos", inflando métricas del dashboard
2. El simulador de deuda muestra crecimiento exponencial en vez de amortización

Estos fixes son el primer paso. El rediseño completo de dashboards y simuladores se hará en una sesión futura.

---

## Fix #1: Abonos a deuda contados como ingreso

### Problema

En `services/pdf_parser/parsers/bancolombia_credit_card.py:222-224`, los pagos a TDC tienen monto negativo en el extracto → el parser los marca como `INFLOW`. El dashboard en `webapp/src/app/(dashboard)/dashboard/page.tsx:123-125` suma **todos** los INFLOW como ingreso.

Un pago de deuda es dinero que sale de la cuenta bancaria para reducir un pasivo. No es ingreso.

### Decisión de diseño

- **El parser NO se modifica** — desde la perspectiva del extracto de TDC, un pago sí es un INFLOW (entra dinero a la tarjeta). El parser es correcto en su contexto.
- **El dashboard filtra** — al calcular "Ingresos del mes", se excluyen transacciones INFLOW que pertenezcan a cuentas tipo CREDIT_CARD o LOAN. Esos son abonos a deuda, no ingresos reales.

### Cambios

**`webapp/src/app/(dashboard)/dashboard/page.tsx`**:
- `monthIncome` = INFLOW transactions donde la cuenta asociada NO es tipo CREDIT_CARD ni LOAN
- Savings rate usa el income filtrado
- Opcionalmente mostrar "Abonos a deuda del mes" como métrica separada

**`webapp/src/actions/charts.ts`**:
- Aplicar el mismo filtro si los charts suman INFLOW sin discriminar tipo de cuenta

### Validación con datos reales

- Saldo anterior TDC: $4,477,227
- Pago mínimo (INFLOW en extracto): $310,050
- Este monto NO debe aparecer en "Ingresos del mes"
- Patrimonio neto no se ve afectado (usa balances de cuentas, no transacciones)

---

## Fix #2: Simulador de deuda roto

### Problema

`getMinimumPayment()` en `packages/shared/src/utils/debt-simulator.ts:46-51` usa fallback de 2% del saldo cuando `monthlyPayment` es null:

- 2% de $4,242,610 = $84,852
- Interés mensual al 23.6% EA = $83,438
- Reducción de capital = $1,414/mes → prácticamente no amortiza

El pago mínimo real es $310,050 (reducción de ~$226k/mes).

### Causa raíz

`monthlyPayment` probablemente no se está poblando desde el import de extractos. El campo `minimum_payment` existe en el schema y en `extractDebtAccounts`, pero el dato no llega o no se persiste.

### Cambios

**`packages/shared/src/utils/debt-simulator.ts`**:

1. Mejorar fallback de `getMinimumPayment`:
   - De: `max(balance * 0.02, 10000)`
   - A: `max(balance * 0.05, 50000)` — más realista para Colombia
2. Agregar validación: si `minPayment <= monthlyInterest`, advertir que el pago no cubre intereses
3. Agregar simulación baseline "sin estrategia" a `compareStrategies`:
   - Solo pagos mínimos, sin extra ni priorización
   - Retornar 3 líneas: baseline, snowball, avalanche

**`webapp/src/components/debt/debt-simulator.tsx`**:

4. Mostrar línea baseline en chart de Snowball vs Avalanche
5. Mejorar asignador de pago único: mostrar tabla de cálculos (saldo → pago → nuevo saldo → ahorro) y proyección de meses ahorrados

**`webapp/src/actions/import-transactions.ts`**:

6. Verificar que `minimum_payment` del extracto se persista en la cuenta al importar

### Validación con datos reales

Con TDC de $4,242,610 al 23.6% EA y pago mínimo de $310,050:
- Simulador debe mostrar payoff en ~16-18 meses (solo mínimo)
- Balance debe decrecer mes a mes, nunca crecer
- Interés total pagado ~$600k-$700k (no $360M)

---

## Fuera de alcance (sesión futura)

- Rediseño completo de dashboards (#3)
- Parser para PDFs de Nu (#4)
- Reimaginación de categorías (#5)
- Empty state post-onboarding (#6)
- Simulador interactivo con sliders
- Consideración de cuotas fijas vs crédito rotativo

---

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `webapp/src/app/(dashboard)/dashboard/page.tsx` | Filtrar INFLOW de cuentas de deuda en cálculo de ingresos |
| `webapp/src/actions/charts.ts` | Mismo filtro en datos de charts |
| `packages/shared/src/utils/debt-simulator.ts` | Fix fallback pago mínimo, agregar baseline |
| `webapp/src/components/debt/debt-simulator.tsx` | UI baseline en chart, mejorar asignador |
| `webapp/src/actions/import-transactions.ts` | Verificar persistencia de minimum_payment |
