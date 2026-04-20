# Inicio Widget Vault

Reference implementations from the pre-chip dashboard. **Not rendered.** Kept
as starting points for future chips in `AddWidgetSheet` (`WIDGET_CATALOG`).

When a future widget is promoted from "Próximamente" to `available: true`,
port the relevant logic here into a chip-shaped `render{Name}Widget()`
following the pattern in `../widgets/`.

## Catalog → vault mapping

| Catalog entry (`WidgetType`) | Source reference | What to port |
|---|---|---|
| `goal` | — | New implementation; no vault source yet |
| `spending_by_category` | `InicioMetricsGrid.tsx` "gasto-hoy" accordion + category totals | Ranked category list, bar breakdown |
| `cashflow_calendar` | `InicioMetricsGrid.tsx` calendar helpers | Month grid with ingreso/pago dots |
| `debt_progress` | — | New implementation; link to `debt` page data |
| `merchants_this_month` | `InicioActivity.tsx` merchant aggregation | Top destinatarios by spend |
| `shared_with_partner` | — | New implementation |
| _(expanded hero variant)_ | `InicioHero.tsx` | Reflective "día N/M" narrative copy |
| _(attention queue)_ | `InicioAttention.tsx` | Pagos vencidos + confirmaciones pending |
| _(accounts hub variant)_ | `InicioAccountsHub.tsx` | Group-by-institution layout |

## Shape contract reminder

Every chip must export `render{Name}Widget(data)` returning:

```ts
{
  tone: ChipTone;
  accessibilityLabel: string;
  chip: ReactNode;    // bespoke JSX for the S-size tile
  detail: ReactNode;  // accordion panel opened on tap
}
```

See `../widgets/AccountsWidget.tsx` or `../widgets/NextBillWidget.tsx` for
canonical examples.
