# HANDOVER — 2026-07-29 — Audit del app móvil en simulador iOS

> Supersede el handover 2026-06-03 (Personal Debts F1). Los anteriores están en git (`HANDOVER.md@HEAD~N`).
>
> **OJO — trabajo aún abierto del handover anterior:** la rama `feat/personal-debts` NO está mergeada y le quedan las tareas 11, 12-paso-6, 14 (paridad mobile) y 15. Sus gotchas de schema/type-gen siguen vigentes: recupéralos con `git log --all --oneline -- HANDOVER.md` y `git show <sha>:HANDOVER.md` antes de tocar `webapp/src/types/database.ts` o cualquier tabla `_enc`.

- **PR #379 y #380 MERGEADOS** a `main`. Nada de código pendiente.
- Reportes: `docs/audits/2026-07-28-mobile-simulator-audit.md` · `docs/audits/2026-07-28-mobile-ux-critique.md`
- Pendientes detallados: `BACKLOG.md`, sección "Audit móvil en simulador"
- **Para retomar el barrido visual: ver §8 al final**, que lista pantalla por pantalla lo recorrido y lo que falta.

## 1. Resumen

Barrido del app móvil (Expo/RN) en el simulador iOS con la cuenta **real** del usuario (562 transacciones, 11 cuentas), pantalla por pantalla. Se cubrieron **~30 de 45 rutas**: 9 P0 y ~20 P1, todos verificados en pantalla. 27 commits en dos PRs, 6 corridas de agentes de review (`zetas-front-guy` ×3, `mobile-sync-doctor` ×2, `mobile-webapp-parity` ×1).

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

- **El broadcast de sync está VERIFICADO end-to-end** (logout → login del usuario, los datos llegaron solos). Requirió un segundo arreglo, upstream del primero: `handleUserBoundary` no limpiaba `autoSyncedUserRef` en la rama de logout, así que al volver a entrar con el MISMO usuario `triggerInitialSyncOnce` salía por su propio guard y el sync nunca corría — con la base ya vaciada por el logout. La fila `sync_metadata['__last_run']` es el instrumento que lo delató: existe solo si `doSyncAll` llegó al final. **Úsala para diagnosticar cualquier sospecha de sync.**
- **Google sign-in falla con `Passed nonce and nonce in id_token should either both exist or not.`** SIN DIAGNOSTICAR. Ese error solo sale de `signInWithIdToken`, y en `lib/auth-social.ts` **el camino de Google no pasa nonce** — el único que lo pasa es `signInWithAppleNative`. O sea el mensaje es estructuralmente consistente con Apple, no con Google, pero el usuario reportó haber tocado Google. Falta confirmar qué botón fue antes de tocar código de auth. Si fue Apple, es limitación del simulador (firma ad-hoc + Apple ID); si fue Google, el `id_token` trae un claim `nonce` que el código no reenvía.
- **El hook cubre 4 de 28 pantallas.** Las otras 24 siguen con `useFocusEffect` pelado.
- **`mobile/` no tiene test runner.** Los dos P0 de dinero los cazaron los agentes. Un intento con `node --experimental-strip-types` falla porque el código usa imports sin extensión.
- **Solo 2 de 9 call sites de `clearDatabase()` levantan `resetInProgress`** — faltan `lib/auth.tsx:80,126,140`, `lib/demo-data.ts:61`, `app/settings.tsx:629,749,772`.
- **Deuda de primitivas:** móvil no tiene espejo de `EntityRow`, `Field` ni `Verdict`, y define **otro** `Verdict` en `lib/constants/verdict.ts` (el de `PurchaseDecisionResult`) — misma palabra, dos vocabularios.
- **Pantallas duplicadas:** `accounts-list` vs `(tabs)/accounts`; `presupuesto` vs `(tabs)/budgets`.
- **Nombres de ruta divergentes de la webapp** (`/transaction/[id]`, `/account/[id]`, `/menu`) — riesgo real para deep links de notificaciones, que empujan strings de ruta crudos.

## 6. Próximos pasos

1. **Terminar el barrido visual** — las 15 rutas de §8. Empezar por las de captura (`capture`, `capture-voice`, `capture-screenshot`), que son el flujo de creación y donde más se toca dinero.
2. **Resolver el error de nonce en el login social** (§5) — primero confirmar qué botón lo produce.
3. **En sesión paralela** (no colisiona con el barrido): vitest en `mobile/` + check de dinero; envolver los 7 `clearDatabase()` en `beginReset`/`endReset`; borrar `components/inicio/_vault/` y `PulseWidget.tsx`.
4. **Después del barrido**, de una sola pasada: rollout de `useReloadOnFocusAndSync` a las 24 pantallas y unificación del dialecto de opacidad. Ambas tocan todos los archivos de pantalla — en paralelo al barrido garantizan conflictos.
5. Rediseño (requiere decisiones humanas): `docs/audits/2026-07-28-mobile-ux-critique.md`. Empezar por el selector de día.

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
- **PDFs de prueba ya copiados al simulador**, en *En mi iPhone → Zeta pruebas*: Bancolombia ahorros, Bancolombia VISA, Nu tarjeta, Banco de Bogotá préstamo y uno no reconocido para la ruta de error. Salieron de `bank_pdf_examples/` del repo, que tiene 16 extractos — uno por parser.

---

## 8. Cobertura del barrido visual — qué falta

45 rutas bajo `mobile/app/` (sin contar `_layout` ni `+html`). **30 recorridas, 15 pendientes.**

### Recorridas y verificadas

`(auth)/login` · `(auth)/signup` · `(tabs)/index` · `(tabs)/transactions` · `(tabs)/plan` · `(tabs)/deudas` · `(tabs)/menu` · `(tabs)/import` (pasos 1–3) · `accounts-list` · `account/[id]` · `account/create` · `transaction/[id]` · `presupuesto` · `presupuesto-armar` · `periodo` · `recurrentes` · `deudas/planificador` · `personas` · `categorizar` · `categories` · `destinatarios` · `destinatarios/[id]` · `etiquetas` · `deseos` · `purchase-decision` · `tendencias` · `subscriptions` · `settings` · `settings/perfil` · `+not-found` (reescrita)

### Pendientes

| Ruta | Por qué importa / cómo llegar |
|---|---|
| `capture` | **Prioridad.** Flujo principal de crear movimiento. Se le arregló el safe area y el formato de monto sin verlo en pantalla. FAB → "Nueva transacción" |
| `capture-voice` | Se le arregló la fecha ISO sin verificar visualmente. FAB → "Captura por voz". El reconocimiento de voz degrada en simulador |
| `capture-screenshot` | Igual: fecha ISO arreglada sin ver. FAB → "Importar pantallazo" |
| `annotate-screenshot` | Solo se alcanza desde el flujo de bug-report |
| `bug-report` | BugFAB (si está activo en Ajustes) o Ajustes → "Reportar bug" |
| `onboarding` | 5 pasos. **Cuidado:** se llega por Ajustes → "Repetir onboarding" y podría tocar `onboarding_completed` de la cuenta real. Se saltó a propósito |
| `account/edit/[id]` | `account/[id]` → "Más" → Alert → "Editar". Se le arregló el parseo de saldo (era P0 de corrupción) — **conviene verlo** |
| `destinatarios/[id]/edit` | `destinatarios/[id]` → "Editar destinatario". Focus-mode |
| `recurrentes/new` | `recurrentes` → "+". Focus-mode, usa `RecurringForm` (safe area arreglada sin verificar) |
| `recurrentes/[id]/edit` | `recurrentes` → fila → sheet → "Editar plantilla" |
| `(tabs)/import` paso 4 | El paso de resultado. **Escribe a producción** — requiere plan para limpiar después |
| `(auth)/forgot-password` | Desde login |
| `(auth)/reset-password` | Solo por deep link (`zeta://reset-password`) |
| `(tabs)/accounts` | Duplicado de `accounts-list`. Solo llegable desde Ajustes → "Administrar cuentas" |
| `(tabs)/budgets` | Duplicado de `presupuesto`. Huérfano: sin entrada en la UI |

### Nota de método

Varias de las pendientes **ya recibieron arreglos a ciegas** (safe area, formato de dinero, fechas): `capture`, `capture-voice`, `capture-screenshot`, `account/edit/[id]`, `RecurringForm`. Los cambios pasan `tsc` y dos de ellos los validaron los agentes de review, pero **ninguno se vio en pantalla**. Son las primeras que hay que abrir.
