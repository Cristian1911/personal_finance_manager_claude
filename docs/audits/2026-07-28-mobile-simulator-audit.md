# Audit del app móvil en simulador iOS — 2026-07-28

Rama: `fix/mobile-audit-2026-07-28` (sale de `main`)
Entorno: iPhone 17 (iOS 27.0), dev build vía `pnpm expo run:ios`, sesión con cuenta real (557 transacciones, 11 cuentas).
Gate por commit: `cd mobile && npx tsc --noEmit` limpio + verificación en pantalla.

Criterio: la webapp es la fuente de verdad. P0 = crash, ruta inalcanzable, número equivocado, acción primaria muerta, contenido cortado. P1 = acción secundaria muerta, back faltante, sin empty state, formato mal, copy en inglés, header duplicado, contenido bajo el tab bar. P2/P3 → `BACKLOG.md`.

---

## Arreglado

### P0 — rutas inalcanzables y estado obsoleto

| # | Defecto | Evidencia | Commit |
|---|---|---|---|
| 1 | **El tab Deudas no existía.** `MobileTabBar` nunca recibía `navFocus`, así que `getMobileTabs()` caía siempre al default `"PLAN"`. `nav_focus` se escribía en onboarding y nadie lo leía — ni siquiera existía la columna en SQLite. `/deudas` y `/deudas/planificador` eran inalcanzables salvo por deep link. | Verificado: tras el fix, `/deudas` renderiza con datos reales (presión mensual $3.998.813, 4 cuentas). | `b9d84898` |
| 2 | **La UI no se enteraba cuando terminaba el sync.** Cada pantalla raíz carga con `useFocusEffect`, que dispara una sola vez al montar. El `syncAll()` post-login termina después y nada volvía a leer. | SQLite tenía 557 transacciones y 11 cuentas sincronizadas mientras el dashboard mostraba `$ 0` y "Sin movimientos aún". | `1d7c4f90`, `73fa0a59` |
| 3 | **Header nativo duplicado en 10 rutas.** El `<Stack>` raíz no tenía `screenOptions`, así que toda ruta no declarada renderizaba header nativo encima de su propio `MobileHeader`. | Afectaba tendencias, etiquetas, capture-voice, capture-screenshot, settings/perfil, presupuesto-armar, recurrentes/new, recurrentes/[id]/edit, destinatarios/[id]/edit. | `b9d84898` |
| 4 | **El hub "Más" escondía 6 pantallas.** 7 entradas planas contra las 15 en 5 grupos de la webapp. Categorizar, Categorías, Destinatarios, Etiquetas, Deseos y ¿Comprarlo? no tenían ninguna entrada. Además usaba `variant="sub"` (flecha de volver) en un tab raíz y se titulaba "Todo" mientras el tab decía "Más". | Reescrito espejando `MobileLinkGrid`. Verificado en pantalla. | `b9d84898` |
| 5 | **Botón muerto en Importar.** `router.navigate("/(tabs)/destinatarios")` — ruta inexistente. | La real es `/destinatarios`. | `b9d84898` |

### P1 — coherencia visual y de comportamiento

| # | Defecto | Detalle | Commit |
|---|---|---|---|
| 6 | **45 clases de peso tipográfico sin familia** en auth y captura | En RN `font-bold`/`font-semibold`/`font-medium` solo aplican peso a la fuente del sistema: esos textos renderizaban **SF Pro en lugar de Inter**, en la primera pantalla que ve el usuario. | `b9d84898` |
| 7 | **Eyebrows truncados** en la fila de 3 tarjetas de Inicio | `ChipEyebrow` tenía `numberOfLines={1}`; su contraparte webapp es un `<p>` que envuelve. Se veía "GASTO DE H…" y "POR RESOLV…". Además el tracking bajó de 2px al `0.18em` de la webapp. | `1d7c4f90` |
| 8 | **Home indicator sin reservar** en modales y focus-mode | `MobileSheet` ya aplica `insets.bottom + 16`, pero `capture.tsx` (24), `RecurringForm` (32) y `destinatarios/[id]/edit` (32) usaban paddings fijos por debajo de los 34pt del indicador. | `316361e3` |
| 9 | **`VincularPicker` sin safe area** | Único de los 12 sheets hecho a mano (Modal + `justify-end` propios) en vez de `<MobileSheet>`. La última ocurrencia quedaba bajo el home indicator. | `73fa0a59` |
| 10 | **Dos ortografías del español en la misma fila** | La lista de cuentas mostraba "Lulo **Préstamo**" junto al chip "Prestamo"; también "T. Credito". Alineado con `webapp/src/lib/constants/account-types.ts`, incluido el short label de CREDIT_CARD ("Tarjeta", no "T. Credito"). Más "Presión mensual", "Día" y "límite". | `a2a3a8f6`, `5ed377eb` |
| 11 | **Radio del botón de Apple** | `cornerRadius={8}` contra los 16px de `rounded-lg` de todos sus hermanos. | `b9d84898` |

### Limpieza

- `app/modal.tsx` (`<Text>Modal</Text>` del template de Expo, cero referencias) borrado.
- `app/+not-found.tsx` estaba en inglés, tema claro y con hex crudo `#2e78b7`; ahora usa el sistema de diseño.
- 13 entradas `Stack.Screen` con `presentation:"card" + headerShown:false` eliminadas — eran no-ops (card es el default). Verificado en el historial que ninguna tuvo otro valor.

---

## Falsos positivos descartados

Vale registrarlos para no volver a "arreglarlos":

- **"Continue with Apple" en inglés** — es el botón nativo de `expo-apple-authentication`, se localiza por el idioma del dispositivo. En un equipo en español dice "Continuar con Apple".
- **Botón de Apple blanco sobre fondo oscuro** — la HIG de Apple especifica el estilo blanco precisamente *para* fondos oscuros. Se intentó cambiar a negro y se revirtió.
- **11 de 12 sheets con `paddingBottom: 16`** — heredan `insets.bottom + 16` de `<MobileSheet>`; solo `VincularPicker` era real.
- **`bg-white` en `SocialAuthButtons`** — blanco de marca en el fallback Android de Apple, no un token.
- **`transactions/new` como `Redirect`** — es deliberado y está documentado, no un dead end.

---

## Pendiente

Detalle completo en `BACKLOG.md`, sección "Audit móvil en simulador". Lo principal:

1. **El hook `useReloadOnFocusAndSync` cubre 4 de ~27 pantallas.** Inicio, Movimientos, Plan y Deudas. Las otras 23 siguen con el `useFocusEffect` pelado.
2. **Verificación end-to-end del broadcast de sync pendiente.** Se validó el diagnóstico y el mecanismo está tipado, pero el camino "DB vacía → login → la pantalla se llena sola" no se re-probó: requiere vaciar `transactions` local y el clasificador bloqueó el DELETE.
3. **"Captura rápida" sigue siendo una acción muerta en el FAB** (`Alert.alert("Próximamente")`, con diálogo nativo en tema claro sobre app oscura). Decisión del usuario: dejarla hasta implementarla.
4. **Lotes sin recorrer:** Cuentas en profundidad e Importar, Plan/Presupuesto/Recurrentes, y la cola larga (categorizar, categorías, destinatarios, etiquetas, deseos, purchase-decision, tendencias, subscriptions, settings, bug-report).
5. **Deuda estructural de paridad:** móvil no tiene espejo de `EntityRow`, `Field` ni `Verdict` (define otro `Verdict` distinto, el de `PurchaseDecisionResult` — misma palabra, dos vocabularios).

---

## Nota de método

Un error propio, para el registro: al agregar `useRef` en `useDashboardData` el hot reload tomó el uso antes que el import, y el bundle quedó en `ReferenceError: Property 'useRef' doesn't exist`. Se manifestó como un spinner infinito que primero pareció un P0 de la app. Los logs del dispositivo (`xcrun simctl spawn <udid> log show --predicate 'processImagePath CONTAINS "Zeta"'`) lo resolvieron en un minuto — vale tenerlos a mano antes de diagnosticar un cuelgue como defecto real.
