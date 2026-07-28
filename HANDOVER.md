# HANDOVER — 2026-07-28 — Audit del app móvil en simulador iOS

> Supersede el handover 2026-06-03 (Personal Debts F1). Los anteriores están en git (`HANDOVER.md@HEAD~N`).
>
> **OJO — trabajo aún abierto del handover anterior:** la rama `feat/personal-debts` NO está mergeada y le quedan las tareas 11, 12-paso-6, 14 (paridad mobile) y 15. Sus gotchas de schema/type-gen siguen vigentes: recupéralos con `git show HEAD~1:HANDOVER.md` antes de tocar `webapp/src/types/database.ts` o cualquier tabla `_enc`.

- **PR #379 MERGEADO** a `main` (`1f3ff43b`). Nada pendiente de esta sesión.
- Reportes: `docs/audits/2026-07-28-mobile-simulator-audit.md` · `docs/audits/2026-07-28-mobile-ux-critique.md`
- Pendientes detallados: `BACKLOG.md`, sección "Audit móvil en simulador"

## 1. Resumen

Barrido del app móvil (Expo/RN) en el simulador iOS con la cuenta **real** del usuario (557 transacciones, 11 cuentas), pantalla por pantalla. Se cubrieron **~20 de ~60 pantallas**: 8 P0 y ~15 P1, todos verificados en pantalla. 22 commits, 6 corridas de agentes de review (`zetas-front-guy` ×3, `mobile-sync-doctor` ×2, `mobile-webapp-parity` ×1).

## 2. Qué se arregló

**Rutas inalcanzables** — `nav_focus` se escribía en onboarding y nadie lo leía (ni existía la columna en SQLite), así que el tab Deudas nunca se renderizaba y `/deudas` + `/deudas/planificador` eran inalcanzables. El `<Stack>` raíz no tenía `screenOptions`, así que 10 rutas sin declarar ponían un header nativo encima del `MobileHeader`. El hub "Más" exponía 7 entradas planas contra las 15 en 5 grupos de la webapp, escondiendo 6 pantallas.

**La UI no se enteraba del sync** — `useFocusEffect` carga una vez al montar; el `syncAll()` post-login termina después y nada volvía a leer. SQLite tenía 557 transacciones mientras el dashboard mostraba `$ 0`. Nuevo `lib/sync/notify.ts` (broadcast sobre `useSyncExternalStore`) + hook `useReloadOnFocusAndSync`.

**Campos de dinero (15 superficies)** — mostraban dígitos crudos. El formato era lo fácil; lo peligroso era el parseo: `parseFloat("3.130.871")` → 3,13 y `parseMoney("3.130.871")` → NaN → **0**. Dos P0 de corrupción de saldo los cazaron los agentes, no el compilador.

**Layout / tokens** — el `ScrollView` horizontal del planificador se estiraba ~900pt y empujaba el contenido fuera de pantalla. 7 tokens (`z-surface-2-{3,4,5,6,8,10}`, `white-12`) se usaban en ~20 call sites sin estar definidos → superficies transparentes. 45 clases de peso tipográfico hacían que auth y captura renderizaran SF Pro en vez de Inter.

**Safe area, tildes, etiquetas de cuenta** alineadas con `webapp/src/lib/constants/account-types.ts`.

## 3. Decisiones clave

- **La sintaxis `/opacity` de la webapp SÍ funciona en móvil.** Un commit intermedio la reemplazó por tokens precalculados bajo la premisa falsa de que el proyecto estaba en NativeWind v3; está en **4.2.2** + Tailwind 3.3.5. Verificado con Tailwind (`bg-z-brass/30` → `rgb(147 120 68 / 0.3)`) y con sonda en dispositivo. **Revertido** en `eda3261d`. Los ~60 tokens precalculados son legado; `lib/constants/styles.ts` ya documenta que la sintaxis webapp es la preferida en código nuevo.
- **`NumericInput` formatea solo con opt-in (`money`)** — el mismo componente sirve "Tasa de interés mensual (%)", donde agrupar convertiría 2.5 en 25.
- **Los caches de perfil viven en `lib/profile-cache.ts`** para que `clearDatabase()` los invalide sin ciclo de imports con `profile.ts`.
- **"Captura rápida" se deja visible** aunque sea un `Alert("Próximamente")` — decisión explícita del usuario.

## 4. Estado

- `cd mobile && npx tsc --noEmit` → limpio
- Rama `main`, sincronizada. Sin cambios sin commitear (salvo `.claude/commands/`, `SERVICE.md`, `docs/services/`, `docs/_assets/` — todos preexistentes y sin trackear)
- Simulador iPhone 17 (`6037BEF7-0D15-4D0A-AF6E-CFD7ACC74427`) booteado, Metro vivo, app instalada y logueada

## 5. Pendientes y trampas

- **El broadcast de sync no se verificó end-to-end.** El diagnóstico está probado y el mecanismo pasó el gate, pero "DB vacía → login → la pantalla se llena sola" nunca se ejecutó (requiere vaciar la base local; el clasificador bloqueó el DELETE). Se confirma con un logout/login.
- **El hook cubre 4 de 28 pantallas.** Las otras 24 siguen con `useFocusEffect` pelado.
- **`mobile/` no tiene test runner.** Los dos P0 de dinero los cazaron los agentes. Un intento con `node --experimental-strip-types` falla porque el código usa imports sin extensión.
- **Solo 2 de 9 call sites de `clearDatabase()` levantan `resetInProgress`** — faltan `lib/auth.tsx:80,126,140`, `lib/demo-data.ts:61`, `app/settings.tsx:629,749,772`.
- **Deuda de primitivas:** móvil no tiene espejo de `EntityRow`, `Field` ni `Verdict`, y define **otro** `Verdict` en `lib/constants/verdict.ts` (el de `PurchaseDecisionResult`) — misma palabra, dos vocabularios.
- **Pantallas duplicadas:** `accounts-list` vs `(tabs)/accounts`; `presupuesto` vs `(tabs)/budgets`.
- **Nombres de ruta divergentes de la webapp** (`/transaction/[id]`, `/account/[id]`, `/menu`) — riesgo real para deep links de notificaciones, que empujan strings de ruta crudos.

## 6. Próximos pasos

1. **Wizard de Importar** (`app/(tabs)/import.tsx`, 4 pasos) — nunca se abrió, superficie más compleja, única con reconciliación de duplicados. **Leer §7 antes de probarlo.**
2. Resto del barrido: Personas, Deseos, Categorizar, Categorías, Destinatarios (+detalle/edición), purchase-decision, subscriptions, periodo, bug-report, onboarding completo, subpáginas de Settings.
3. Confirmar el sync con logout/login.
4. **En sesión paralela** (no colisiona con el barrido): vitest en `mobile/` + check de dinero; envolver los 7 `clearDatabase()`; borrar `components/inicio/_vault/` y `PulseWidget.tsx`.
5. **Después del barrido**, de una sola pasada: rollout de `useReloadOnFocusAndSync` a las 24 pantallas y unificación del dialecto de opacidad. Ambas tocan todos los archivos de pantalla — en paralelo al barrido garantizan conflictos.
6. Rediseño (requiere decisiones humanas): `docs/audits/2026-07-28-mobile-ux-critique.md`. Empezar por el selector de día.

## 7. Contexto para Claude

- **El simulador está logueado con la cuenta REAL en producción.** Importar un PDF, crear una cuenta o confirmar un pago **escribe en el Supabase real del usuario**. Preferir flujos de solo lectura; si hay que mutar, avisar antes y limpiar después.
- **`EXPO_PUBLIC_API_URL` apunta a producción** (`https://pfm.sanson…`), así que el import sube el PDF al VPS del usuario. Es su propia infraestructura, pero decírselo antes de pedirle un extracto bancario.
- **Verificar en el dispositivo, no asumir.** Dos veces en esta sesión una afirmación plausible resultó falsa: la sintaxis `/opacity`, y un spinner "colgado" que era un `ReferenceError` propio por hot reload. Los logs lo resuelven en un minuto:
  `xcrun simctl spawn <udid> log show --last 2m --predicate 'processImagePath CONTAINS "Zeta"'`
- **Editar con Metro corriendo puede dejar el bundle en error** si un símbolo se usa antes de importarlo. Relanzar:
  `xcrun simctl terminate <udid> com.venti5.zeta && xcrun simctl launch <udid> com.venti5.zeta`
- **El gate real de móvil es `cd mobile && npx tsc --noEmit`.** `pnpm build` es `next build` del webapp y no toca móvil: un cambio móvil roto pasa el build raíz en verde.
- **Cuidado con `git add docs` / `git add mobile`** — hay archivos sin trackear preexistentes que se cuelan. Pasó una vez: el diff saltó de 609 a 9.122 inserciones.
- SQLite del simulador: `~/Library/Developer/CoreSimulator/Devices/<UDID>/data/Containers/Data/Application/<GUID>/Documents/SQLite/zeta.db` — útil para verificar qué sincronizó de verdad (así se diagnosticó el bug del sync).
- Para meter archivos al simulador: arrastrarlos a la ventana, o copiarlos a
  `~/Library/Developer/CoreSimulator/Devices/<UDID>/data/Containers/Shared/AppGroup/*/File Provider Storage/`.
  La app **no** declara `UIFileSharingEnabled`/`LSSupportsOpeningDocumentsInPlace`, así que copiar a su propio contenedor no los hace visibles en el picker de Archivos.
