# Zeta Backlog

> Persistent backlog shared across sessions. Update this file whenever a task is discovered but not tackled in the current session. Remove items when they ship (merged to main).

## How to use

- **Before starting work**: scan this file for items that overlap with your task — fix them together.
- **After finishing work**: if review agents or testing surfaced new issues you didn't fix, add them here.
- **After merging a PR**: remove the items it resolved.

---

## Audit móvil en simulador (rama `fix/mobile-audit-2026-07-28`, 2026-07-28) — follow-ups

Barrido pantalla por pantalla en el simulador iOS con cuenta real. Arreglado y commiteado: rutas inalcanzables (tab Deudas, hub "Más"), header nativo duplicado, tipografía Inter en auth/captura, broadcast de sync a la UI, safe area en modales/focus-mode, tildes en Deudas. Lo que sigue quedó fuera del alcance P0/P1:

- **(Diseño) Crítica de UX/UI entregada** → `docs/audits/2026-07-28-mobile-ux-critique.md`. No son bugs: todo funciona, el problema es de diseño y requiere intervención humana. Lo más urgente: el selector de día (31 círculos en scroll horizontal, en 3 pantallas, sin concepto de fin de mes), la falta de jerarquía en Presupuestos con datos reales, el veredicto que se responde en tres idiomas distintos según la pantalla, y las tres gramáticas de fila conviviendo (tocar expande / navega / despliega acciones).
- **(P1) `mobile/` no tiene test runner, y los helpers de dinero lo merecen.** El par formato↔parseo (`lib/amount.ts` + `lib/utils/money.ts`) alimenta 15 superficies que escriben montos a Supabase; cuando los dos lados no coincidían, `parseFloat("3.130.871")` devolvía 3,13 y **cada edición de saldo escribía un número un millón de veces menor**, en silencio. Lo cazaron dos pasadas de review, no el compilador. El round-trip se verificó a mano (incluidos negativos y colas decimales) pero no quedó nada ejecutable: se intentó un script con `node --experimental-strip-types` y falla porque el código real usa imports sin extensión. Configurar vitest en `mobile/` (ya está en webapp y packages/shared) y portar ese check.
- **(P2) Solo 2 de los 9 call sites de `clearDatabase()` levantan `resetInProgress`.** `resetUserData` y `deleteUserAccount` sí; `auth.tsx` handleUserBoundary (cambio de usuario), `demo-data.ts`, y los tres de `settings.tsx` (resync completo, cerrar sesión, salir de demo) no. Eso deja el guard de `notifyLocalDataChanged`/`recordSyncRun` protegiendo solo dos rutas. Envolver las siete restantes en `beginReset()`/`endReset()`. (mobile-sync-doctor, preexistente)
- **(P1) Header hundido ~60pt en las 7 pantallas modales.** `MobileHeader` aplica `paddingTop: insets.top` incondicionalmente; en presentación `modal` iOS ya desplaza la tarjeta, así que el inset se suma dos veces. Afecta `capture`, `transaction/[id]`, `account/[id]`, `account/create`, `subscriptions`, `purchase-decision`, `bug-report`. Cambio de componente compartido (~40 pantallas): exige verificar modales y no-modales una por una. (audit 2026-07-28)
- **(P2) `IMPULSE` tiene dos etiquetas en ambas plataformas** — "Capricho" en `purchase-decision`/`afford-page-client`, "Impulso" en Deseos/`deseos-item`. Decidir la palabra y aplicarla en los 4 sitios a la vez; arreglar solo móvil crearía drift.
- **(P1) `useReloadOnFocusAndSync` en las ~23 pantallas restantes.** El hook está en `mobile/lib/sync/notify.ts` y ya lo usan Inicio, Movimientos, Plan y Deudas. Las demás siguen con `useFocusEffect(useCallback(load,[load]))` pelado, así que si el sync de fondo termina mientras el usuario está en ellas, no se enteran. Candidatas (todas ya identificadas): `accounts-list`, `(tabs)/accounts`, `(tabs)/import`, `etiquetas`, `periodo`, `subscriptions`, `tendencias`, `settings`, `BudgetsRoot`, `CategoriesRoot`, `CategorizarRoot`, `DeseosRoot`, `DestinatariosRoot`, `DestinatarioDetail`, `PersonasRoot`, `RecurrentesRoot`, `PlanificadorRoot`.
- **(P1) Verificación pendiente del broadcast de sync.** El camino end-to-end (DB vacía → login → el sync llena la pantalla sin tocar nada) NO se re-probó: requiere vaciar `transactions` local, y el clasificador bloqueó el DELETE. Se validó el diagnóstico (SQLite con 557 tx mientras la UI mostraba $0) y el mecanismo está tipado, pero conviene confirmarlo en el próximo login desde cero.
- **(P1) "Captura rápida" es una acción muerta en el FAB** — `Alert.alert("Próximamente")` en `MobileTabBar.tsx:99`, y con diálogo nativo en tema claro sobre una app oscura. La webapp sí la tiene (`mobile-quick-capture-sheet.tsx`, refactorizada en 74c46eea). Decisión del usuario 2026-07-28: dejarla visible hasta implementarla. Portar el parser a una pantalla RN.
- **(P2) `VincularPicker` debería reusar `<MobileSheet>`** — es el único de los 12 sheets hecho a mano (Modal + `justify-end` propios). Se le parchó el `insets.bottom`; la deuda real es la reutilización.
- **(P2) Converger el padding inferior de los modales restantes** — `transaction/[id]`, `account/create`, `account/edit/[id]` usan 40 fijo. Libra el home indicator pero no sigue el patrón `insets.bottom + N`.
- **(P2) Acción destructiva duplicada en `transaction/[id]`** — ícono de basura en el header Y botón "Eliminar transacción" al final. Dos entradas al mismo destructivo; la webapp tiene una.
- **(P2) Tres dialectos de eyebrow.** `styles.ts` `SECTION_EYEBROW_CLASS` usa `tracking-[4px]`; `TOKENS.md` y `FormField.tsx` dicen `tracking-[0.18em]`; `ChipEyebrow` estaba en `2px` (ya bajado a 1.8px = el 0.18em de la webapp). Unificar en un solo token.
- **(P2) Números divergentes entre Inicio y Movimientos** — el hero dice "Gastados $7.913.532" y Movimientos "GASTOS $12.473.947" para el mismo mes. Probablemente correcto por diseño (el hero excluye pagos a tarjeta y transferencias), pero no se verificó contra la webapp. Confirmar y, si es correcto, diferenciar el copy para que no se lean como el mismo dato.
- **(P2) Pantallas duplicadas**: `accounts-list` vs `(tabs)/accounts` (casi idénticas; la segunda tiene loading state y la primera no), y `presupuesto` vs `(tabs)/budgets`.
- **(P2) Primitivas de la webapp sin espejo móvil** (deuda estructural de los últimos 4 commits de webapp): `EntityRow` + `TickGauge`, `Field`/`FIELD_LABEL_CLASS`, y `Verdict` 4-estado — móvil define otro `Verdict` en `lib/constants/verdict.ts` (el de `PurchaseDecisionResult`): misma palabra, dos vocabularios. También falta un `EmptyState` compartido (~20 empty states ad-hoc).
- **(P2) Superficies webapp sin contraparte móvil**: `/pendientes`, `/modos`, el AttentionHub del hub "Más", y `settings/{analytics,email,integraciones,pdf-passwords}`.
- **(P3) Drift de nombres de ruta móvil↔webapp**: `/transaction/[id]` vs `/transactions/[id]`, `/account/[id]` vs `/accounts/[id]`, `/menu` vs `/gestionar`. Riesgo real para deep links de notificaciones, que empujan strings de ruta crudos.
- **(P3) Código muerto**: `components/inicio/_vault/*`, `components/inicio/widgets/PulseWidget.tsx`.
- **(P2) Unificar el tracking de los eyebrows.** `ChipEyebrow` quedó alineado al `0.18em` de la webapp, pero hay decenas de eyebrows con `tracking-[1px]/[1.2px]/[2px]/[3px]/[4px]` (DeudasHero, DeudasSalaryBar, los 4 pasos del planificador, RecurringSummaryCard, BudgetsHero, BudgetRow, CategoryFormSheet, SectionDivider, MobileZone…). Pasada dedicada, no inline.
- **(P1) Colapsar los dos dialectos de opacidad en móvil.** Verificado en dispositivo (2026-07-28): con NativeWind **4.2.2** + Tailwind 3.3.5 la sintaxis de la webapp (`bg-z-brass/30`) compila y renderiza idéntica al token precalculado (`bg-z-brass-30`). Los ~60 tokens `{base}-{percent}` de `tailwind.config.js` son residuo de NativeWind v3 y ya no hacen falta. Migrar los ~cientos de call sites a la sintaxis de la webapp y borrar los tokens precalculados unificaría la gramática de ambos codebases; es mecánico pero grande, y hay que hacerlo de una sola pasada para no dejar el código mezclado. Mientras tanto `styles.ts` documenta que la sintaxis de la webapp es la preferida en código nuevo.
- **(P2) `docs/design-system/TOKENS.md` no documenta nada de móvil.** Añadir una subsección "Mobile (NativeWind 4)" que apunte a `mobile/tailwind.config.js` como fuente de verdad y aclare que la sintaxis `/opacity` funciona — el comentario obsoleto "NativeWind v3-compatible" en `styles.ts` ya causó un reemplazo masivo innecesario en esta rama.
- **(P3) Borrar `components/inicio/_vault/`** — confirmado sin imports. Tiene además tildes faltantes ("Como se calcula", "Saldo liquido", "Pagos proximos") que no vale la pena arreglar si se va a eliminar.
- **(P1) Login social: `Passed nonce and nonce in id_token should either both exist or not.`** Sin diagnosticar. El error solo sale de `signInWithIdToken`; en `lib/auth-social.ts` **Google no pasa nonce** y el único que lo hace es `signInWithAppleNative`, así que el mensaje encaja con Apple aunque se reportó tocando Google. Confirmar qué botón antes de tocar código de auth: si es Apple, es limitación del simulador (firma ad-hoc + Apple ID); si es Google, el `id_token` trae un claim `nonce` que el código no reenvía. (2026-07-29)
- **(P3) Barrido visual: 15 de 45 rutas sin recorrer** — lista completa con cómo llegar a cada una en `HANDOVER.md` §8. Prioridad: las de captura (`capture`, `capture-voice`, `capture-screenshot`) y `account/edit/[id]`, porque **recibieron arreglos que nunca se vieron en pantalla**.

## Plan ↔ ocurrencias: conciliación tolerante (rama fix/plan-entry-occurrence-drift) — follow-ups

- [ ] **"Préstamo" de ocurrencia entre períodos adyacentes** — RESUELTO para filas con FK (`occurrence_id` es único por diseño: hidratación excluye ocurrencias ya reclamadas por FK, el seed chequea claims globales cross-período). Residual: solo entradas legacy SIN FK en dos períodos podrían mostrar el mismo pago dos veces vía fallback por ventana; se cura solo al sincronizar (el link pass persiste la FK). Cerrar cuando no queden filas recurrentes sin FK. (server-action-reviewer, MEDIUM → mitigado)
- [ ] **Mobile: columna `occurrence_id` en SQLite** — el pull de mobile filtra columnas desconocidas (PRAGMA table_info) y el push manda payloads explícitos, así que nada se rompe ni se pisa; pero las entradas creadas desde mobile nacen sin FK (el seed del webapp las enlaza al sincronizar). Para paridad plena: agregar la columna al schema SQLite + migración local + incluirla en pull, y idealmente replicar el link en el repo mobile de planning. Spawn `mobile-sync-doctor` + `mobile-webapp-parity`. (esta sesión, follow-up)
- [ ] **Toast del sync no cuenta re-fechados** — `sync-recurring-button.tsx` dice "Nada nuevo que sincronizar" cuando `created === 0` aunque el self-heal haya re-fechado entradas; devolver `redated` en el ActionResult y ajustar el copy. (server-action-reviewer, nit)
- [ ] **`recordRecurringOccurrencePayment` marca pagado por fecha exacta sin verificar filas afectadas** — `recurring-templates.ts:~1070`: si el UPDATE no matchea ninguna ocurrencia, crea la transacción y marca la entrada COMPLETED pero la ocurrencia queda pending, sin error visible. Mitigado dos veces (payPlanningEntry pasa la fecha real de la ocurrencia FK; la validación ahora acepta fechas materializadas fuera de cronograma), pero el write debería asertar `rows > 0`. (recurring-doctor, follow-up)
- [ ] **"Volver a pendiente" en Plan es no-op visible si la ocurrencia sigue pagada** — `toggleEntryStatus(id, "PLANNED")` solo cambia el status guardado de la entrada; el override de display (solo-upgrade) la regresa a COMPLETED en el siguiente render. Pre-existente. Con la FK el botón podría ofrecer revertir la ocurrencia (flujo revertOccurrence, con su confirm destructivo) o desaparecer para entradas FK. (server-action-reviewer r2 + recurring-doctor r2)
- [ ] **Seed silencioso incompleto si `ensureOccurrencesForRange` falla** — el seed ahora siembra desde filas de ocurrencia; si el ensure falla transitoriamente y una plantilla no tiene filas previas, ese sync no crea su entrada (se cura en el siguiente sync). Documentado en código; considerar toast de advertencia. (server-action-reviewer r2, MEDIUM informativo)

## Savings import overhaul (PR #362, 2026-07-06) — follow-ups
- [ ] Infra: `infra/nginx/` (imagen custom + default.conf) NO es el proxy de producción — prod usa Nginx Proxy Manager (`jc21/nginx-proxy-manager`) en el VPS con hosts `pfm.sanson1911.cloud` y `n8n.venti5.shop`. Decidir: retirar `infra/nginx/` del repo o documentarlo como legado; los timeouts reales se configuran en NPM (`/data/nginx/custom/server_proxy.conf`).

- [ ] Refactor: colapsar los dos call sites de `fetchAllPages` en `processStatementMeta` (mismos filtros, solo cambian select y bounds de fecha) en un helper `fetchAccountTxs`; idealmente extraer el bloque de anclaje+validación (~140 líneas) a `resolveSavingsBalance()`.
- [ ] Refactor: calcular un único `anchoredBalance: number | null` tras el bloque de anclaje y usarlo en los dos sitios de escritura (currency_balances + current_balance) — elimina los fallbacks `?? meta.summary.final_balance` inalcanzables y los `!` dobles.
- [ ] Refactor: helper privado `replayBalanceDeltas()` en `statement-import.ts` — `anchorStatementBalance` y `validateStatementPeriodBalance` duplican el mismo fold + redondeo.
- [ ] Hueco conocido de dedup: correo tier-2 con fecha corrida ≥2 días y texto distinto a la fila del PDF sigue bajo el umbral REVIEW; la garantía de saldo lo delata pero no lo empareja. Evaluar piso para tier-2 con monto exacto.

## Recurrentes fix (PR #357, 2026-07-04) — follow-ups

- [ ] **Chunk del `.in()` en la poda de ocurrencias** — `ensureOccurrencesForRange` embebe `prunableIds`/`staleIds` en el query string de PostgREST sin límite; con muchísimas plantillas podría exceder el largo de URL. Baja probabilidad (candidatos acotados por rango). Trocear en lotes como hardening. (server-action-reviewer, MEDIUM)
- [ ] **Residuo al editar BIWEEKLY→MONTHLY** — una plantilla editada a MONTHLY queda excluida de la poda, así que filas pending viejas del schedule anterior en el rango no se limpian (el dedup mensual solo suprime inserts). Documentado como aceptable; revisar si aparece en soporte. (server-action-reviewer, LOW)

## Unification layer — Fase 1 Veredicto (PR #355, 2026-07-04) — follow-ups

Shipped: `<Verdict />` + convergencia de los 4 dialectos de estado (dashboard, plan, presupuesto, deudas, recurrentes), `deriveRitmoStatus` 4-state (umbral cerca 0.85→0.75), helper `deriveDebtVerdict`, 8 archivos muertos borrados. Specs + plan completo: `claude-ai-design/unification-layer/` (ANALYSIS.md §5 = plan por fases con archivos).

- **(P1) Fases 2–4 del handoff**: F2 Marco (`<MonthControl />` + header canónico + `<Disclosure />` + motion tokens + borrar dim, ~45 call-sites), F3 Densidad (`chartTheme` + rebind `--chart-*` + `<GroupSummary />` + ladder V1–V4 + AccountDot), F4 Calidez (3 celebraciones + residue rows). Plan archivo-por-archivo en ANALYSIS.md §5.
- **(P2) Tipado end-to-end del verdict en Plan**: agregar `state: VerdictState` a `PlanHeroSummary` (`webapp/src/types/plan.ts`); hoy viaja como intersección sin tipar en `PlanPageData`. Y cambiar `actions/plan.ts:17` a `import type { VerdictState } from "@zeta/shared"` (hoy importa de `@/components/ui/verdict`).
- **(P2) Confirmar efecto mobile del cambio en `ritmo.ts`**: la app RN (`mobile/components/inicio/HybridHero.tsx`) recibe silenciosamente el nuevo umbral 0.75 y el copy "Cerca del límite" (antes "Vas justo") sin cambio de código mobile. Probablemente deseable; smoke test en simulador antes de release.
- **(P2) Smoke test `/deudas` con amortización negativa** (interés > cuota): debe mostrar "Te pasaste" — era el blocker del review (verdict hardcodeado).
- **(P3) Copy**: "Llevas el X% de tu ingreso gastado." → "Llevas gastado el X% de tu ingreso." (`actions/plan.ts:122`).
- **(P3) `perf-auditor` gate** no corrió sobre el diff de Fase 1 (cambios de paint mayormente; correrlo con la Fase 2 que toca más superficie).
- **(P3) Pre-existente**: eslint `react-hooks/preserve-manual-memoization` en `mobile-recurrentes-view.tsx:158` (ya estaba en HEAD).

## Nu savings parser (PR #353, 2026-07-03) — follow-ups

- **Patrón de transacciones sin validar**: `nu_savings.py` parsea la sección "Movimientos" con un patrón tentativo (fecha + descripción + monto + saldo) — el único extracto real disponible tenía cero movimientos. Cuando llegue un extracto Cuenta Nu con movimientos, validar el patrón contra el PDF real y ajustar (buscar `ponytail:` en el archivo).

## Mobile parity wave 2026-07-02 — follow-ups (PRs #346–#349)

Shipped: fix auth social EAS env (#346), Settings Etiquetas+Perfil (#347), Suscripciones → tabla `subscriptions` (#348), Destinatarios D3 fusionar + D4 sugerencias + fix logout wipe (#349).

- **(OPERADOR — bloqueadores de auth en prod, consolas externas)**
  - Supabase → Auth → Providers → **Apple: habilitar** (error observado: `validation_failed: Unsupported provider`). Rellenar Services ID/Team ID/Key ID/.p8.
  - Google Cloud → Credentials → crear **Android OAuth client** para `com.venti5.zeta` con SHA-1 de firma (`eas credentials` + Play App Signing SHA-1 de Play Console) — `DEVELOPER_ERROR` observado en build prod Android.
  - Supabase → Google provider → "Authorized Client IDs" debe incluir el **Web** client id (audiencia de Android) y el iOS id.
- **(P1) Suscripciones mobile — writes faltantes:** `runSubscriptionDetection` tras imports mobile (hoy solo corre en imports webapp → usuarios mobile-only nunca ven sugeridas); `upsertSubscriptionFromTemplate` / flag `is_subscription` en create/edit de recurrentes mobile (el empty state apunta a Recurrentes pero ahí no se puede marcar como suscripción).
- **(P1) Settings subpáginas restantes:** Integraciones (`capture_tokens` remote-only, mirror `pending-email.ts`; necesita `TELEGRAM_BOT_USERNAME` en config Expo), Email (address + allowed-senders, remote-only; `EMAIL_INGEST_DOMAIN` en config), PDF-passwords (vista encriptada, remote-only, NUNCA persistir plaintext local — su propio PR). Plan detallado en transcript sesión 2026-07-02.
- **(P2) Etiquetas mobile:** UI de rename de tags (`updateTag` webapp sin par mobile) + rename de grupos (repo `updateTagGroup` ya existe, sin UI).
- **(P2) D4 accept sin picker de categoría** (webapp lo tiene opcional; parity-neutral en datos).
- **(P2) Reuse debt:** `FieldLabel` compartido (3 copias) + `SegmentedRow` variante wrap; `generateSlug` a `@zeta/shared` (port manual en `mobile/lib/repositories/tags.ts` puede driftar); `StateChip` variante `muted` (StatusBadge local en subscriptions.tsx); consolidar pill-trays ad-hoc sobre `PANEL_INSET_CLASS`.
- **(P2) Guard `(user_id, lower(pattern))`** en otros paths de inserción de `destinatario_rules` (merge ya defiende; revisar create/import).
- **(P1 — activación) Helpers mobile faltantes** (audit 2026-07-02): `EmptyState` compartido RN (~20 empty states ad-hoc sin CTA) e `InfoHint` (ambos client-only, quick wins); "Primeros pasos" checklist mobile (necesita estado `guidedExperience` sincronizado — gates parity/sync); coach-marks; exchange-rate nudge.
- **(Diseño) Brief de evolución entregado** → `claude-ai-design/design-evolution-brief-2026-07-02.md`. Próximo: correr T1 (sistema de veredicto unificado) en Claude Design con Fable 5; heroes objetivo: deudas/recurrentes/plan.

## Plan de periodo UX + quincenal (branch `claude/period-plan-page-ux-dvwrxi`, 2026-07-02) — follow-ups

- **(P1) `seedPeriodFromRecurring` no reconcilia fechas viejas:** dedup solo por `(template_id, expected_date)` e insert-only — periodos existentes con entradas BIWEEKLY sembradas en fechas desfasadas (regla vieja de 14 días) duplicarán líneas al re-sincronizar. Fix: podar entradas `PLANNED` con `recurring_template_id` cuya `expected_date` ya no esté en el set de `getOccurrencesBetween` del periodo (nunca tocar `COMPLETED`/vinculadas). Detalle en review recurring-doctor 2026-07-02.
- **(P1 — parity) Cargos a tarjeta en móvil:** `mobile/app/periodo.tsx` es implementación SQLite independiente (no reusa `EnvelopeBoard`); replicar la exclusión de cargos a tarjeta (template OUTFLOW + cuenta deuda) de comprometido/sin-asignar/auto-asignar. Gate `mobile-webapp-parity` antes de tocar.
- **(P2) `period-hero.tsx` `pendingCount`** cuenta cargos a tarjeta en "N gastos por pagar" aunque no descuentan de efectivo — excluirlos o re-etiquetar para consistencia de mensaje.
- **(P2) Deuda de diseño del envelope board (preexistente):** fondo `bg-card` difiere del spec Tier 2 (`bg-[#111]`) en expense-entry-row + income-envelope-card; `envelope-colors.ts` usa paleta stock de Tailwind (no z-brand); `ROW_EXPAND_TRIGGER_CLASS` podría ganar variante para headers de dos líneas.

## Modo compartido F1 (branch `feat/modos`, 2026-07-01) — follow-ups

Shipped F1: un modo puede ser pool de gastos compartidos single-user (Estefa = destinatario). `modos` += `is_shared/split_method/user_included` + tabla `modo_participants`; acciones `shareModoTransactions`/`unshareModoTransactions` (batch) reusan `splitExistingTransaction`; resumen con "Saldo por persona" + abono. Spec: `docs/superpowers/specs/2026-07-01-modo-compartido-design.md`, plan: `docs/superpowers/plans/2026-07-01-modo-compartido-f1.md`. Migración `20260701190000_modo_compartido.sql`.

- **(Fase 2 — couples reales) El pool como objeto multi-usuario.** Invitar a la contraparte como usuario real: `modo_participants` += `member_user_id` + `invite_status` (pending/accepted), flujo de invitación por email, RLS de 2º usuario, y **publicación de entradas del pool** (monto + descripción + reparto + settle-up) a un store legible por el miembro vía RLS — NUNCA la tx origen ni el ledger privado (muro de cifrado por-usuario). Realiza el backlog `shared_pools`/`pool_members`/`pool_allocations`. Decisión de cifrado de las entradas (plano-para-miembros vs por-clave) se define en su propio spec. El modo = pool, `modo_participants` = miembros (forward-compat ya en el schema).
- **(P1) Abono multi-deuda por persona.** Hoy "Registrar abono" salda la deuda activa más antigua (FIFO) con tope = saldo de ESA deuda. Una persona con N pagos compartidos en el modo requiere N abonos. Añadir allocation de un abono único repartido FIFO entre las deudas activas de esa persona (nueva acción o extender `recordRepayment`).
- **(P2) `updateModo`/`createModo` participantes no atómicos.** delete-all + re-insert sin transacción; un insert fallido tras el delete deja el modo con 0 participantes (devuelve error, recuperable). Envolver en RPC/transacción si molesta.
- **(P2) Editar modo no está cableado en UI.** `updateModo` existe pero ningún trigger de "Editar" lo invoca; al cablearlo, pasar `initialParticipants` (de `getModoSummary().participants`) al `ModoFormDialog` para prefill.
- **(P2) `shareModoTransactions` reparto secuencial.** Loop `await` por tx (2 round-trips c/u). OK para decenas; si un modo escala a cientos, `Promise.all` acotado (chunks ~10).
- **(P1 — mobile parity) `modos`/`modo_participants` son webapp-only.** Correr `mobile-webapp-parity` + `mobile-sync-doctor` antes de cualquier trabajo de modos en móvil (enum/columna drift, la tabla nueva no está en SQLite).

## ★ Mobile↔webapp parity redesign — roadmap (2026-06-29)

Full 3-cluster audit → `docs/audits/2026-06-29-mobile-parity-redesign-roadmap.md`. Root cause: mobile
ships the read/consume half of most surfaces, omits the author/manage half. Tackle by phase (each = own PR):

- **P0 redesigns:** **Budget** (legacy flat list → verdict hero + 50·30·20 + "Armar presupuesto" builder),
  **Tendencias** (missing entirely — net-new screen, `@zeta/shared/analytics` is portable),
  **Recurrentes** (create + edit forms missing entirely).
- **Phase 0 quick wins:** Pendientes notification deep-link → `/recurrentes` (S); Accounts net-worth
  COP-hardcoded **bug** (S); Capture destinatario picker — select existing (M); Etiquetas screen orphaned.
- **P1 authoring/correctness:** Destinatarios authoring; Settings subpages (perfil/integraciones/email/
  pdf-passwords); **Suscripciones** off the `subscriptions` table (correctness); Import (loan/OCR/multi);
  Categorizar auto-review; Dashboard PrimerosPasos; Plan resumen zone.
- **P2/P3 polish:** Deudas secondary widgets + Personas writes; Categories manager; Deseos reflexiones;
  tx filters + detail account-reassignment; Puedo-pagar copy.

## Pago compartido — mobile parity (2026-06-30)

The webapp "Pago compartido" (Splitwise split-ledger) shipped on `claude/shared-payment-debt-duq182`
(migration `20260630120000` already APPLIED to prod; columns `split_group_id` exist on
`transactions` + `personal_debts`). Mobile parity was implemented + reviewed by `mobile-sync-doctor`
but pulled out of the webapp PR to ship separately. **The work is preserved on branch
`mobile/shared-payment-parity` (cherry-pick / open its own PR) — don't redo from scratch.**

Two parts on that branch:
- **(P1, correctness BUG)** `mobile/lib/repositories/transactions.ts` `getMonthlyAggregates` and
  `mobile/lib/repositories/budgets.ts` `getBudgetProgress` must exclude `pd_role='origin'` legs
  (`AND (t.pd_role IS NULL OR t.pd_role != 'origin')`) — mirrors the webapp net-out fix. Without it
  the mobile cashflow hero + budget spend inflate by the lent portion of every shared payment
  (N× per payment). Latent since personal-debts; this feature amplifies it.
- **(P2)** SQLite migration **v23** (`mobile/lib/db/schema.ts`) adds `split_group_id TEXT` to
  `transactions` + `personal_debts` so the sync upsert (allow-list by local columns) stops silently
  dropping the column. No mobile WRITE path yet — read parity only (mobile reads webapp-created
  shared payments). Mobile create/split UI is a later phase (tracks with Personas mobile writes).
  **Ampliado (2026-08-06):** `splitPersonalDebt` (dividir una deuda existente entre varias personas)
  es un SEGUNDO productor de filas con `split_group_id`, además del flujo original de pago compartido.
  El volumen de filas que llegan a móvil sin ese campo crece más rápido; la paridad de lectura sigue
  degradada (no se pueden agrupar hermanas ni derivar `recovered`), no rota — el upsert descarta la
  columna desconocida, no la fila.

## Pago compartido — riesgos de reconciliación + abono (2026-06-30, post-rediseño)

El rediseño a "1 transacción + gasto dinámico" (`split_repaid_amount`) arregló la duplicación en import.
Residuales detectados por los gates (`import-flow-doctor`, `server-action-reviewer`):
- **(P1) Net-out se pierde tras reconciliar (solo modo "nuevo" + import posterior):** si creas un pago
  compartido manual y luego importas el extracto con ese pago, la reconciliación deja la tx del banco
  como sobreviviente **sin** `split_group_id`/`split_repaid_amount` (la manual queda
  `reconciled_into_transaction_id`). Las métricas cuentan el sobreviviente → vuelven a mostrar el monto
  completo, no el efectivo. Las deudas y la UI del grupo NO se rompen (leen vía `origin_transaction_id`).
  Fix: al reconciliar una tx con `split_group_id`, transferir `split_group_id`+`split_repaid_amount` al
  sobreviviente y re-apuntar `personal_debts.origin_transaction_id` (en `import-transactions.ts` merge ~L1330).
  El modo "existente" (repartir una tx ya importada) NO sufre esto.
- **(P2) Desfase de fecha en reconciliación:** banco postea 2–3 días después + descripción distinta →
  score 0.65 → NO_MATCH → duplicado. Limitación pre-existente de `reconciliation.ts` (afecta cualquier tx
  manual). Mitigación: ampliar la ventana de fecha para tx MANUAL_FORM, o pedir fecha de causación.
- **(P2) Cap de abono:** `recordRepayment` no limita el abono al `outstanding` de la deuda (solo `>0`).
  `recomputeSplitRepaid` ya hace clamp a Σ principales (evita gasto negativo), pero el `outstanding` de la
  deuda individual puede sobre-abonarse. Considerar validar `amount ≤ outstanding` en el schema/acción.
- **(P3) Limpieza:** `isPersonalDebtOrigin` (`@zeta/shared/personal-debt.ts`) quedó muerto (solo su test);
  encoda la semántica vieja "abonos cuentan como cashflow". Borrar para evitar mal uso.

## Pago compartido — factura persistente / storage (2026-06-30)

V1 (full-page wizard) attaches the invoice as a **client-side reference only** — `URL.createObjectURL`
shown in the zoom/pan viewer while filling values, discarded on submit/leave. Nothing is uploaded.
Persisting it is deferred because storage cost could become a paid/subscription feature.

When building the persisted version:
- **Storage**: private bucket `shared-payment-invoices` + table `public.shared_payment_invoices`
  (`user_id`, `split_group_id`, `storage_path`, `mime_type`, `file_size_bytes`). The migration SQL +
  the exact `database.ts` type block were already drafted by `supabase-migrator` (in the
  2026-06-30 session transcript) following the `bug-reports`/`design-reviews` storage-policy
  convention (`(select auth.uid())::text = (storage.foldername(name))[1]`, 4 ops). Re-generate.
- **Resize + readability confirmation** before upload (compress client-side, ask the user to confirm
  the receipt is legible) to cap storage size — only relevant once we actually upload.
- **Upload flow**: create split → browser upload to `<user>/<split_group_id>.<ext>` → `attachSharedPaymentInvoice`
  server action inserts the metadata row. `getSharedPaymentGroups` adds a 1h `createSignedUrl`;
  `shared-payment-card.tsx` shows a thumbnail/"Factura" button → opens `ImageZoomPan` in a Dialog.
- **Retroactive attach/replace** the invoice from the card (v1 is attach-at-create only).
- **Mobile**: view the invoice on the native app (mobile reads shared payments; viewer is later).
- Reuse the existing `webapp/src/components/ui/image-zoom-pan.tsx` (shipped in v1) for all viewers.

## Keyboard-aware input sweep (2026-06-29) — coverage remaining

Adopted `docs/design-system/keyboard-handling.md` as the standard + added the coverage rule to the
`mobile-perf-doctor` agent (§7.5).

**Done:**
- `capture.tsx`, `import.tsx` pick step, `DestinatariosRoot`, `DeseosRoot` → `AppKeyboardAwareScrollView`.
- **All MobileSheet form sheets, via ONE central fix** — `MobileSheet.tsx` wraps its Modal in a
  `KeyboardAvoidingView` (bottom-anchored → padding lifts the sheet). Covers `CategoryFormSheet`,
  `ReassignSheet`, `CategoryZonePickerSheet`, `MovimientosUtilidades`, + FabMenuSheet / AccountPickerModal.
- `account/create.tsx` + `account/edit/[id].tsx` were ALREADY handled (wrap in `KeyboardAvoidingView`) —
  the audit false-flagged the `AccountFormFields` fragment; its parents cover it. No change needed.

**Remaining:**
- **Upgrade MobileSheet's RN `KeyboardAvoidingView` → keyboard-controller's** (UI-thread) once the
  nested-`KeyboardProvider`-in-Modal pattern is validated on a real device. RN's is the modal-safe baseline.
- **Verify on a real device** — sim ≠ device for keyboard timing (and idb automation suppresses the soft
  keyboard entirely; see the guide's Project notes). Nothing here is sim-verifiable.

## Mobile RN polish review (on-device screenshots, 2026-06-29)

From 13 device screenshots. Severity-ranked:

- **[DONE] CategoryZonePicker icon names as text** — fixed via the new `CategoryIcon` (name→lucide map);
  the whole flat picker was replaced by the rich zone grid (icons + child counts + income/expense filter).
- **[DONE] Auto-scroll-on-expand** — zone picker scrolls the tapped zone to top on expand (+ LayoutAnimation
  on collapse); BudgetsRoot scrolls the focused budget-edit row above the keyboard on input focus.
- **[DONE] Transaction-detail redesign (header safe-area + Destinatario wrap + webapp card parity)** —
  `transaction/[id].tsx` now honors `insets.top`; DetailRow dropped the fixed `w-20` label (no more
  "Destinatari/o"); read-only view regrouped into Clasificación + Detalles cards with a category
  icon-circle hero (mirrors the webapp detail).
- **[DONE] P3 polish** — eyebrow tracking tightened (PlanToolsChips/MovimientosLectura 4px→1px,
  ChipEyebrow 4px→2px); AccountCard `ellipsizeMode="middle"` keeps the mask; periodo income titles
  `numberOfLines` + middle-ellipsis.

## Mobile budget page — webapp redesign parity (2026-06-29, screenshots)

The mobile Presupuestos page is the OLD design (Control mensual + flat inline-edit list). The webapp got
the **budget-participativa** redesign — port it to mobile (this is the existing budget-participativa
mobile-parity item, now with on-device references):
- **Hero** — "GASTADO ESTE MES" + an EN CONTROL/ATENCIÓN/EXCEDIDO state pill + big % + spent/target +
  "Necesario / Deseos / 50·30·20" breakdown.
- **"Armar presupuesto" builder** — the guided wizard: Σ assigned-of-income with "quedan", per-category
  lines (Base + named sub-lines), "Desde transacciones" derive, quick-add chips (prom $), "+ Agregar
  categoría", "Guardar presupuesto".
- **"Simular un cambio"** entry; **DENTRO DEL LÍMITE / SIN LÍMITE** grouping with counts; **Restante** row.
- Source of truth lives in the webapp budget actions; mirror the data shapes + side-effects (parity gate).

## Mobile parity Wave 1 — foundation P0s (branch `feat/mobile-parity-foundation`, 2026-06-29) — gate follow-ups

Shipped the 9 foundation P0 data-integrity fixes (balance deltas on create/edit/delete, idempotency+installment key, tags `user_id` sync, categorize learning + `category_rules` v19, PDF-import balance overwrite + `statement_snapshots` mirror v20, app-wide occurrence auto-linking). All `tsc` clean; `mobile-sync-doctor` = SAFE TO SHIP, `mobile-webapp-parity` = parity-mostly-OK; blocking/cheap findings fixed inline. Deferred (from the two gates):

- **[P1] PDF import doesn't write account detail columns** (`mobile/lib/repositories/ledger-helpers.ts` applyStatementMetaBalance + `import.tsx`). Webapp `processStatementMeta` writes `accounts.credit_limit` / `interest_rate` (sanitized via `sanitizeInterestRate`) / `monthly_payment` / `payment_day` (derived from `payment_due_date`) on import; mobile writes only `current_balance`/`available_balance`/`currency_balances`. Effect: an auto-created CC has `credit_limit=null`, so later per-tx `available_balance` recomputation (`buildDebtBalanceUpdatePayload`) drifts until the next import re-sets it (bounded, self-healing). Fix: extend `runAccountBalanceUpdate` to accept those columns (or a separate account UPDATE after the balance write) + derive `payment_day` + sanitize the rate.
- **[P1] No recurring-template sync on CC/loan import** (`import.tsx`). Webapp calls `syncCreditCardRecurringTemplate` / `syncLoanRecurringTemplate` after the snapshot (auto-creates/updates the "Pago TC" monthly template from `minimum_payment` + due date). Mobile upserts the snapshot but not the template. Port a local `recurring_transaction_templates` upsert. (Pairs with the item above — same import block.)
- **[P2] `last_synced_at` not written to the account on import** (webapp `import-transactions.ts` ~908). Display-only metadata; add to the account payload at import.
- **[P2] Snapshot `interest_rate` stored raw, not sanitized.** `upsertLocalStatementSnapshot` stores the parser's `interest_rate`; webapp sanitizes (M.V.→E.A. + bounds) for the snapshot too. Run `sanitizeInterestRate` before storing if a wrong-scale rate shows in snapshot UI.
- **[P2] Snapshot `source_filename` always null on mobile** — the parsed-statement response (`ParsedStatement`) carries no filename; thread the picked document name through if useful.
- **[P2] Cross-device snapshot duplicate edge** — device B re-importing the same statement BEFORE pulling device A's snapshot row INSERTs a 2nd remote row (no remote unique on the natural key; webapp reads authoritative DB so never hits it). Now that mobile pulls `statement_snapshots`, the window is small. Display redundancy only.
- **Accepted divergences (no action, documented):** mobile `category_rules.match_count` increments vs webapp reset-to-1 (mobile is more accurate); per-tx balance delta pushes `available_balance`+`currency_balances` for debt accounts vs webapp's `current_balance`-only (mobile is more complete; watch for flip-flop if both platforms do per-tx updates on the same account between syncs).
- **[P2] Local `categories` schema drift — `is_active` + `updated_at`** (found by `mobile-webapp-parity` on the budget-builder `createCategory`, branch `feat/mobile-budget-armar-lines`). SQLite `categories` lacks `is_active` (webapp soft-deletes via `is_active=false`; mobile pulls can't store it → deactivated categories stay visible locally forever) and `updated_at` (so future mobile category UPDATEs hit `isLocalFresh`'s no-`updated_at` escape hatch and always overwrite — no conflict resolution). `direction` was the create-blocking one and is fixed in this PR (v22). Fix: `ALTER TABLE categories ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1` + `ADD COLUMN updated_at TEXT`, and have CategoriesRoot's edit write `updated_at` locally too.
- **[P2] Local `accounts` missing `is_demo`** (found by `mobile-webapp-parity` on Tendencias, branch `feat/mobile-tendencias`). Mobile `accounts` has no `is_demo` column, so webapp demo accounts pull down as regular accounts. Low risk (mobile has no demo mode), but analytics/aggregates can't exclude demo-account data the way the webapp does. Fix: `ALTER TABLE accounts ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0` (next migration — v23 is now the analytics index) + add `"is_demo"` to `BOOLEAN_FIELDS.accounts` in `pull.ts` + `AND a.is_demo = 0` in `getTendenciasDataset`'s accounts subquery.
- **Mobile recurrentes authoring (create + edit) — DONE** (branch `feat/mobile-recurrentes-authoring-v2`; all gates clean). `createRecurringTemplate` (pre-existing) + new `updateRecurringTemplate`; `RecurringForm` reused by `/recurrentes/new` + `/recurrentes/[id]/edit`; "+ Nueva" + "Editar plantilla" (confirm sheet) entries. Parity: `day_of_month`/`day_of_week` null-on-create / preserved-on-edit is byte-identical to the webapp (generator anchors on `start_date`); debt-INFLOW auto-category; pending occurrences' `expected_amount` synced on amount edit (mirror `syncPendingOccurrenceAmounts`). Deferred: (a) **subscription sync** — webapp `upsertSubscriptionFromTemplate` on create/edit; mobile never registers / leaves stale the `subscriptions` row (feature gap, not corruption); (b) **`sub_payments`** multi-currency for debt abonos — also a sync column drift (`recurring_transaction_templates.sub_payments JSONB` on Supabase, absent in mobile SQLite → pulls drop it; fix when implementing: `ALTER TABLE recurring_transaction_templates ADD COLUMN sub_payments TEXT` + `recurring_transaction_templates: ["sub_payments"]` in `JSON_FIELDS` of `pull.ts`); (c) **ghost occurrences** on schedule change (additive-only generator — symmetric with webapp); (d) extract duplicated `FieldLabel` (capture.tsx + RecurringForm) → `components/ui/FieldLabel.tsx`.
- **Mobile destinatarios authoring — D1 (edit) + D2 (rule mgmt) — branch `feat/mobile-destinatarios-edit`** (PR #336; all gates clean). D1: `updateDestinatario` (encrypted view — name_hmac server-side) + edit screen. D2: `addDestinatarioRule`/`deleteDestinatarioRule` + editable REGLAS section (add form Contiene/Exacto + duplicate pre-check matching Supabase `UNIQUE(user_id, lower(pattern))` + min-2-char guard; trash-delete w/ confirm). Deferred:
  - **D3 merge** — webapp `mergeDestinatarios` (`webapp/src/actions/destinatarios.ts:602`) re-points `transactions.destinatario_id` + `destinatario_rules.destinatario_id` source→target, relabels `transactions.merchant_name` to the target name, then deletes the source. Mobile build: a `mergeDestinatarios(sourceId, targetId)` repo fn (local UPDATE transactions/rules from source→target + DELETE source, each row `enqueueUpdate`/`enqueueDelete`) + a "Combinar" action on the detail → target picker (list other destinatarios). Watch: per-row enqueue for re-pointed tx/rules; the `UNIQUE(user_id,lower(pattern))` constraint if both have the same rule pattern (dedup before re-point).
  - **D4 Sugerencias** — webapp `getUnmatchedDescriptions` (`destinatarios.ts:851`) + the suggestions tab. Mobile build: query distinct `merchant_name` from `transactions WHERE destinatario_id IS NULL` (group, order by count desc) + a Sugerencias surface → one-tap create via the existing `createDestinatarioWithPattern` (name = merchant, pattern = merchant). Read-only data + a create write that already exists — lowest-risk of the two.
  - (c) `kind` editing (column synced but no mobile UI — edit preserves via PATCH); (d) **[minor] `destinatario_rules.priority` SQLite default 0 vs Supabase 100** (no-op today — callers always pass 100; needs a table-recreate migration to align); (e) `createDestinatarioWithPattern` lacks the same duplicate-pattern pre-check (`mobile-webapp-parity` — narrower scenario; apply the D2 check there too).
- **[P2] Form screens should use `useEffect`, not `useFocusEffect`, to load initial data** (Gemini on #336). `useFocusEffect` reloads on refocus → silently clobbers unsaved form input. Fixed in `destinatarios/[id]/edit.tsx`; the recurrentes `app/recurrentes/new.tsx` + `app/recurrentes/[id]/edit.tsx` (merged in #334) have the same pattern — switch them to `useEffect([load])` too. (List/detail screens keep `useFocusEffect` — they WANT refresh-on-focus.)
- **Mobile Tendencias — T4 (drill-down + search) — DONE** (PR #332, T3+T4). Flat-list drill-down (tap category/recipient row → `AnimatedAccordion` + lazy `DrilldownTransactions` via `getDrilldownTransactions`) + `foldForSearch` search on both lists. Follow-ups deferred:
  - **Parent/child category hierarchy** — mobile drills each flat `categorySeries` row straight to its tx; the webapp `CategoryTrendList` nests subcategory rollups via `buildCategoryHierarchy` (+ a synthetic "(directo)" leaf). Port `categoryHierarchy` into the dataset for true nesting.
  - **Dense drill-down deep-link** — the inline drill-down caps at 25 tx (accordion `estimatedHeight` bound). Add a "Ver todos los movimientos →" row → Movimientos pre-filtered by category/recipient + date range.
  - **[polish] Chevron rotation** — drive the row `ChevronDown` via `useAnimatedStyle` on the accordion's `progress` shared value so it rotates in sync instead of snapping (`mobile-perf-doctor` LOW).
- **[P2] Tendencias recipients "Ver todas" — dedicated screen for 120+ merchants** (`mobile-perf-doctor` on T3). The inline "Ver todas" mounts all recipients synchronously in the ScrollView — fine at the typical 20–80, but a 200+ merchant user over 12M would mount ~1800 views in one frame. Route `recipients.length > ~120` to a FlatList-backed `/tendencias/recipients` screen with `getItemLayout`. Same concern would apply to the category list "Ver todas" at extreme category counts.

## Recurring debt charge vs abono (branch `claude/recurring-debt-transaction-type-cqq89p`) — deferred

Shipped: debt-account recurring templates can now be a **Gasto con la tarjeta** (OUTFLOW charge) or **Abono a deuda** (INFLOW transfer), discriminated by `direction`. `/code-review` surfaced two non-blocking follow-ups (no current bug):
- **DRY: extract `isDebtAbono(accountType, direction)` into `@zeta/shared`.** The predicate `isDebtAccountType(type) && direction === "INFLOW"` is hand-reimplemented at ~15 sites (webapp: `recurring-templates.ts` ×4, `recurring-list.tsx`, `recurring-template-card.tsx`, `upcoming-recurring-card.tsx`, `use-recurring-month.ts`, `cashflow-planner.ts`, `burn-rate.ts`, `charts.ts`, `mobile-recurring-manager.tsx`; mobile: `RecurringConfirmSheet.tsx`, `recurring.ts` ×2, `capture.tsx`). All agree today; a future change to the rule must touch every copy. Add one helper and sweep all sites. Three webapp sites also inline the literal `=== "CREDIT_CARD" || === "LOAN"` instead of calling `isDebtAccountType` — fold those in too.
- **`confirmIncomeReceived` occurrence link has no `.order()`** (`cashflow-planner.ts` ~1586). The `recurring_occurrences` lookup uses `.limit(1)` with no ordering, so a template with multiple pending occurrences in one period (e.g. quincenal income inside a monthly period) links to an arbitrary one instead of the date-nearest. Self-correcting / cosmetic. Pre-existing (not introduced by this branch). Add `.order("occurrence_date")` and pick nearest.

## Tendencias interactivity (branch `feat/tendencias-drilldown-search`) — deferred polish

Shipped: inline category/recipient drill-down (2-level / 1-level accordions), per-card search + "Ver todas", `getDrilldownTransactions` cached action, `destinatarioId` transactions filter, hero/lens mobile fixes, and short periods **Semana (WTD)** + **Mes (MTD)**. Deferred (cosmetic, non-blocking):
- **Sub-month hero/deltas.** The hero "Gasto prom/mes" + MoM `DeltaChip`s assume monthly buckets; for `Semana`/`Mes` (1–2 month buckets) the per-month average and MoM read oddly (e.g. a 7-day window split across a month boundary). Options: relabel the hero stat per range, or suppress MoM/sparklines when `months.length < 2`. `range.ts` returns the real (short) window so nothing breaks — presentation only.
- **Cross-card / merchant-text search.** Category card searches categories, recipient card searches recipients; no unified or merchant-text search (out of original scope).
- **Visual QA at 375px** not run in-session (build + design-review verified the responsive classes; no live screenshot).

## Plan living timeline (branch `feat/plan-living-timeline`) — deferred polish

Shipped the living-timeline redesign of the Periodo plan. Review agents flagged these as acceptable follow-ups (none block the feature):
- **Perf H1 — `EnvelopeBoard` double-mounts.** `MobilePeriodoView` wraps `EnvelopeBoard` and the desktop path also renders it; both mount via CSS hiding. Partly inherited from `plan/page.tsx`'s `lg:hidden`+`DesktopOnly` pattern. ~5ms + lightweight closed dialogs at current scale. Fix: make `MobilePeriodoView` layout-only, render one `EnvelopeBoard` beneath both shells; consider a `MobileOnly` companion to `DesktopOnly`.
- **Perf M3 — memoize cards.** `React.memo` on `IncomeEnvelopeCard`/`ExpenseEntryRow` once a list exceeds ~30 items.
- **zetas tier polish (pre-existing).** `income-envelope-card` `bg-card`/`rounded-xl p-4`, `expense-entry-row` `rounded-lg bg-card/50`, confirm-dialog candidate rows mix tiers — align to a defined card tier.
- **Desktop Flujo chart** not added yet (only mobile collapsible). Add under the desktop hero (expanded), drop the duplicate Ingresos/Gastos/Neto footer, lift the "Saldo negativo proyectado" danger banner so it shows even collapsed.
- **Mobile Ingresos/Gastos tabs** — design had them; current mobile stacks the board. Add if the stacked view feels long.

## Budget participativa — mobile parity (webapp branch `feat/budget-creation-participativa`, 2026-06-28)

The participatory budget-creation flow shipped on the **webapp** (wizard→builder, line breakdown + calculator, "Desde transacciones" categorize-and-fill, 50/30/20 nested sets, `budget_mode="50_30_20"`, mode-on-save, month-selector hidden during setup). Mobile must mirror it (webapp = source of truth). Findings below from a code-level parity scan of `mobile/`. Spawn `mobile-webapp-parity` + `mobile-sync-doctor` before building.

### P0 — data / enum drift (fix before any mobile budget write)
- **`budget_mode` column + sync** (`mobile/lib/db/schema.ts`, `mobile/lib/sync/pull.ts`): local `profiles` has no `budget_mode`, so `pull.upsertRow()` (filters by `tableColumns.has(col)`) **silently drops** the value the webapp writes — incl. the new `"50_30_20"`. Add the TEXT column (ALTER migration) + ensure no enum/switch throws on `"50_30_20"` (treat as free text). Without it mobile can't replicate the gate, mode-aware UI, or read the chosen mode.
- **Budget write sets `budget_mode`** (`mobile/lib/repositories/budgets.ts`, `mobile/lib/profile.ts`): mobile budget creates never touch `budget_mode`. Add a `setBudgetMode`-equivalent (UPDATE profiles + `sync_queue`) and call it whenever a budget is first created — else remote ends with budgets present but `budget_mode` NULL → the **webapp re-shows the creation wizard** (gate `!budgetMode || withBudget===0`). Cross-platform repeated-onboarding corruption.

### P1 — feature parity (the participativa flow is largely absent on mobile)
- **Creation wizard** (new): 2-step (income → 3-mode horizontal style picker) mirroring `budget-wizard.tsx`; persist income via a mobile `updateEstimatedIncome` (column exists locally); carry mode+income into the builder; do NOT set `budget_mode` on exit (only on save). Mobile has no income capture / mode selection today.
- **Builder by lines** (`mobile/components/budgets/BudgetsRoot.tsx`): replace the flat single-amount-per-category model with start-empty + add-category + per-category line breakdown (calculator input, per-line remove) + atomic save (bulk upsert + delete-diff **+** `setBudgetMode` + `updateEstimatedIncome`), mirroring `applyBudgetComposition`.
- **Category picker** (new, ~`budget-category-add-sheet.tsx`): "+ Agregar categoría" so users can budget ANY category — cold-start blocker: today the empty state literally says "créalos en la web". Mobile has no first-time creation for zero-spend categories.
- **Derive-from-transactions + categorize** (new, ~`budget-tx-picker-sheet.tsx`): list uncategorized tx (`getTransactions({uncategorizedOnly})` exists), multi-select, **categorize** them into the target category (queue sync), return the abs summed amount to prefill the line. Mobile has the building blocks but no UI; the categorization side-effect (feeds dashboards) never happens on mobile today.
- **50/30/20 mode + allocation sets**: when `mode==="50_30_20" && income>0`, group into needs/wants/savings with informative (warn-not-block) caps. **Port `groupCategoriesByAllocationSet` + `AllocationSet` + `BudgetMode` into `@zeta/shared`** (`categoryBudgetGroup` is already there) so both platforms share ONE grouping rule — else silent allocation drift.

### P2 — polish / forward-compat
- **Month-selector during setup** (`BudgetsRoot.tsx`): hide `<MonthSelector>` until a saved budget exists (mirror `getHasSavedBudget()`); meaningless during first-time setup.
- **Guided/empty-state copy**: mobile has no guided module; note that IF mobile adds guided onboarding it must key the budget step off **saved-budget-row count**, not `budget_mode` (the webapp bug we just fixed). Update the "créalos en la web" empty-state copy once mobile creation lands.

## Mobile ↔ Webapp parity audit (2026-06-25, branch `audit/mobile-web-parity-2026-06-25`)

Full report: [`docs/audits/2026-06-25-mobile-web-parity.md`](docs/audits/2026-06-25-mobile-web-parity.md) (127 findings, severity-ranked).
Remediation plan: [`docs/audits/2026-06-25-mobile-web-parity-remediation.md`](docs/audits/2026-06-25-mobile-web-parity-remediation.md).
Counts: P0:8 · P1:27 · P2:38 · P3:38 · P4:16. Most P1/P2/P3 are already tracked elsewhere in this file (the report flags `already_tracked`); the items below are the **new, untracked, high-severity** ones.

**Structural decision (make ONCE before patching any P0 path):** mobile money-moving writes bypass the webapp server actions and the sync push writes raw PostgREST rows with no trigger reproducing side-effects. Choose: (a) balance/occurrence-aware mobile repo helpers inside `withTransactionAsync`, (b) server-side `AFTER INSERT/UPDATE/DELETE` triggers on `transactions`, or (c) route mobile mutations through server actions online. Spawn `mobile-webapp-parity` + `mobile-sync-doctor`. This dictates every P0 fix below.

### P0 — data corruption / dropped side-effect (verified against source)
- **[tags] `saveTransactionTags` omits `user_id`** → enqueued `transaction_tags` REPLACE has no `user_id`; push handler reads `payload.user_id` (undefined); table is NOT-NULL + RLS → insert fails forever, only `console.warn`'d. Fix: add `user_id` to payload (copy `recurring.ts:964`). `tags.ts:90-95`. **S — do first.**
- **[capture/tx-new] Manual capture drops account balance delta** → `createTransaction` (`transactions.ts:174-235`) inserts + queues sync, no `applyLocalBalanceDelta`. Permanent balance drift. **L (or M via trigger).**
- **[tx-detail/tx-list] Edit/delete drop balance delta** → mobile `updateTransaction`/`deleteTransaction` do zero balance arithmetic (`transactions.ts:557-695`); detail Save realizes the drift. **M.**
- **[categorizar] Categorize drops `category_rules` learning + destinatario default-category backfill** → auto-categorizer never improves from on-device work. `transactions.ts:623-632` vs `categorize.ts:253-282`. **M.**
- **[import] Import never updates balance + skips `statement_snapshots` upsert** → balance off by full imported sum; credit-limit/due-date/history never set. `import.tsx:729-872`. **L + M.**
- **[import] Idempotency key omits `original_amount`+`installment_current`** → cross-platform installment **duplicates** survive dedup. `transactions.ts:178-186`. **S — P0-adjacent, prioritize.**

### Untracked P1 (see remediation doc for the rest)
- [periodo] Cannot pay standalone (non-recurring/non-debt) expense — `PaymentSheet` errors. **M.**
- [deudas] No 'Abonar' extra-payment (`applyExtraDebtPayment`) on mobile. **L.**
- [tags] `/etiquetas` + `/categories` unreachable (nav-orphan; CRUD built). **S.**
- [capture/import] No occurrence-linking on capture/imported tx. **S–M.**

### Bookkeeping corrections (stale items found during audit)
- BACKLOG:109 "server balance delta flows back on next pull" is **false** for mobile-originated inserts — correct it.
- BACKLOG:1189 debt-planner income context marked DONE — **broken** on mobile (dead card).
- BACKLOG:1086-1088 Pagar/Transferir/Ajustar P0 stubs — **resolved**, close.
- BACKLOG:1110-1111 tx-detail promote/vincular P0s — **resolved**, strike.
- BACKLOG:755 onboarding 'en-US' default — **stale** (now `navigator.language || 'es-CO'`).
- BACKLOG:1119-1123 tx-new 'Formulario en construcción' stub — **stale** (redirects to /capture).

### Mobile perf / offline-first leaks (2026-06-25 perf diagnosis)

Production Android is slow — **confirmed on the installed release build, NOT a debug artifact** (Hermes is on). Root cause: a **dual write architecture** — some paths bypass the local-first repos and write directly to remote Supabase with serial, blocking round-trips. Perf and the P0 side-effect gaps **converge**: routing these to local-first fixes both.

- ~~**[P0-perf] Cold start blocks on network**~~ → ✅ **SHIPPED** (`audit/mobile-web-parity-2026-06-25`): `_layout.tsx` now reads `onboarding_completed` from local SQLite (`getLocalProfile`), background-converges, falls back to network only on fresh install. Offline launch unblocked.
- ~~**[P0-perf] Email import direct-to-remote + 4-6 serial round-trips**~~ → ✅ **SHIPPED**: `approveEmailTransaction` rewritten local-first (local account read, local insert via `createTransaction` + `idempotency_key` override, local balance delta, local reconcile, non-blocking `markImported`). Typecheck clean; `mobile-sync-doctor` + `mobile-webapp-parity` gates passed. **Gate follow-ups (deferred):**
  - **[P1] Mobile occurrence-linking is app-wide missing** — webapp marks the matching `recurring_occurrences` paid on every tx create (`linkTransactionToOccurrence`); mobile's `createTransaction`/PDF-import/email-approve all skip it. Fix app-wide (not email-only, to avoid inconsistency): after a non-reconcile create, `findMatchingOccurrence` → `markOccurrencePaid`. Most user-visible on the explicit "Aprobar" action. **M.**
  - **[P3] `categorization_source` fallback** — `buildInsertPayload` (`transactions.ts:~138`) writes `SYSTEM_DEFAULT` when no category; webapp trigger defaults `USER_CREATED`. Align the fallback. Affects all mobile write paths. **S.**
  - **[type] `AccountRow` missing `currency_balances`** (`accounts.ts`) — runtime-present via `SELECT *`, but untyped; add `currency_balances?: string | null`. **S.**
  - **[refactor] email-import non-atomicity** — tx INSERT + balance delta run in two `withTransactionAsync` blocks (crash window; pre-existing). Optional: collapse via `insertLedgerTransaction` with a shared `db` handle. **S.**
- **[perf] Subscriptions screen network reads every focus** → `subscriptions.tsx:114-130` reads `accounts` + `recurring_transaction_templates` over the network on each open; both are synced tables → read local SQLite. **S.**
- **[perf] Home/Plan over-fetch** → `useDashboardData` + `PlanRoot` pull 500 full tx rows and aggregate in JS on every focus → SQL aggregation + `limit 20` recent. **M.**
- **[perf] Feed re-query on every focus** → `MovimientosRoot` reloads all SQLite on navigation return (visible flash) → dirty-flag / version gate. **S.**
- **[bug] AnimatedAccordion `estimatedHeight` worklet closure** → email-import panel animates to wrong height after the panel measures itself; convert `estimatedHeight` to a shared value. **S.**
- **[bug] MovimientosRoot `listHeader` useMemo missing `currency` + `handleToolDataChanged` deps** → stale-currency display if preferred currency resolves after first paint. **S.**

### Mobile SQLite / data-layer perf audit (2026-06-25)

Full report: [`docs/audits/2026-06-25-mobile-sqlite-perf.md`](docs/audits/2026-06-25-mobile-sqlite-perf.md) (46 findings) · plan: [`...-plan.md`](docs/audits/2026-06-25-mobile-sqlite-perf-plan.md). Foundation OK (WAL on, 32 indexes). **46 findings: P0:2 · P1:15 · P2:16 · P3:13.**

- ~~**PRAGMA tuning**~~ → ✅ **SHIPPED**: `applyConnectionPragmas` adds `synchronous=NORMAL` (drops per-commit fsync app-wide) + `busy_timeout`/`cache_size`/`mmap_size`/`temp_store` (`database.ts`).
- ~~**Index coverage**~~ → ✅ **SHIPPED** (migration v18): +`(category_id,date)` +`(account_id,date)`; dropped redundant `idx_transactions_idempotency` (UNIQUE auto-indexes) + `idx_transactions_account` (subsumed by the composite). Net-zero index count, better coverage. (Month-agg already served by `idx_transactions_date`; no new index per sync-doctor gate.)
- **[P0/P1] Dashboard + Plan 500-row fetch → SQL aggregation** — both run `getTransactions({limit:500})` (`SELECT t.*` ×3 JOINs ≈ 23k cells) + O(500) JS loop on every focus. Use `getMonthlyAggregates` + a 20-row feed. ~95% bridge cut on the two hottest screens. **M.**
- **[P1] Subscriptions → local SQLite** — reads `accounts` + `recurring_transaction_templates` over the network every focus; both are synced. **M.**
- **[P1] Sync push round-trip collapse** — replace the per-UPDATE `isLocalFresh` network pre-read (`push.ts:116`, 2 RTTs/update) with a conditional `.lte('updated_at')` write; batch inserts/deletes. **M.**
- **[P1] Focus-reload gate** — module-level data-version flag so `useFocusEffect` skips a full re-query when nothing changed. **S–M.**
- **[P2/P3] remainder** — `SELECT *` over-fetch (22), N+1 in 5 repos, serial 20-table pull, `transaction_tags` full DELETE-ALL+refetch each sync. See report.

---

## Tendencias hub follow-ups (2026-06-24, branch `feat/tendencias-hub`)

New `/tendencias` analytics hub shipped (engine + dataset + 3 lenses + nav + export). Deferred:

- **Obligation-aware forecast.** Forecast currently runs on avg-net projection only; `recurring: []` is stubbed in `getTendenciasDataset` because `ensureCurrentOccurrences` is a mutation that can't run inside `"use cache"`. To wire it: fetch pending OUTFLOW occurrences by month (read-only — generate occurrences in the public wrapper or a separate non-cached action, NOT inside the cached delegate), aggregate `expected_amount` by `occurrence_date.slice(0,7)`, pass as `recurring` to `forecast()`.
- **Budget adherence uses current target across the window.** `categoryMeta.budgetTarget` is the *current* `budgets.amount` applied to every month (no per-month budget history table). If misleading in use, add a historical-budget snapshot table. Labeled "meta actual" in spec.
- **Heuristic tuning.** Anomaly threshold `max(2.5× trailing-3mo mean, mean+2σ)` and the linear forecast are deterministic placeholders (`ponytail:` comments in `anomalies.ts`/`forecast.ts`). Tune or upgrade to seasonal baselines if real usage shows false positives / naive projections.
- **Custom date range UI.** Period control ships 3M/6M/12M/Año; `rangeToWindow` already accepts `{from,to}` but there's no date-picker UI for "Personalizado" yet.
- **Mobile Tendencias screen.** The `@zeta/shared/analytics` engine is built portable (pure functions). A mobile Lectura/Tendencias screen can reuse it on local SQLite rows — parity gate (mobile-webapp-parity) applies before building.

## Pre-existing test debt (discovered 2026-06-24) — [issue #306](https://github.com/Cristian1911/personal_finance_manager_claude/issues/306)

`@zeta/shared` has ~40 failing unit tests on `main` (unrelated to Tendencias): `auto-categorize.test.ts` (autoCategorize returns null where matches expected — likely rules/seed drift) + `debt-stats.test.ts` (computeDebtStats missing a null-guard edge case). Decide per case whether the test expectation is stale or the impl regressed. Tracked in #306.

---

## Mobile design-system follow-ups (2026-06-22, post PR #302)

PR #302 fixed the inline-tx picker bugs (panel opacity / see-through scrim / flex-collapse) + a 36-file design-system sweep (MobileSheet conversion ×4, safe-area, brand colors, button classes, hex→COLORS). Remaining:

- **Slash-opacity className sweep.** NativeWind v3 (this project) does NOT compile `bg-color/opacity` in `className` — it renders transparent (for `bg-`) or no-op (for `border-`). The scrims were the worst case (fixed). But many `className` tints/borders/pressed-states still use slash-opacity and render wrong: `bg-z-income/10`, `bg-z-brass/10`, `bg-z-surface-2/5`, `active:bg-z-surface-2/5`, `active:bg-z-surface-2/10`, `border-white/10`, `border-white/20`, `bg-z-debt/10` (e.g. periodo.tsx, PaymentSheet RadioOption, CategoryFormSheet/PaymentSheet pressed states). Sweep: grep `/[0-9]` inside className strings → replace with the dash token (`bg-z-income-10` etc.). Some tokens don't exist yet (`white-20`, `z-debt-10`, `surface-2-5`) and must be added to `tailwind.config.js` first.
- **Verify the 4 MobileSheet conversions on device** (AddWidgetSheet, plan PaymentSheet, ReassignSheet, CategoryFormSheet) — tsc-clean structural refactors, worth a visual check (esp. PaymentSheet's KeyboardAvoidingView + link/create modes).
- **Off-token colors needing NEW tokens** (audit fix #9): `#0EA5E9` debt-blue, `#6366f1` account-seed default — propose tokens in colors.ts/TOKENS.md rather than approximating.

## Mobile ledger parity — Phase 2 follow-ups (2026-06-22)

Mobile got the 4 ledger mutations (`registerPayment`/`createTransfer`/`reconcileBalance`/`recordRecurringOccurrencePayment`) + screen wiring this session. Verified end-to-end on iOS sim: **account Pagar → registerPayment** (balance + tx + refresh all correct). Remaining:

- **Emulator-verify the other 3 wirings.** Pagar is proven; spot-check **Transferir** (createTransfer paired legs), **Ajustar** (reconcileBalance overwrite), and **Recurrentes Confirmar** (recordRecurringOccurrencePayment — the ex-corruption path) on the sim. Same MobileSheet pattern + gate-reviewed repos, so low risk, but confirm balances move.
- **createTransfer FROM-debt `available_balance` clamp divergence.** Mobile clamps to 0 via `buildDebtBalanceUpdatePayload`; webapp `transfers.ts` allows negative (over-limit). Edge case (transfer FROM a maxed card). Decide canonical behavior and align both sides. (parity gate, 2026-06-22)
- **Multi-currency reconcile.** Mobile schema migration v17 added only `accounts.currency_balances TEXT` (NO top-level `total_payment_due` — it's a JSON sub-field; remote view lacks the column). Verify `currency_balances` pulls from the remote accounts view correctly and the multi-currency reconcile path works on a real multi-currency account.
- **`recurring_template_tags` table missing on mobile.** `recordRecurringOccurrencePayment` probes `sqlite_master` and no-ops the tag copy when absent. Add the synced table so recurring payments carry their template tags.
- **Slash-opacity NativeWind classes** in the new sheets (`bg-z-brass/30`, `bg-z-debt/10`, `active:bg-z-surface-2/5`) — kept for byte-parity with shipping `PaymentSheet.tsx`; rendered fine live, but they're the NativeWind-v3 footgun. Consider migrating PaymentSheet + the new sheets to explicit tokens together.
- **Sparse Más menu** vs webapp — no Deudas/Deseos/Recurrentes/Categorías/Destinatarios entry points. Confirm whether this is intentional v2 curation; if not, surface them.
- **Account-detail time-range chips overlap the floating gear** (6M chip under the settings button). Minor header layout fix in `app/account/[id].tsx`.
- **PlanRoot period chip hardcoded** — `PlanRoot.tsx:257` `periodHasActive={false}`/`periodPercentAssigned={0}`. Wire via `getActivePeriodWithEntries` (needs userId + the webapp assign-% formula). Pairs with the broader Plan/Periodo CRUD (Phase 4).
- **`confirmOccurrence` deleted** from `recurring.ts` (superseded by `recordRecurringOccurrencePayment`). One doc-comment reference remains; harmless.
- **iOS Podfile modular-headers fix is local-only** — `mobile/ios/` is gitignored, so the `pod 'GoogleUtilities'/'RecaptchaInterop', :modular_headers => true` lines (needed for the google-signin/AppCheckCore static-lib error) won't survive `expo prebuild` or reach CI/other devs. Make it durable via `expo-build-properties` in `app.json` (`ios.extraPods` or `useModularHeaders`).

## Bugs

### `seedPeriodFromRecurring` — reminder dedup is title/amount-fragile
- **Priority:** Low
- **What:** `webapp/src/actions/cashflow-planner.ts` dedups reminder-derived `planning_entries` by `(label, due_date, amount)` since reminders have no FK in `planning_entries`. If a user renames a reminder-derived entry or changes the reminder's amount, the dedup key drifts and the next "Sincronizar recurrentes" click re-inserts the row.
- **Fix:** Add a `source_reminder_id uuid REFERENCES financial_reminders(id) ON DELETE SET NULL` column to `planning_entries`, populate it on insert, dedup by it.
- **Found:** server-action-reviewer on PR #244, 2026-05-02

### Telegram webhook — capture_tokens label updates via admin client never worked
- **Priority:** Medium
- **What:** `webapp/src/app/api/webhooks/telegram/route.ts` lines 27–35 (SELECT by encrypted `token`/`label`) and 99–102, 140–143 (UPDATE `label`) go through the `capture_tokens` view with the admin client (no JWT). Before PR #186's `has_auth` guard, the UPDATE silently NULLed the label via unguarded `zeta_encrypt()`. After the guard, the UPDATE preserves whatever was there (usually NULL). Either way, `findTokenByChatId` also decrypts via admin client → `zeta_decrypt(label)` returns NULL → `.like("label", "telegram:...")` never matches. End-to-end: the `/start <token>` deep-link and `/vincular <token>` flows never actually link a chat.
- **Fix:** Add a `set_capture_token_label(p_id, p_label, p_user_id)` RPC with `SECURITY DEFINER` that uses `zeta_encrypt_as` internally, and a `find_capture_token_by_chat_id(p_chat_id)` RPC that decrypts label server-side. Replace the four admin-client calls in the telegram webhook with these RPCs.
- **Found:** supabase-migrator review on PR #186 (has_auth guard), 2026-04-18

### Import wizard — state persists across tab/visibility changes (bfcache)
- **Priority:** Low
- **What:** If the user completes an import, navigates away (browser tabs, minimize, or uses the back/forward cache), and returns, the wizard still shows the `results` step instead of a fresh upload step. React state is preserved because Next.js doesn't fully remount the page when restored from bfcache. User reads this as "unfinished import flow still there".
- **Options:** (a) add a `visibilitychange` listener that resets the wizard if it is in `results` and the document becomes hidden → visible, (b) add a prominent "Terminar y cerrar" button on the results screen that calls `handleReset()` + scrolls to top, (c) accept the behavior and document it. Mild lean toward (b) — explicit control, no surprise resets.
- **Touches:** `webapp/src/components/import/import-wizard.tsx` (handleReset trigger), possibly `step-results.tsx` (new button).
- **Found:** User feedback, 2026-04-17 (post PR #177).

### Promote-to-recurring — success state undersells the outcome
- **Priority:** Medium
- **What:** After promoting a tx, the CTA collapses to a muted grey "Ya es recurrente" badge. User just created a template + linked this tx as paid — but has no signal that a future payment is now scheduled or where to find it. Options: (a) toast on success with the next occurrence date ("Recurrente creada · Próxima: 15 mayo"), (b) badge gains a subtle link to `/plan?tab=recurrentes&template=<id>`, (c) on submit redirect to `/plan?tab=recurrentes&highlight=<template_id>` with a flash highlight.
- **Found:** ux-analyst review, 2026-04-17

### Tx detail hero — Promote vs Edit visual weight inversion
- **Priority:** Low
- **What:** Edit uses the default brass `<Button>`, Promote uses `variant="ghost"`. Promotion is a more consequential action than editing one field. Either swap weights or make both ghost and let Delete remain the icon action.
- **Touches:** `webapp/src/components/transactions/transaction-form-dialog.tsx`, `webapp/src/components/transactions/promote-to-recurring-button.tsx`.
- **Found:** ux-analyst review, 2026-04-17

### Inline Promote dialog inside Vincular drawer
- **Priority:** Low
- **What:** Today "Crear nueva recurrente" navigates to `/transactions/[id]?promote=1` instead of opening the dialog inline in the drawer. Code cost is small (`RecurringFormDialog` already accepts `controlledOpen`). Would remove the full-page detour. Drawback: dialog-in-drawer is visually awkward on mobile and the detail page detour gives the user a landing destination.
- **Found:** ux-analyst review, 2026-04-17

### Investigate why migration 20260416120000 stamped without running
- **Priority:** Medium
- **What:** The remote `supabase_migrations.schema_migrations` table has `20260416120000` marked applied, but the underlying DDL (ALTER TABLE, view rebuild) never executed. Likely causes: (a) a manual `supabase migration repair --status applied`, (b) a partial `db push` that errored mid-migration but still stamped optimistically, (c) a DB reset/restore that restored the history row but not the schema. Check CI deploy logs around 2026-04-16 and grep shell history for `migration repair`. If this recurs, any future migration that depends on `sub_payments` would compile locally but fail in prod.
- **Found:** 2026-04-18

### Mobile — `budgets` SQLite missing `is_demo` column (sync drift)
- **Priority:** Medium
- **What:** Supabase `budgets` view exposes `is_demo: boolean`. SQLite `budgets` table in `mobile/lib/db/schema.ts` has only 7 columns (no `is_demo`). `getTableColumns()` in `mobile/lib/sync/pull.ts` silently drops the field every pull. Demo-seeded budgets cannot be distinguished from real ones on device. User-created budgets work today because Supabase defaults `is_demo=false` on insert.
- **Fix:** DB_MIGRATIONS v11 → `ALTER TABLE budgets ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0`. Then add `budgets: ["is_demo"]` to `BOOLEAN_FIELDS` in `mobile/lib/sync/pull.ts` so pull converts `true/false → 1/0` on write.
- **Found:** mobile-sync-doctor on PR #223, 2026-04-22.

### Mobile — income metrics don't exclude personal-debt `origin` inflows (web/mobile divergence)
- **Priority:** Medium
- **What:** Webapp `charts.ts` excludes `pd_role='origin'` inflows from income via `.or("personal_debt_id.is.null,pd_role.neq.origin")` (a `borrowed` debt's origin INFLOW is not income). Mobile `getMonthlyAggregates` (`mobile/lib/repositories/transactions.ts`) does NOT — it selects no `personal_debt_id`/`pd_role`, and `computeMonthlyAggregates`/`AggregatableTransaction` in `packages/shared/src/utils/monthly-aggregates.ts` can't filter on them. Result: once a user links an origin INFLOW to a personal debt on web, it syncs down (schema v16 added the columns) and inflates the mobile "Resumen del mes" income vs web. Data is NOT corrupted — display-only divergence, bounded to users with `pd_role='origin'` inflows.
- **Fix:** add `personal_debt_id: string | null` + `pd_role: string | null` to `AggregatableTransaction`; skip `isPersonalDebtOrigin(tx)` rows inside `computeMonthlyAggregates` (reuse the shared predicate); SELECT the two columns in the mobile `getMonthlyAggregates` SQL. Verify the webapp doesn't double-exclude (web filters at query level, not via this shared helper). REQUIRED before the mobile write-parity phase below.
- **Found:** mobile-webapp-parity gate, branch feat/personal-debts, 2026-06-04.

### Personal Debts (Personas) — mobile write parity (Phase 2)
- **Priority:** Medium
- **What:** Mobile Personas v1 is READ-ONLY (pulls + displays personal debts; not in push.ts — mirrors the subscriptions precedent). Web is the only place to create debts / record abonos for now. Phase 2 = add mobile write parity.
- **Fix:** (1) repo `createPersonalDebt` (copy `destinatarios.ts` createXWithPattern: `Crypto.randomUUID` + `db.withTransactionAsync` INSERT + `enqueueInsert(db,"personal_debts",…)`) and `recordRepayment` — mirror the full webapp action chain: insert the repayment transaction (with `personal_debt_id`+`pd_role='repayment'`, `enqueueInsert`) AND recompute `outstanding_amount`/`status` via shared `computeOutstanding` (`enqueueUpdate`). **CRITICAL:** the repayment-tx insert must mirror `createTransaction` exactly — do NOT write local `accounts.current_balance` (mobile lets the server balance delta flow back on next pull; a local write double-applies). (2) re-add `| "personal_debts"` to `SyncTableName` in `mobile/lib/sync/push.ts`. (3) UI in `mobile/components/personas/PersonasRoot.tsx`: create-debt sheet (person picker filtered to `kind='person'` + inline person create with `kind='person'`) + record-abono modal (account picker + amount + date). (4) device-verify the sync round-trip (web↔mobile) + the v16 migration. Do the income-exclusion bug above first.
- **Found:** scope decision, branch feat/personal-debts, 2026-06-04.

### Deudas personales — Vincular "Crear deuda" cancel doesn't re-open the picker (web)
- **Priority:** Low (P3)
- **What:** In `movimientos-transaction-row.tsx`, "Vincular a deuda personal" → "Crear deuda personal nueva" closes the LinkPickerSheet and opens `CreatePersonalDebtSheet`. If the user dismisses the create sheet without saving, the picker stays closed — they must re-tap the chip. Acceptable for v1.
- **Fix:** on create-sheet dismiss-without-create, re-open `personaPickerOpen`, or render the create sheet over the picker instead of swapping.
- **Found:** zetas-front-guy, branch feat/personas-usability, 2026-06-04.

### Deudas personales — deferred cleanups (from /code-review + /simplify, 2026-06-04)
- **Priority:** Low (P3)
- ~~**Central "modal-inside-Sheet" handling:** the z fix (force `variant="dialog"` + `Z_DIALOG_ABOVE_SHEET` on content+overlay) is wired per call site.~~ **RESOLVED (2026-06-07):** replaced the inverted z-scale with a token-based `--z-layer-*` scale where popover/tooltip outrank modal globally, so a primitive opened inside a Sheet sits above it with no per-call-site bump. `Z_DIALOG_ABOVE_SHEET` deleted. See `docs/design-system/Z_INDEX.md`.
- **Shared `ConfirmDialog`:** the destructive-confirm AlertDialog block is now a 3rd copy (persona-card + settings/delete-account + settings/reset-data). Extract a reusable `<ConfirmDialog>` and retrofit all three.
- **`runPersonalDebtMutation` helper:** `cancel`/`settle`/`deletePersonalDebt` share the validate→auth→mutate→rowcheck→revalidate skeleton; collapse into one helper (watch Supabase query-builder generics). Note `settlePersonalDebt` omits `revalidateFinancialViews()` though it zeroes `outstanding_amount` — confirm intended when refactoring.
- **`pd_role` hygiene on delete:** FK `ON DELETE SET NULL` clears `personal_debt_id` but leaves a dangling `pd_role` on the unlinked tx. Harmless today (income predicate also checks `personal_debt_id != null`); NULL it out (or a sweep migration) if any future query keys on `pd_role` alone.
- **`AppDataProvider` value not memoized (perf, app-wide):** `webapp/src/components/providers/app-data-provider.tsx` passes the raw `data` object straight to `Context.Provider`, so any parent re-render makes a new reference and re-renders every consumer — including every `MovimientosTransactionRow` subscribing via `useDestinatarios()`. Wrap `data` in `useMemo` keyed on its arrays. Surfaced by /simplify efficiency pass when the row started reading `useDestinatarios()`; pre-existing infra, not specific to deudas-personales.
- **Found:** /code-review + /simplify, branch feat/personas-usability, 2026-06-04 (AppDataProvider note added 2026-06-05).

### Mobile — yearly budgets not displayed
- **Priority:** Low
- **What:** `getBudgetProgress` in `mobile/lib/repositories/budgets.ts` filters `b.period = 'monthly'` (hardcoded). Webapp accepts `"monthly" | "yearly"` via `budgetSchema`. Any yearly budget created on webapp is invisible on mobile.
- **Fix:** widen the SQL filter + surface a period chip in BudgetRow. Only needed once the webapp exposes yearly creation.
- **Found:** mobile-webapp-parity on PR #223, 2026-04-22.

### `reset_user_data()` RPC — drift guard
- **Priority:** Medium
- **What:** PR #227 took five hardening passes (`obligation_skips`, `profiles.updated_at` type, NOT NULL currency/locale, `design_reviews`, CI `clearDatabase` FK order) because the RPC hard-codes the table list and every schema change risks silent drift. Today it's resilient to dropped tables via `to_regclass` guards, but new tables added after 2026-04-24 won't be wiped unless someone remembers to touch the RPC.
- **Fix options:** (a) CI check that diffs `information_schema.tables WHERE table_schema='public'` against the RPC's table list and fails the build on drift; (b) rewrite the RPC to iterate `information_schema` dynamically with an allowlist of system tables to preserve; (c) accept manual upkeep and add a pre-commit reminder when `supabase/migrations/*.sql` adds a `CREATE TABLE`.
- **Found:** 2026-04-24, PR #227.

### RLS UPDATE policies missing `WITH CHECK` (defense-in-depth)
- **Priority:** Low
- **What:** Several per-op RLS UPDATE policies use only `USING ((select auth.uid()) = user_id)` with no matching `WITH CHECK`, so a user could UPDATE their own row and reassign `user_id` to another user (the new-row values aren't validated). Confirmed on `subscriptions` (`20260527151641_create_subscriptions.sql`); the same copy-paste pattern likely exists on other tables. `personal_debts` (20260603) was fixed at creation.
- **Fix:** Add `WITH CHECK ((select auth.uid()) = user_id)` to every `FOR UPDATE` policy. Audit all migrations for `FOR UPDATE\n  USING` without a following `WITH CHECK`.
- **Found:** Automated security review on PR / branch feat/personal-debts, 2026-06-03.

### FAB "Nueva transacción" — premature submit + re-fires "Guardado" on every reopen (mobile webapp)
- **Priority:** High (breaks the primary tx-creation entry point on mobile web)
- **What:** From the mobile-web FAB → "Nueva transacción": (1) the first time, the form submits/closes before the user finishes; (2) afterward, every reopen immediately closes and fires the `toast.success("Guardado")` with no input.
- **Confirmed (static):** single `type="submit"` button; the success handler `useEffect(() => { if (state.success) onSuccess?.(); }, [state.success])` in `mobile-transaction-form.tsx:103-107` **never resets `state.success`** — it relies entirely on full unmount to clear it. `onSuccess` = `new-transaction-page-content.tsx:25-32` (`toast` + `router.back()`). FAB uses `router.replace("/transactions/new")` + a `history.pushState`/`history.back()` sentinel (`fab-menu.tsx:42-83`). No intercepting/parallel routes; no programmatic `requestSubmit`/`.submit()`; `AmountInput` has no Enter handler.
- **NOT yet root-caused — two candidate vectors needing one repro to disambiguate:**
  - **Vector P (persistence):** form reappears with `state.success` still `true` (Next Router Cache reuse / bfcache / no real unmount on `router.replace`↔`router.back`) → effect re-runs `onSuccess` on open. Fix: make success fire once + reset action state (e.g. guard via a `handledRef`, or reset `state` after `onSuccess`). Related to the existing bfcache bug above (import wizard, line ~27).
  - **Vector S (premature/implicit submit):** Enter on the mobile soft keyboard implicitly submits the single-submit-button form mid-typing. Fix: prevent implicit submission on text inputs / require explicit submit.
- **Next step:** add temp `[FAB-DEBUG]` mount/unmount + effect logs to `mobile-transaction-form.tsx`, reproduce once on mobile-width, read console → confirm P vs S, then fix the confirmed vector. Both fixes are cheap once the vector is known.
- **Touches:** `webapp/src/components/mobile/mobile-transaction-form.tsx`, `new-transaction-page-content.tsx`, `fab-menu.tsx`.
- **Found:** User report, 2026-06-03 (investigation deferred — "fix later").

## Claude Design — Wireframe Handoff

Source of truth: `claude-ai-design/Zeta Wireframes.html`. Variant A (Safe) ships unless noted. Each flow below = one milestone slice.

### Flow 01 — Onboarding redesign (webapp)
- **Priority:** Medium
- **Status:** Webapp mobile-first slice shipped (PR #205, 2026-04-21). Mobile slice-2 shipped (PR #195).
- **What shipped (PR #205):**
  - Signup drops email confirmation — redirect straight to `/onboarding` when the session is returned, hard error if the Supabase "Confirm email" toggle is still ON.
  - `fullName` moved from signup to onboarding step 2 (one less field before the app opens).
  - Auth + onboarding layouts: mobile-first Obsidian & Brass shell.
  - Onboarding: chip pickers for purpose, currency, account type. `formatCurrency` + `tabular-nums` on the disponible preview. Completed-user guard added to `/onboarding/layout.tsx`.
  - "Ver demo" entry points (landing hero + signup page) start an anonymous Supabase session, seed demo data, land on `/dashboard`.
  - Anonymous → real: when an anonymous visitor signs up, `signUp` promotes the session via `updateUser({ email, password })` so seeded data carries over. `DemoBanner` swaps the "Salir" button for a brass "Crear cuenta" CTA when the current user is anonymous.
- **Operator prereqs:** `Auth → Email → Confirm email` OFF, `Auth → Anonymous Sign-Ins` ON.
- **Deferred to follow-ups:**
  - PIN (wireframe F2) — needs custom auth flow, Supabase has no primitive.
  - Cadence + partner chips (wireframe F3) — needs new profile columns.
  - Embedded parse step (wireframe F5) — import stays on `/import` after onboarding.
  - Anonymous cleanup cron — see new Tech Debt entry.

### Flow 02 — Home redesign (webapp dashboard)
- **Priority:** Done (mobile + desktop zones) · follow-up deferred
- **Status:** Variant B shipped PR #204 (2026-04-20). Mobile Pulse widget + widget grid + arrange sheet; desktop `HeroZone` / `WidgetsZone` / `HealthZone` / `MobileZone` in `webapp/src/app/(dashboard)/dashboard/page.tsx`.
- **Deferred (PR 3):** true drag-to-reorder + inline S/M/L resize for the widget zone (wireframe "Arrange" frame). Reanimated + gesture-handler work. Current edit mode = WidgetEditSheet move up/down + size chips.

### Flow 03 — Add transaction (quick-capture redesign)
- **Priority:** Shipped (webapp mobile viewport) · follow-ups deferred
- **Status:** Mobile RN shipped PR #201. Webapp mobile `/transactions/new` redesigned to Layout B (sectioned: `Detalles` → `Asignar` → `Más opciones`) — 2026-04-21. Full-page route preserved (kept out of drawer due to virtual-keyboard interactions).
- **What shipped (webapp):**
  - Form restructured into three visual sections with `SectionEyebrow` — `Detalles` (descripción, cuenta, fecha, categoría), `Asignar` (destinatario picker), `Más opciones` collapsible (es suscripción, crear recurrente, notas).
  - `DestinatarioZonePicker` replaces the legacy "Crear destinatario" switch — supports inline create + recents in one control.
  - `is_subscription` now wired end-to-end: schema (`transactionSchema`) + action (`persistTransaction` INSERT) + form Switch row.
  - `destinatario_id` now accepted by `transactionSchema` — user-picked destinatarios flow through to `persistTransaction` and `linkTransactionToOccurrence` (prior code only honored "create-via-switch" destinatarios, so occurrence matching improves).
  - Submit button uses `BRASS_BUTTON_CLASS` (brass + `text-z-ink`, per token rule).
- **Deferred / follow-ups:**
  - Tags picker inline (today requires entity id; `TagZonePicker` needs a "pending tags" mode). Users add tags via transaction detail after save.
  - **[P2] Evolve the inline tag system** (deferred 2026-05-25): inline tag create is name+group only. When this is reworked, reuse `DestinatarioCreateForm` (`components/destinatarios/destinatario-create-form.tsx`) as the template — a seeded, responsive create surface with chip-based composition + on-demand test. The destinatario-from-transaction wizard shipped 2026-05-25 (tx detail + list rows + import review); tags should follow the same pattern.
  - Cuenta + Fecha paired side-by-side (reverted — layout clipped at narrow viewports; stacked stays).
  - Missing `htmlFor` on DatePicker / CategoryZonePicker / DestinatarioZonePicker labels (sub-components don't expose `id`; a11y gap is loose labeling only).
  - Desktop `TransactionFormDialog` (unchanged — out of scope per user decision).

### Flow 04 — Import redesign (webapp)
- **Priority:** Done
- **Status:** Variant A (mobile-first 4-step) shipped PR #209 — 2026-04-21.
- **What shipped:**
  - Collapsed from 6 steps (upload/review/destinatarios/confirm/reconcile/results) to **4 steps** (subir/revisar/reconciliar/listo) matching the mobile app + wireframe Variant A.
  - Destinatario matching and auto-categorization now run silently in step 2; users fix later on the dedicated `/destinatarios` and `/transactions` pages.
  - Multi-currency credit card imports use the mobile `CreditCardStackCard` pattern — one chip + one account assignment + per-currency compact cards with inline projection, instead of a card per statement.
  - New `AccountAssignControl` popover (replaces buried `Select`): brass attention state when unmatched, single-line pill trigger merged with the currency selector on one row.
  - Reconcile step replaced the stat row with a 2×2 grid of expandable `ReconcileChip` tiles (Nuevos / Destinatarios / Duplicados / Ambiguos) + `Narrator` line. Clicking a chip expands a detail panel below.
  - Sticky `WizardActionBar` pinned to the bottom of the viewport on mobile (safe-area + tab-bar clearance). Desktop reverts to inline.
  - Pending email queue now renders **below** the wizard, collapsed by default with a summary strip ("2 listos · 1 necesita clave · 1 con error"), and hides entirely once the user starts a flow.
  - Pending-email queue row clears automatically on completed import (skipped-only counts — previously it required `imported > 0`).
  - Step 1 drop zone restyled (large dashed brass box + file-type hint).
  - `projectMinimumPayoff12mo` moved from `mobile/lib/utils/cc-projection` to `@zeta/shared`.
- **Touches:** `webapp/src/components/import/*`, `webapp/src/app/(dashboard)/import/page.tsx`, `packages/shared/src/utils/cc-projection.ts`, `mobile/components/import/CreditCard{Summary,StackCard}.tsx`.
- **Deferred / follow-ups:**
  - Variant B (always-on inbox) — future slice; current "Cola de importación" is a step toward it.
  - Inline `CreateDestinatarioDialog` in the reconcile "Destinatarios" panel — today it links to `/destinatarios?new=<name>`; wiring the dialog inline requires threading `categories` through the step.
  - Per-tx category override in the flow — removed to match mobile. If we re-add, use an accordion inside the review transaction list (data path still supports it).
  - Manual QA pass — auth-guarded, so browser-based verification needs a real session. Walk-throughs: multi-currency CC, loan statement, email-queue re-import.

### Flow 05 — Plan redesign
- **Priority:** Medium
- **Status:** PR #170 polished `/plan` (NETO, chips, templates, presupuesto grouping, zone-based tabs `PlanResumenZone` / `PlanMobileZone`). Not an explicit wireframe-Variant-A pass — decide whether polish is sufficient or full redesign is still needed.
- **What:** A = current de-noised, B = 50/30/20 as a story, C = calendar-first.

### Flow 06 — Settings redesign (Variant A)
- **Priority:** High · **Ready to merge** (branch `feat/settings-visual-polish`, 2026-04-20)
- **Approach shift:** Original plan stood up sub-editors inside `/settings/*` for every domain (cuentas, categorías, recurrentes, fuentes). We pivoted to **trim settings to pure preferences/credentials** and route domain CRUD through existing hubs. Rationale: `/accounts`, `/plan?tab=presupuesto`, `/plan?tab=recurrentes` already expose full CRUD — duplicating editors under `/settings` was redundant.
- **Final surfaces:**
  - **Settings** — 7 preference rows: Perfil, Integraciones, Importación por correo, Contraseñas de PDF, Etiquetas, Actividad de uso, Reportar bug. Identity hero + search preserved.
  - **Bandeja (`/gestionar`)** — now renders the "Ir a" link grid on desktop (was mobile-only). 8 entries: Cuentas, Categorías, Recurrentes, Destinatarios, Categorizar, Importar, Deudas, Ajustes.
  - **Avatar quick menu** — gained a 4-icon "Ir a" row (Cuentas, Categorías, Recurrentes, Importar) above the footer. One-tap jump from anywhere.
- **Chrome unification:** `/settings/analytics` rewrote `PageHero` → `PageHeaderRow`. All `/settings/*` sub-pages get a desktop "← Volver a Ajustes" back link. Top-level `Analytics` sidebar entry removed.
- **Perf fix bundled:** `getEmailIngestAddress()` was uncached (DB hit every load). Now wrapped with `"use cache"` + `cacheTag("email-ingest")`. Settings page also stopped duplicating the profile query (now uses cached `getProfile()`).
- **Deferred (not in this slice):** anonymous-telemetry toggle, export-all-data (CSV/JSON), delete-account self-serve (confirmation + soft-delete flow), settings search indexing beyond keyword arrays.

### Flow 06 — Settings Variant B (People / couples mode)
- **Priority:** Low · **Future**
- **What:** Settings gains a People section for invite partner + shared pools + roles. Seed for couples tracking without a separate app. Needs new tables + RLS (`shared_pools`, `pool_members`, `pool_allocations`). Do not start until Variant A ships.

### Flow 07 — Can I afford it? (redesign)
- **Priority:** Done
- **Status:** Webapp shipped PR #211 — 2026-04-21. Mobile shipped slice-5 (PR #197).
- **What shipped (PR #211):**
  - New `/puedo-pagar` route replaces the old dashboard-card dialog + mobile v2 drawer. Mirrors Flow 07 Variant A + R2-05 wireframes.
  - `AffordPageClient`: sectioned form (qué · cuánto · cuenta · urgencia · pago · cuotas · categoría) → verdict hero (icon + label + score/100) → metric tiles (`PANEL_INSET_CLASS`) → reasons → "Caminos más seguros" → 3 decision actions (Comprar / Guardar en deseos [BRASS_GHOST, only for WAIT/NOT_RECOMMENDED/BUY_WITH_CAUTION] / Descartar).
  - `saveAffordToWishlist` server action: Zod-validated (verdict enum, 3-char uppercase currency, 0–100 score), `updateTag("wishlist")`, scoped error logging.
  - Dashboard `¿Comprarlo?` widget expands inline with a short explainer + brass CTA that navigates to the page.
  - Entry points wired on `/transactions` (link card replacing the dialog), mobile v2 dashboard widget, `MobileLinkGrid` at `/gestionar`.
  - Perf: page uses `useAccounts()` / `useOutflowCategories()` from `AppDataProvider`, no redundant fetch on the render path. Month is derived dynamically in the handler (not as a prop) to avoid staleness on long-lived sessions.
  - Removed: `purchase-decision-card.tsx` (547 lines), `purchase-recommender-drawer.tsx` (470 lines). Net -920 lines.
- **Touches:** `webapp/src/app/(dashboard)/puedo-pagar/`, `webapp/src/components/afford/`, `webapp/src/actions/wishlist.ts`, `webapp/src/components/mobile/v2/inicio/widgets/puedo-comprarlo-widget.tsx`, `webapp/src/components/mobile/mobile-link-grid.tsx`.
- **Deferred / follow-ups:** none flagged during review.

## Features

### v1.2 — Zeta Pro subscription (monetization)
- **Priority:** Medium (post-launch, ~4-8 weeks after v1.0 ships)
- **What:** Free + paid subscription tier. Free remains usable; "Zeta Pro" unlocks advanced features. Recurring billing via App Store IAP / Google Play Billing.
- **Why:** Ongoing infra cost (Supabase + parser server + Hostinger VPS) needs revenue. Personal finance is a proven subscription category — Copilot ($13/mo), Monarch ($14.99/mo), YNAB ($14.99/mo), Origin. One-time IAP caps LTV; subscription compounds.
- **Pricing hypothesis:**
  - **Zeta Pro · USD 4.99/mo** or **COP 19,900/mo** (local pricing matters in Colombia — set per region in ASC).
  - Annual discount: USD 39.99/yr (~33% off).
  - 7-day free trial via App Store intro offer.
- **Free vs Pro split (proposal — refine after first launch data):**
  | Feature | Free | Pro |
  |---|---|---|
  | Manual transactions | ✓ | ✓ |
  | Accounts | up to 2 | unlimited |
  | Categories + tags | ✓ | ✓ |
  | Basic budget (50/30/20) | ✓ | ✓ |
  | PDF import | — | ✓ |
  | Email ingest (Bancolombia) | — | ✓ |
  | OCR / voice quick-capture | limited (5/mo) | unlimited |
  | Multi-currency | — | ✓ |
  | Debt simulator + scenario engine | — | ✓ |
  | Recurring obligations | — | ✓ |
  | Wishlist / Deseos | — | ✓ |
  | Dashboard widgets | basic 3 | full set |
- **Implementation effort:** ~1.5-2 weeks
  - StoreKit 2 + Google Play Billing integration (RevenueCat recommended — abstracts both, ~2-3 days)
  - Paywall screen + Spanish copy + visual hierarchy (1-2 days)
  - Entitlement gating across the app (`useEntitlement("pro")` hook, conditional renders, lock badges) (1-2 days)
  - Server-side receipt validation (RevenueCat handles, otherwise webhook to Supabase) (1 day)
  - Restore Purchases flow (0.5 day)
  - Sandbox tester accounts + manual flows (1 day)
  - Define product IDs, prices, descriptions per region in ASC + Play Console (0.5 day)
- **Constraints:**
  - Webapp is the design source of truth — paywall must work on web too (Stripe for web, IAP for mobile, webhook syncs entitlements).
  - Existing users (during free-only period) → consider grandfathering: "early adopter" perpetual Pro for everyone signed up before launch date.
  - Apple takes 15% (Small Business Program <$1M/yr) or 30%; Google takes 15%.
- **Why not now:** zero download data → can't tier features without knowing what users actually use. Apple v1.0 review already in motion; adding IAP delays + restarts review. Free apps review faster (24h vs 48h).
- **Trigger to start:** ~50 weekly active users OR clear feedback from early adopters that PDF import + email ingest are the magnets.
- **Found:** User question, 2026-04-29 (App Store Connect pricing decision during first submission).

### Import support — PDF redaction before "send to devs"
- **Priority:** Medium
- **What:** When a user opts into "send for support" on a failed import, give them a redaction step before upload so they can hide PII (name, document ID, account number, address, balances) without losing the structural data we need to build a parser.
- **Why:** Bank statements are dense with PII. The current flow asks users to upload an unmodified PDF — many won't, even if it would help us add their bank. Privacy gate = higher conversion + safer storage of `save-unrecognized` blobs.
- **Approach (MVP, ~2-3 days):**
  1. Auto-redact pass on the server: extract bbox positions for known PII patterns (NIT/CC formats, common name lines via heuristics, account numbers via regex). Return a JSON of suggested redaction rectangles.
  2. Client preview: render the PDF page-by-page (pdf.js) with the suggested rectangles overlaid as semi-opaque boxes. User can toggle each suggestion on/off and drag a new rectangle for anything missed.
  3. On submit: client posts the redaction list + original file to `/api/save-unrecognized`. Server applies the rectangles using `pypdf` or `reportlab` (draw black rect on top of each page) and stores the redacted output. Original is discarded.
- **Approach (full, ~1 week):** Add per-rectangle reasons ("name", "account", "amount") for analytics on what users hide most; let user blur instead of black-box; preserve text-layer for rectangles outside the redaction zone so devs can still parse the structure.
- **Tradeoff:** image-only redaction (rasterize → paint → re-encode) loses text fidelity → defeats the dev-support purpose. Stick with vector overlay.
- **Touches:** `services/pdf_parser/main.py` (`/save-unrecognized` accepts redaction rectangles + applies them; new `/suggest-redactions` endpoint for the auto-pass), `webapp/src/components/import/step-upload.tsx` (the existing `unsupportedFile` block grows a "Revisar y censurar" intermediate step), new `webapp/src/components/import/redaction-editor.tsx`, dependency: `pdfjs-dist` for client render + a server-side redaction lib.
- **Found:** User request, 2026-04-28.

### Budget setup — per-category opt-in + calculator shortcut
- **Priority:** Medium
- **What:** When setting up budgets the user wants to pick categories one by one and only assign amounts to the ones they care about — leaving the rest blank is a valid state, not an error. Also: every amount input should expose a small calculator button (popover/drawer) so the user can do quick math without leaving the form.
- **Why:** Current budget setup assumes every category needs a number. For people starting lean, that's friction. The calculator lets "we spend ~300k on groceries + ~120k on café" become one inline add without switching apps.
- **Touches:** budget setup UI (`webapp/src/app/presupuesto/...` or the plan presupuesto tab), `CurrencyInput` component — add an adornment button that opens a lightweight calculator.
- **Found:** User request, 2026-04-21.

### Empty-state "Primeros pasos recomendados" — 4×4 grid layout
- **Priority:** Low
- **What:** The "Primeros pasos recomendados" view shown when the app has no data should render the suggested actions as a 4×4 grid (or close to it) instead of the current stacked list. Gives the user a richer menu of entry points at a glance.
- **Touches:** wherever the first-run recommendations render on the dashboard / /import / /plan empty states — locate and unify.
- **Found:** User request, 2026-04-21.

### Dashboard RECIENTE — inline category assignment on row expand
- **Priority:** High (scoped for Phase 2 Dashboard polish)
- **What:** Replace the current inline yellow "Sin cat." tag with a tap-to-expand row interaction: tapping a transaction row reveals an inline panel with a category picker (and possibly: destinatario picker, mark-as-recurring, notes field). User resolves the categorization without leaving the Dashboard. Removes visual clutter from the row and turns a passive signal into a one-tap action.
- **Context:** User de-prioritized "Sin cat." as a Dashboard-level reminder (the `/transactions` page already has a prominent CTA). But we still want users to be able to categorize from the Dashboard's RECIENTE list if they notice something.
- **Component:** Update `inicio-activity.tsx`. Likely reuses the zone-picker pattern already in `/transactions` and `/destinatarios`.
- **Found:** Dashboard polish brainstorming, 2026-04-16

### Account detail page — deferred items
- **Priority:** Medium
- **What:** Statement snapshots visual redesign, auto-populate `card_brand` from PDF parsers, composite `(account_id, user_id, transaction_date)` index, use `useAccounts()` hook instead of server-side `getAccounts()` in QuickActionsBar
- **Context:** Shipped card hero, flip-to-graph, transaction-based balance history, transfer dialog, quick actions. Deferred items noted by perf-auditor and design reviews.

### Recurring stats — historical backfill
- **Priority:** Medium
- **What:** Template stats (YTD, streak, annual estimate) are empty for newly created templates. Options: (1) backfill from `statement_snapshots` minimum payments or balance changes, (2) when creating a recurring template, auto-create historical occurrences as "paid" based on matching past transactions, (3) use snapshot history alongside occurrence history for the metrics.
- **Context:** `getTemplateStats()` in `actions/template-stats.ts` only queries `recurring_occurrences`. New templates have no occurrences yet even if the user has been paying for months.
- **Found:** User feedback, 2026-04-14

### Recurring checklist — unify inline expand + action drawer
- **Priority:** Medium
- **What:** The plan tab checklist has two disconnected interaction patterns: (1) tap row → inline payment form with flat buttons, (2) tap ⋮ → bottom Sheet with chip-style admin actions. They look like different apps. Unify into a single cohesive pattern — either improve inline to match chip style with small confirmation Sheet, or merge both into one bottom drawer per-item.
- **Found:** Visual testing, 2026-04-14

### Accounts — `deactivated_at` timestamp
- **Priority:** Medium
- **What:** Add `deactivated_at` column to accounts table. When a user deactivates an account, store the date. Use in historical debt views to show "Cerrada en abril 2026" label on account cards. Currently only `is_active` boolean — no record of when.
- **Migration:** 6-step encrypted table process (accounts is a view over `accounts_enc`). Spawn `supabase-migrator`.
- **Found:** Debt page month selector work, 2026-04-15

### Categorization view enhancements
- **Priority:** Medium
- **What:** Show similar transactions when categorizing, more action options in the categorization inbox
- **Context:** Currently only shows category suggestion + accept/change. Could show "5 more like this" to encourage bulk categorization.

### Smart insights
- **Priority:** Low (large scope)
- **What:** Cross-month account movement tracking, debt payment impact analysis
- **Context:** Dashboard answers "Am I on track?" but doesn't yet show trends or explain why things changed.

### Desktop transaction table expansion
- **Priority:** Medium
- **What:** Same action chip pattern (destinatario, tag, edit) for desktop table rows. Migrate desktop consumers from old pickers (`destinatario-picker.tsx`, `tag-picker.tsx`) to zone pickers, then delete old files.
- **Context:** PR #130 only covers mobile. Desktop table still uses inline category popover only.

### Tag system broader reach — remaining items
- **Priority:** Medium
- **What:** Tags on recurring templates (needs `recurring_template_tags` migration + form changes + occurrence-to-tx tag copy). Nómina tag variants.
- **Context:** Auto-tag from destinatario during import shipped in PR #138. This is the remaining work.

### Mobile app — Apple compliance (pre-submission)
- **Priority:** High · **Mostly shipped** (branch `feat/settings-visual-polish`, 2026-04-20)
- **Done:**
  - `/privacy` + `/privacy/en` + `/terms` + `/terms/en` routes created on webapp with `LegalLayout` chrome. Host domain currently `pfm.sanson1911.cloud` (pending rebrand rename).
  - `PrivacyInfo.xcprivacy` declares collected data types: email, user ID, other financial info, other user content — all linked to user, not tracking, purpose = app functionality.
  - `NSAllowsLocalNetworking: true` removed from `ios/Zeta/Info.plist`. `NSBonjourServices` + `NSLocalNetworkUsageDescription` kept for Expo dev launcher discovery with Spanish description that clarifies dev-only behavior.
  - Mobile `/settings` page: new "Legal" section with Privacy + Terms links (via `expo-web-browser` → `EXPO_PUBLIC_API_URL`) + bottom disclaimer "Zeta no es un asesor financiero".
- **Deferred — add when actual camera/photo feature lands:**
  - `NSCameraUsageDescription` + `NSPhotoLibraryUsageDescription` in `app.json` `ios.infoPlist`. Apple flags unused permission strings — don't add preemptively. Hook into whichever PR introduces `expo-camera` / `expo-image-picker`. Current `DocumentPicker` (Files app) doesn't need either.
- **Still required before submission:**
  - Privacy Policy URL must be **stable** (pending webapp domain rebrand rename — coordinate so URL is final before App Store Connect submission; updating later triggers re-review).
  - Financial-app disclosure in App Store Connect submission form.
  - `privacy@zeta.app` + `legal@zeta.app` mailboxes must accept mail (or replace placeholders in `legal-layout.tsx` + privacy/terms-content).
- **Found:** Mobile pages session, 2026-04-14

### Mobile app — Play Store production release (rebrand + promote from alpha/beta)
- **Priority:** High · **Tech prep done** — branch `feat/settings-visual-polish`, 2026-04-20
- **Shipped this session:**
  - Bundle drift fixed: `app.json` now uses `com.zetafinance.app` for both `ios.bundleIdentifier` and `android.package` (was `com.venti5.zeta`, out of sync with `build.gradle` + Xcode project).
  - Version bumped 1.0.0 → 1.1.0 across `app.json`, `ios/Info.plist`, `android/app/build.gradle`. `versionCode` auto-increments via EAS (`appVersionSource: remote`).
  - `AndroidManifest.xml` hardened: removed `SYSTEM_ALERT_WINDOW` (overlay permission — Play flags for finance apps); set `android:allowBackup="false"` to prevent sensitive data in ADB backups.
  - `targetSdkVersion` + `compileSdkVersion` inherited from Expo SDK 55 version catalog → both 35+ automatically.
  - Data Safety declaration drafted at `docs/play-store/DATA_SAFETY.md`.
  - Spanish listing copy drafted at `docs/play-store/LISTING_ES.md` (título, descripción corta, descripción completa, categorías, screenshots checklist).
  - In-app disclaimer + Privacy/Terms links live in mobile `/settings` (see Apple compliance entry).
- **Goal:** Ship Zeta to Play Store production track. Existing draft is on closed (alpha/beta). Name stays "Zeta"; bundle stays `com.zetafinance.app`; palette stays (`#121412` splash bg). User will deliver new brand PNGs later.

- **Assets (user-supplied, pending)**
  - `mobile/assets/images/icon.png` — 1024×1024, no alpha, no rounded corners (Play does the mask).
  - `mobile/assets/images/adaptive-icon.png` — 1024×1024 foreground, safe zone 672×672 centered (background stays `#121412` per `app.json`).
  - `mobile/assets/images/splash-icon.png` — centered logo on transparent; Expo scales to match `splash.backgroundColor`.
  - `mobile/assets/images/favicon.png` — web fallback (low priority for Play).
  - Play listing graphics: feature graphic 1024×500, phone screenshots ≥2 at 9:16 (min 1080px), optional 7"/10" tablet.

- **Listing copy (Spanish)** — I can draft from webapp positioning, user reviews.
  - Título de app (30 ch max)
  - Descripción corta (80 ch max)
  - Descripción completa (4000 ch max) — emphasize: importación de extractos PDF bancarios Colombia, presupuesto 50/30/20, deudas, multi-moneda.
  - Categoría: `FINANCE`. Contenido: audiencia general.

- **Compliance (blocks production)**
  - Privacy Policy URL — hosted on webapp domain. Must exist and be reachable before Play lets us promote to prod. Draft ES + EN.
  - Data Safety form: declare `Financial info` (in-app purchases N/A, other financial info = transactions, balances), `Personal info` (email, user ID), `App activity`. Data is encrypted in transit (HTTPS) AND at rest (envelope encryption on 9 `_enc` tables — document that). User can request deletion — point to in-app settings flow.
  - Content rating questionnaire — all "no" for Zeta (no violence, gambling, user-generated social content).
  - Target audience: 18+.
  - App category: `Finance`.
  - Financial Services declaration — Play requires extra disclosures for finance apps. Colombia-only for initial launch (if expanding, re-declare).
  - In-app disclaimer string: "Zeta no es un asesor financiero" — surface in settings/onboarding.

- **Technical (can do before assets)**
  - Verify `android/build.gradle` `targetSdkVersion` = 35 (Play minimum as of Aug 2025 for new + updated apps).
  - Verify `compileSdkVersion` = 35+.
  - Bump `expo.version` in `app.json` (current `1.0.0` → bump per rebrand, e.g. `1.1.0`).
  - `versionCode` auto-increments via EAS remote (`appVersionSource: remote` in `eas.json`) — no manual bump needed.
  - Confirm Play App Signing is enabled in Console (recommended over self-managed upload key).
  - Smoke-test release AAB on a physical device using `build:aab:production` EAS profile OR `build:aab:local` with Play upload keystore. Artifact: `android/app/build/outputs/bundle/release/app-release.aab`.
  - Strip debug logs / `console.log` in production bundle (Expo does this by default in release mode).
  - Audit permissions in `AndroidManifest.xml` — remove any not needed (e.g., if `RECORD_AUDIO` was added for voice and isn't used in current build).
  - Pre-launch report in Play Console (automated crash/perf check) — runs after upload, review results before promoting.

- **Track progression (user asked "do we have to pass through the others?")**
  - Current: closed testing (alpha/beta).
  - Play rules: org accounts can promote closed → production directly after policy review. Personal dev accounts registered after Nov 2023 must run a 14-day closed test with ≥20 testers before first-time production release. Confirm account type on Play Console.
  - Flow: upload new AAB to closed track → verify w/ pre-launch report → promote build to production track OR create a new production release reusing the AAB. No rebuild needed.
  - First production submission triggers **manual review** (can take hours to days for finance apps). Plan rebrand release so review window doesn't block other deliverables.

- **Blockers to resolve before promotion**
  1. New icon/splash/feature-graphic PNGs from user.
  2. Privacy Policy URL live on webapp domain (webapp rebrand domain rename is pending per user — coordinate so the URL is stable before submission).
  3. Dev account type (personal vs org `zetafinance`) — determines 14-day closed test rule.
  4. Finalize Spanish listing copy.
  5. Confirm screenshots captured post-rebrand (not pre-rebrand, to avoid old visual identity in store).

- **Sequencing**
  1. Tech prep (targetSdk, version bump, permissions audit, disclaimer string) — no assets needed.
  2. Privacy Policy drafting + hosting (coordinate with webapp team).
  3. Draft store listing copy for user review.
  4. Wait on assets → swap PNGs → build preview AAB → device smoke test.
  5. Build production AAB → upload to closed track → pre-launch report.
  6. Data Safety form + content rating + financial disclosures.
  7. Promote to production track → manual review.

- **Found:** 2026-04-16 rebrand scoping session.

### Mobile v2 redesign — Phase 3
- **Priority:** Low (deferred)
- **What:** Full root redesign with zone-based layouts, custom heroes, Zeta-branded visualizations
- **Memory:** `project_mobile_v2_redesign.md`

### Mobile charts — MVP set
- **Priority:** Medium
- **What:** Build mobile equivalents for the 6 most important webapp charts: monthly cashflow (bar), category donut (pie), daily spending (area), burn rate + runway, budget pace (ideal vs actual), account sparklines. `@shopify/react-native-skia` is already installed but unused.
- **Data sources:** `getMonthlyCashflow()`, `getCategorySpending()`, `getDailySpending()`, `getBurnRate()`, `getDailyBudgetPace()`, `getAccountsWithSparklineData()` — all in `webapp/src/actions/charts.ts`.
- **Found:** Mobile audit, 2026-04-15

### Mobile missing pages
- **Priority:** Low
- **What:** Etiquetas (Tags), Pendientes (Pending Transactions), Settings Analytics — all exist in webapp but have no mobile equivalent.
- **Found:** Mobile audit, 2026-04-15

### Mobile sync — secondary tables
- **Priority:** Low
- **What:** `debt_scenarios`, `wishlist_reflections`, `dashboard_config` tables are used by the webapp but not synced to mobile. Add to SYNC_TABLES when mobile features need them.
- **Found:** Mobile audit, 2026-04-15

### Mobile PaymentSheet — recurring-template create-path divergence
- **Priority:** Medium
- **What:** When `entry.recurring_template_id` is set in `mobile/components/plan/PaymentSheet.tsx` `handleCreatePayment`, mobile inserts plain `"Pago: <label>"` transactions with `category_id: entry.category_id`. Webapp `cashflow-planner.ts:1243-1276` delegates to `recordRecurringOccurrencePayment` → `buildRecurringPaymentTransactions`, which produces transfer-style descriptions (`"Transferencia a <account> - <label>"` on OUTFLOW, `"Abono deuda desde <source> - <label>"` on INFLOW) and forces `category_id` to `TRANSFER_CATEGORY_ID` / `getDebtPaymentCategoryId(account_type)`.
- **Impact:** Recurring debt payments created from mobile show different descriptions and category assignments than the same payment created from webapp. Visible in transaction lists, breaks debt category aggregation.
- **Fix:** call the same shared logic from mobile (port `buildRecurringPaymentTransactions` to `@zeta/shared` if needed), or have mobile delegate via an RPC.
- **Found:** mobile-webapp-parity on PaymentSheet parity PR, 2026-05-02.

### Mobile PaymentSheet — link mode missing account/direction validation
- **Priority:** Low
- **What:** Webapp `linkExistingTransactionToOccurrence` (occurrences.ts:1172-1177) validates that the linked transaction's `account_id + direction` matches the template (or qualifies as a cross-account debt payment). Mobile accepts any candidate from the 50-tx search window. Risk: `revertOccurrence` on the webapp could delete a transaction the user didn't intend to link to this occurrence.
- **Fix:** mirror the validation in mobile `handleLinkTransaction`. Needs the template's `account_id`, `direction`, `transfer_source_account_id` — fetch via repo before applying the link.
- **Found:** mobile-webapp-parity on PaymentSheet parity PR, 2026-05-02.

### Mobile transactions — `description` vs `clean_description` column drift (pre-existing)
- **Priority:** Medium
- **What:** SQLite `transactions` table has a column named `description` (since v1). Supabase `transactions` view exposes `clean_description`. `pull.ts` `getTableColumns()` filter drops the Supabase field every cycle because no local `clean_description` column exists. Mobile masks the gap by SELECTing `description as clean_description` and pushing `clean_description` on writes. Practical impact: every pull-back from Supabase loses the field; the local row keeps whatever was last written locally, never the Supabase truth.
- **Fix:** rename local column with a v13 migration: `ALTER TABLE transactions RENAME COLUMN description TO clean_description`, then drop the SELECT alias + simplify `clean_description` push payload mapping.
- **Found:** mobile-sync-doctor on PaymentSheet parity PR, 2026-05-02.

### Mobile Settings — v2 polish (layout + sizes)
- **Priority:** Medium
- **What:** Settings screen (`mobile/app/(tabs)/settings.tsx`) funciona pero no ha pasado el sweep de v2. Usuario quiere planificarlo con calma en vez de improvisar. Slice actual solo metió la ToggleRow del BugFAB; el resto queda pendiente.
- **Áreas a discutir antes de tocar:**
  - **IdentityHero**: hoy vive sin card (flex row suelto con `px-4 py-4`). ¿Convertirlo en `PANEL_INSET_CLASS` con avatar más grande (h-16)? ¿O mantenerlo aéreo y solo tocar tipografía?
  - **Agrupación**: "Limpiar cola de sincronización" + "Resincronizar desde cero" están en Sincronización — ¿mover a "Avanzado" separada? ¿o son aceptables donde están?
  - **Spacing**: `gap-5` entre secciones, `mb-2` bajo headings, `py-3` en filas. ¿Apretar, holgar, o quedarse?
  - **Tipografía**: Nombre en hero `text-base`, títulos de fila `text-sm`, meta `text-xs`. ¿Subir un paso para jerarquía más clara?
  - **Pill "Cerrar sesión"**: `BRASS_GHOST_BUTTON_CLASS` + `text-[11px]`. Pequeño. ¿Crece o se convierte en icon-button?
  - **Orden de secciones**: Perfil → Sincronización → Apariencia → Seguridad → Privacidad. ¿Cambia?
  - **Secciones faltantes**: ¿Lugar para idioma, notificaciones, export de datos, eliminar cuenta (flagged en backlog existing)?
- **Recomendación para arranque**: sesión corta de diseño en papel/wireframe antes de tocar TSX. Decidir 3-4 cambios concretos y ejecutar.
- **Found:** User feedback, 2026-04-23.

### Mobile Plan — restaurar "FLUJO DEL MES" chart
- **Priority:** Medium
- **What:** El chart de flujo diario (línea de balance + marcadores diarios de ingresos/gastos verdes/rojos + líneas verticales de ingreso/gasto + marker de "Hoy" + totales INGRESOS/GASTOS/NETO debajo) se perdió en el rediseño del Plan (PR #224). User feedback: lo quiere de vuelta. Referencia visual en el adjunto del usuario 2026-04-23.
- **Scope:** portar como expandable section dentro de `PlanRoot` o como standalone dentro de `PlanNetHero` (o un nuevo `PlanFlowSection`). Código previo: buscar `PlanFlowChart` en history (`git show 01953a4^:mobile/components/plan/PlanFlowChart.tsx` — eliminado en el redesign).
- **Found:** User feedback, 2026-04-23 (post PR #224).

### Webapp mobile/v2/plan — parity with native execution hero
- **Priority:** Medium
- **What:** PR #224 moved native Plan to the execution hero (`disponible` = confirmed income − paid obligations − pending − discretionary) with inline mini-chart + expandable math breakdown. Webapp `mobile/v2/plan-root.tsx` still uses the simpler "neto del mes" projection (planned ingresos − gastos, chart expands into hero). They now diverge semantically: native answers "what's left to spend?"; webapp answers "what's the projected net?". Both render on mobile-width viewport.
- **Direction picked (2026-04-22):** port native's execution hero back to webapp. Requires expanding `getPlanPageData()` to return the full `PlanExecution` shape (confirmedIncome/paidExpenses/pendingIncome/pendingExpenses/discretionarySpent/disponible). Also port `PlanWeekTiles` expand pattern + `PlanToolsChips` nav grid.
- **Touches:** `webapp/src/actions/plan.ts` (data shape), `webapp/src/components/mobile/v2/plan/plan-net-hero.tsx`, `plan-expandable-chips.tsx`, `plan-drill-cards.tsx`, `plan-root.tsx`.
- **Found:** PR #224 scope decision, 2026-04-22.

### Mobile dashboard — Arrange mode (drag/resize)
- **Priority:** Medium
- **What:** Slice-3 shipped the widget shell (Pulse fixed + 4 widgets + catalog) with edit mode = remove/add only. The Arrange frame from the Claude Design handoff (long-press → header swaps to "Arrange · Drag · Resize · Remove" + S/M/L chips per widget) needs reanimated + gesture-handler work. All catalog entries currently render as `rounded-2xl border bg-black-10` placeholders while disabled.
- **Touches:** `mobile/components/inicio/WidgetGrid.tsx`, new drag/resize gesture code, `widgets.ts` size contract already supports S/M/L.
- **Found:** Slice-3 scope split, 2026-04-19

### Mobile dashboard — Pulse trend data shape
- **Priority:** Low
- **What:** `PulseWidget` sparkline currently uses last-7 OUTFLOW sum per day (spend, not net cashflow). Design intent likely wants net cashflow (income - spend) or a moving-average disposable-per-day curve. Decide signal before hardening.
- **Found:** Slice-3 dev, 2026-04-19

### Mobile `transactions` table — `recurrence_group_id` column drift
- **Priority:** Low
- **What:** Supabase `transactions_enc` / `transactions` view has `recurrence_group_id` TEXT (nullable), but SQLite schema never added it. `pull.ts` silently drops it every cycle. Not blocking any feature today (`is_recurring` boolean covers the pill), but close the drift before any feature needs the group id.
- **Fix:** `ALTER TABLE transactions ADD COLUMN recurrence_group_id TEXT` as a DB_MIGRATIONS v10 entry.
- **Found:** mobile-sync-doctor, slice-3 audit, 2026-04-19

### Mobile dashboard — widget catalog stubs
- **Priority:** Medium
- **What:** `spending_by_category`, `cashflow_calendar`, `debt_progress`, `merchants_this_month`, `shared_with_partner`, `goal` are listed in `WIDGET_CATALOG` but marked `available: false` and render a "Widget próximamente" placeholder if somehow added. Build them as each feature comes online so the catalog stops feeling hollow.
- **Touches:** `mobile/lib/dashboard/widgets.ts`, new widget components under `mobile/components/inicio/widgets/`.
- **Found:** Slice-3 scope, 2026-04-19

### Observabilidad — Sentry / crashlytics en mobile
- **Priority:** Low (post-v1, antes del crecimiento más allá de beta cerrada)
- **What:** Añadir reporte de crashes + performance para detectar bugs sin esperar a que el usuario los reporte. Candidatos: Sentry (free tier generoso, integra con Supabase), Expo's `expo-application` + custom logging, o BetterStack.
- **Play Store implicaciones al activar:**
  - Data Safety → App info and performance: marcar "Crash logs", "Diagnostics", "Other app performance data" (según lo que se recoja).
  - Collected=Yes · Shared=Yes (Sentry es un tercero) · Optional · Purpose=Analytics · Encrypted in transit=Yes · User can request deletion=Yes.
  - Actualizar política de privacidad con mención del proveedor de observabilidad.
- **Criterio de activación:** cuando haya >50 usuarios en beta y no queramos depender solo de bug reports manuales.

### In-app eliminación de cuenta (Ajustes → Eliminar cuenta)
- **Priority:** High (antes de Play Store producción; OK para internal testing)
- **What:** Implementar flujo self-service de eliminación de cuenta y todos los datos asociados. Hoy solo existe vía email a `giraldo.0302@gmail.com` (documentado en `/eliminar-cuenta`). Google Play prefiere in-app; lo acepta por email para v1 pero la UI más tarde reduce fricción y baja tickets.
- **Touches:**
  - `webapp/src/actions/account.ts` (nuevo) — `deleteAccount()` server action que borra cascadas de user data + `supabase.auth.admin.deleteUser(user.id)` vía admin client
  - `webapp/src/app/(dashboard)/settings/cuenta/page.tsx` — sección "Zona de peligro" con doble confirmación
  - Mobile: equivalente en `app/(tabs)/settings.tsx`
  - Considerar "soft delete" con grace period (7 días) antes del purge definitivo
- **Requisitos antes de marcar done:** actualizar `/eliminar-cuenta` para reintroducir la vía in-app como método 1; email queda como fallback.

### MCP — acceso de IAs de terceros configurado por el usuario
- **Priority:** Low (post-v1)
- **What:** Permitir que el usuario conecte clientes MCP (Claude Desktop, Cursor, etc.) para consultar sus datos financieros vía protocolo MCP. Ya existe scaffolding en `webapp/src/app/api/mcp/`; falta mobile + documentación de onboarding.
- **Implicaciones Play Store:**
  - Data Safety sigue siendo **Sí** a la pregunta global (ya se recopila desde v1).
  - En el desglose por tipo de dato: NO marcar como "Shared" siempre que (a) el usuario active MCP opt-in explícito, (b) conecte su propio cliente (no uno pre-configurado por Zeta), (c) Zeta no enrute datos a un LLM propio con su API key. Esto califica como "user-initiated action" exento según Google Data Safety FAQ.
  - Si Zeta llegase a enrutar a un LLM de tercero con credenciales propias (ej. OpenAI con API key de la empresa), **sí** cuenta como Shared y hay que declararlo.
  - Actualizar política de privacidad y términos para documentar qué datos quedan visibles al cliente MCP.
  - Añadir pantalla de consentimiento explícito antes del primer uso.
- **Touches:** `webapp/src/app/api/mcp/`, nueva settings page en mobile, tokens MCP en Supabase, docs.
- **Estado:** scaffolding en webapp, no expuesto al usuario.

### Zeta Premium — paywall + Google Play Billing / StoreKit
- **Priority:** Medium (post-v1 launch)
- **What:** Monetización del mobile app vía suscripción o compras únicas. Funcionalidades premium previstas: widgets avanzados del dashboard, temas visuales adicionales, posibles funciones exclusivas.
- **Decisiones abiertas:**
  - SDK: RevenueCat (`react-native-purchases`) vs. self-hosted `react-native-iap`. `expo-in-app-purchases` está deprecated.
  - Modelo: suscripción (mensual/anual) vs. compras únicas por widget/tema vs. híbrido.
  - Precio en COP vs. USD como base.
  - Freemium con trial vs. gratis con premium opcional.
- **Requisitos obligatorios antes de activar:**
  - Integrar SDK de Google Play Billing (Android) + StoreKit (iOS). RevenueCat unifica ambos.
  - Crear productos en Play Console (`zeta_premium_monthly`, `zeta_premium_yearly`, etc.) y App Store Connect.
  - Completar perfil fiscal en Google Play Console → Pagos.
  - Server-side receipt validation (RevenueCat webhook → Supabase Edge Function → UPSERT `user_subscriptions`).
  - Tabla `user_subscriptions (user_id, product_id, status, expires_at, source, receipt)` con RLS.
  - Botón "Restaurar compras" en Ajustes (obligatorio Play Store + App Store).
  - Pantalla de paywall (revisar `claude-ai-design/Zeta Wireframes.html` por si hay flow definido).
  - Hook `usePremium()` + componente `<PremiumLock>` para gate de features.
  - Actualizar política de privacidad: recibir tokens de facturación (Google/Apple manejan los datos de pago, Zeta solo recibe receipt tokens).
  - Actualizar términos de servicio: renovación automática, cancelación, reembolsos.
  - Al activar, flipear respuestas en Play Console:
    - Clasificación de contenido → Compras digitales: **Sí**
    - Funciones financieras → Compras dentro de la app: **Sí**
  - Actualizar ficha Play Store con rango de precios.
- **Docs de referencia:** `docs/play-store/submission-checklist.md` sección 8.1 (recrear cuando se implemente), `docs/play-store/data-safety.md` (actualizar purchase history + user payment info).
- **Estado actual:** la primera publicación a Play Store NO incluye paywall — declarar compras digitales como **No**.

## Tech Debt

### Deudas lenses — deferred review findings (2026-06-09, branch feat/deudas-lenses)
- **Priority:** Low–Medium
- **From:** perf-auditor + zetas-front-guy gates on the /deudas 3-lens redesign.
- **What:**
  1. **Index for getDebtTrend payments query** (Medium) — `transactions_enc` has no index covering `(user_id, account_id, direction, transaction_date)`. Query is cached, so only cold-start/post-mutation cost. Migration: `CREATE INDEX CONCURRENTLY idx_transactions_enc_account_direction_date ON public.transactions_enc (user_id, account_id, direction, transaction_date DESC);` — spawn supabase-migrator.
  2. **getNonDebtAccounts still fetched eagerly** (Low) — now cached, but it's only needed when the user opens the Plata extra sheet (Plan lens). Move out of MobileDebtSection/DesktopDebtSection `Promise.all`; let `ExtraPaymentTrigger` fetch on interaction or wrap in Suspense.
  3. **Nested PANEL_INSET_CLASS in deudas-hero breakdown** (Low) — double rounded-2xl borders; inner surface should step down to rounded-xl (zetas-front-guy W4).

### Simular cambio (presupuesto) — deferred review findings (2026-06-10, branch feat/presupuesto-simular-cambio)
- **Priority:** Low–Medium
- **From:** server-action-reviewer + zetas-front-guy + perf-auditor gates on the budget-scenario sandbox.
- **What:**
  1. **Category-ownership validation in shared budget paths** (Medium) — `applyBudgetScenario` now validates line category ids against own+system categories, but the pre-existing `upsertBudgetForCategory`/`bulkUpsertBudgets` in `webapp/src/actions/budget.ts` still upsert client-supplied `category_id` without ownership check (FK only). Harden both with the same `.or(\`user_id.eq.\${user.id},user_id.is.null\`)` check.
  2. **getCushionBalance() scalar action** (Low) — `plan-tab-presupuesto.tsx` fetches the full `getAccounts()` payload just to sum CHECKING+SAVINGS balances for the scenario colchón. Add a dedicated cached function returning only the scalar; also reusable by health-meters (same computation).
  3. **Segmented-control class constants** (Low) — the Real/Simulación toggle (`scenario-section.tsx`) and the savings-rate control (`scenario-startup.tsx`) repeat the same pill-tab pattern inline; zetas-front-guy suggests `SEGMENTED_TAB_*` constants in `styles.ts` (plus a gold-active variant). Also the dashed gold add-row button appears twice → `SCENARIO_ADD_ROW_CLASS`.
  4. **Vehículo template** (Low) — entry sheet ships with Mudanza + Desde cero; design also proposed Vehículo (cuota, gasolina, seguro). Add once slug mapping for vehicle categories is decided.
  5. **Demo-mode unique-constraint collision (pre-existing)** (Low) — `budgets` unique key `(user_id, category_id, period)` doesn't include `is_demo`, so a real-mode upsert can overwrite a demo row for the same category. Affects all budget upsert paths, not just scenarios.

### packages/shared — pre-existing test failures on main (found 2026-06-09)
- **Priority:** Medium
- **What:** `pnpm test` in packages/shared fails on main: `auto-categorize.test.ts` 39 failed, `debt-stats.test.ts` 1 failed. Pre-date the deudas-lenses branch (verified via stash). CI presumably doesn't run shared tests or would have caught it. Triage whether the tests or the implementation drifted (likely category kit/keyword changes).

### Mobile ↔ Webapp parity — live walkthrough findings (2026-05-21)
- **Priority:** Resolved (10/10 closed) — follow-ups split out into separate entries below.
- **Where:** captured during the live walkthrough phase of `docs/parity-audit-2026-05-21.md` after PR #257 / #258 / #259 merged. Real-account auth on both surfaces, iPhone 16e simulator + Chrome at iPhone viewport.
- **Status:** All 10 findings closed (2026-05-23). See `HANDOVER.md` for the PR sequence (#267, #268, #269, #270).
- **What:**
  1. ✅ **Resumen del mes aggregates** — resolved by PR #262 (`computeMonthlyAggregates` in `@zeta/shared`).
  2. ✅ **Dashboard hero "ritmo"** — resolved by PR #264 (V7 hybrid hero + shared `computeRitmo`).
  3. ✅ **Transaction detail screen feature gap (M4/M5/M6/M7)** — resolved 2026-05-21 (this branch). Mobile TX detail now has: destinatario picker (read-only row + edit form picker), etiquetas chips read-only + TagSelector in edit form, "Hacer recurrente" inline action (creates a MONTHLY template prefilled from tx), "Vincular a recurrente" (queries ±30-day pending occurrences, SHA-256 group_id stamping mirrors webapp `linkExistingTransactionToOccurrence`, supports cross-account debt-payment vinculación), destructive "Eliminar transacción" button in body, header icons have `accessibilityLabel`, label changed to "Excluir de métricas".
  4. ✅ **Row-expand affordances** — resolved by PR #270 (2026-05-23). Mobile row-expand now has destinatario chip, etiquetas chip, Vincular button (gated on `canLink`) plus the existing category chip and Editar link. New `TagPickerSheet` wraps existing `TagSelector`; destinatario assign optimistically stamps `merchant_name` to mirror webapp `assignDestinatario`. Bundled perf fixes: `linkableAccountIds` stored as `string[]` + `useMemo`-derived `Set` to keep `renderItem` stable across reloads; `DestinatarioPicker` `renderItem` memoized.
  5. ✅ **POR RESOLVER pending email count** — resolved 2026-05-21 (this branch). `mobile/lib/repositories/pending-email.ts::getPendingEmailTransactionsCount()` issues a remote count via Supabase (offline → 0); `useDashboardData` now feeds the real number into `summary.attention.pendingEmails`.
  6. ✅ **Header avatar divergence** — already resolved on main. `AvatarMenuTrigger` (`mobile/components/ui/AvatarMenu.tsx`) renders the same initials-circle treatment as webapp across Inicio/Movimientos/Plan/Deudas/Presupuestos/Ajustes. Audit observation was stale.
  7. ✅ **Mobile import destinatario auto-match** — resolved by PR #269 (2026-05-23). The "wizard 4 vs 6 steps" audit observation was already stale (webapp refactored to mobile-first 4-step wizard in PR #209). The real gap was the silent destinatario auto-assignment webapp does during the review step. Mobile import now loads destinatario rules + runs `matchDestinatario` per parsed tx; stamps `destinatario_id`, inherits the destinatario's default category with `USER_LEARNED` + `0.8` confidence, overrides `merchant_name`. Forced debt-payment category still wins. New SQLite migration v14 adds `categorization_confidence` column locally.
  8. ✅ **Accessibility labels on mobile TX detail + Movimientos header** — resolved 2026-05-21 (this branch). Back / edit / trash now have `accessibilityLabel + accessibilityRole`; Movimientos "Filtrar" + "Limpiar" pills labeled.
  9. ✅ **Webapp uncategorized scope drift** — resolved by PR #268 (2026-05-23). `/accounts` AttentionCard signal now scoped to current-month OUTFLOW (matches `computeMonthlyAggregates`'s definition used by `/transactions` Resumen). Both surfaces agree. Label changed to "X gastos sin categoría este mes" to make the scope explicit. Bundled fix: lifted `todayStr` and Bogotá month bounds out of the cached fn into the wrapper so cache key participates correctly and overdue boundary doesn't drift around midnight Bogotá.
  10. ✅ **Mobile Ajustes typo** — resolved 2026-05-21 (this branch). "Perfil, sincronización, seguridad" now has the missing accent.
- **Found:** Live mobile↔webapp walkthrough, 2026-05-21, after #257/#258/#259 merged.

### Mobile movimientos row-expand — follow-ups from PR #270 review agents
- **Priority:** Low
- **What:** Items flagged during PR #270 review but intentionally deferred to keep that PR tight.
  - **Tag chip never flips to brass-assigned state.** Mobile's row-expand Etiquetas chip stays muted regardless of whether tags are assigned, because `TransactionListRow` has no tag count. Webapp's chip flips brass when any tag exists. Fix needs adding `tag_count` to the `getTransactions` SELECT (subquery against `transaction_tags`) and wiring brass tint when `> 0`.
  - **Destinatario assign — auto-category backfill + rule upsert.** Webapp `assignDestinatario` (a) backfills `category_id` from the destinatario's `default_category_id` when the tx has no category, (b) upserts a `destinatario_rule` so the pattern future-imports auto-assigns. Mobile mirrors neither — user has to set category separately and re-imports won't learn the new pattern.
  - **`bg-z-surface-2-5` is not a registered Tailwind token.** Used in 5+ existing files (`MovimientosTransactionRow`, `MovimientosHerramientas`, `MovimientosUtilidades`, `TagPickerSheet`) as `active:bg-z-surface-2-5`. NativeWind v3 silently drops the class. Either register the token in `tailwind.config.js` or sweep the codebase to use `active:bg-black-10`.
- **Found:** zetas-front-guy + mobile-sync-doctor reviews of PR #270, 2026-05-23.

### Transaction time + location — follow-ups from review agents
- **Priority:** Medium
- **What:** Non-blocking items deferred from supabase-migrator, mobile-webapp-parity, server-action-reviewer, cache-doctor, and zetas-front-guy reviews on the `claude/add-transaction-location-time-jJ7WZ` branch:
  - **DO NOT regenerate `webapp/src/types/database.ts` via `supabase gen types`** — re-confirmed 2026-05-21 (post-merge of #254) that the current Supabase CLI collapses encrypted-view Insert columns to `never`, which breaks every existing webapp write path (accounts, transactions, profiles, etc. — `Type 'string' is not assignable to type 'undefined'` on every insert with an encrypted column). The file is intentionally maintained manually. `getTransactionLocation`'s `from("transaction_locations" as never)` cast must stay until either (a) the Supabase CLI fixes the regression, or (b) we add `transaction_locations` Insert/Update/Row types to `database.ts` by hand. Low priority — single call site, fully cached.
  - **`mergeTransactionMetadata` loses `location_id` on reconcile-merge** — `packages/shared/src/utils/reconciliation.ts` returns only `{ category_id, notes, capture_method }`. When a Tier-1 PDF import wins over a Tier-3 MANUAL_FORM transaction that has `location_id` set, the UPDATE issued by `import-transactions.ts` overwrites the row without `location_id`, NULL-ing the bidirectional pointer. `transaction_locations.linked_transaction_id` still points at the tx, so a fallback lookup by `linked_transaction_id` in `getTransactionLocation` would also work. Pick one before users hit it.
  - **Mobile → webapp revalidation hook** — webapp's `getTransactionLocationCached` is tagged `"transactions"` so any webapp-side mutation invalidates it, but mobile-written `location_id` only appears on webapp after the cacheLife stale window (120s). Two paths: (a) lightweight route handler `/api/internal/revalidate?tag=transactions` called from mobile after `pushPendingChanges`; (b) Supabase DB webhook on `transactions UPDATE` → same handler. Use `revalidateTag` (SWR is acceptable for eventual consistency).
  - **OSM iframe — dark-tile theming** — the embedded map renders in OSM's default light Mapnik tiles inside the dark detail UI. Replace with CARTO dark-matter tiles, swap to a static map image, or accept the contrast (we already offer "Abrir en OpenStreetMap" as a fallback link). Decide and ship.
  - **Email-time parsing per bank** — the generic email parser sets `transaction_time` when the bank includes it, but bank-specific parsers (Bancolombia, Bogotá, Davivienda, Nu, Falabella, Nequi, Confiar, Popular) currently leave it NULL. One follow-up ticket per bank for time extraction.
  - **Retroactive location matching** — transactions created before the toggle was enabled have no `location_id` even if pings would have been available. A one-shot backfill ("Vincular ubicaciones a movimientos previos") is doable for users who opt in late.
  - **Time-aware sort within a day** — list query currently orders by `transaction_date DESC, created_at DESC`. With `transaction_time` now populated for live captures, sort should be `transaction_date DESC, transaction_time DESC NULLS LAST, created_at DESC`. Index already exists.
  - **Webapp browser geolocation** — explicitly excluded from this PR. If we revisit, the schema/RLS already support it; only the webapp form needs a one-shot geolocation prompt + permission state.
  - **TimePicker composes shadcn `<Input>`** — current `time-picker.tsx` re-implements the input shell rather than composing `@/components/ui/input`. Refactor to add a leading-icon slot to Input or a `prefixIcon` prop and remove the duplication.
- **Found:** supabase-migrator + mobile-webapp-parity + server-action-reviewer + cache-doctor + zetas-front-guy reviews on `claude/add-transaction-location-time-jJ7WZ`, 2026-05-21

### Mobile Inicio parity — follow-ups from slice-1 review
- **Priority:** Low
- **What:** Non-blocking items deferred from the zetas-front-guy + mobile-webapp-parity + /simplify + Gemini reviews on PR #215 (2026-04-23):
  - **Attention widget semantic alignment** — mobile `overdue` counts `pending_occurrences` with `occurrence_date < today`; webapp uses a dedicated `financial_reminders` source. `upcoming` lacks the webapp's 7-day cap. `pendingEmails` is hardcoded `0` on mobile — needs a real query. Same user sees different "Por resolver" counts across surfaces. Target: dedicated attention slice or slice 2.
  - **Mobile layout save rollback** — `saveDashboardLayout` optimistically applies locally and only logs on Supabase failure; the next `pullAll` silently overwrites the SQLite change. Add `setLayout(prev)` rollback mirroring webapp `persist()`.
  - **Cross-surface layout cache invalidation** — webapp `getMobileLayoutCached` tagged `dashboard-config` (stale 120s / revalidate 300s). Mobile save has no `updateTag("dashboard-config")` hook → up to 5 min of staleness on webapp. Either call a lightweight revalidation action from mobile or accept + document.
  - **`ARRANGEABLE_TYPES` coupled with `normalizeLayout`** — future `WIDGET_CATALOG` `available: true` flips will silently disappear from saved layouts on reload because both `normalizeLayout` implementations filter on the set. Gate changes behind a matching normalizer update or document the coupling in `dashboard-layout.ts`.
  - **Add `import_strip` to mobile `WIDGET_CATALOG`** — present on webapp (`available: false`), missing on mobile. Keep the arrays in sync even for disabled entries.
  - **Eyebrow token consolidation** — `SECTION_EYEBROW_CLASS` already defines `text-[10px] font-inter-semibold uppercase tracking-[4px]`. Inline repeats in `InicioRoot` (Organizar pill), `PulseWidget` (breakdown headers), `SectionDivider` (9px variant), and `ExpandableChip.ChipEyebrow`/`ChipDetailHeading` should fold into the constant.
  - **Promote `RangeChip` → shared `PillToggle`** — Pulse's Semana/Mes chips and the Organizar pill are the same shape (rounded-full, active brass border/fill, inactive white-6/black-10). Extract into `components/ui/` and reuse.
  - **Migrate `PlanExpandableChips` onto `ExpandableChip` + `ToneActionRow`** — predates the new tone palette; currently hand-rolls inline `style={{ borderColor: 'rgba(...)' }}` tint workarounds. Now that `ExpandableChip` + `ToneActionRow` own the tinting, unify.
  - **`useMemo` rendered rows in `WidgetGridRow`** — `render(w)` fires N times per summary tick. Not measurable yet; revisit if render thrash appears under frequent sync.
  - **Memoize Pulse breakdown JSX** — `formatCurrency` runs 5× per Pulse render even when the accordion is collapsed. Cheap enough to ignore today; memoize if sync ticks get chatty.
- **Found:** zetas-front-guy + mobile-webapp-parity + code-simplifier + code-reviewer + efficiency + Gemini reviews on PR #215, 2026-04-23

### Import page — defer `suggestPdfPasswordsForAccount(null, null)` to file-select time
- **Priority:** Medium
- **What:** `webapp/src/app/(dashboard)/import/page.tsx` fetches all vault suggestions for the user on every page load, even though the payload isn't read until the user picks an encrypted PDF. The action is intentionally uncached (plaintext passwords). Move the call into `StepUpload`, fired only after a file is selected and a bank key is detected. Removes one uncached SELECT from the initial render.
- **Found:** perf-auditor review, 2026-04-21 (import flow redesign).

### Consolidate `ReconcileChip` into `widget-chip`'s `ExpandableChip`
- **Priority:** Low
- **What:** `webapp/src/components/import/reconcile-chip.tsx` duplicates the `ExpandableChip` + `ChipEyebrow` pattern from `webapp/src/components/mobile/v2/inicio/widget-chip.tsx`. Layout differs (centered label/value/hint, chevron bottom-right vs space-between) and the reconcile version needs an `"alert"` tone that doesn't exist upstream. Upstream the tone first, then fold the variants.
- **Found:** zetas-front-guy review, 2026-04-21.

### Anonymous demo session — captcha + rate limiting
- **Priority:** Medium (pairs with the cleanup cron that shipped via pg_cron)
- **Context:** The daily pg_cron deletes idle anonymous users older than 7 days, but nothing stops a bot from creating 10k anonymous users in an hour. Supabase's built-in per-IP rate limit helps; captcha on the anonymous sign-in endpoint is the real guardrail.
- **What to configure (no code):**
  1. Supabase Dashboard → Auth → Rate Limits → reduce anonymous sign-ins per IP/hour (default 30).
  2. Supabase Dashboard → Auth → Captcha → enable hCaptcha/Turnstile specifically for `signInAnonymously`. Requires passing a captcha token from the client — wire it into `startDemoSession` and `startGuestSession` if enabled.
  3. Weekly observability query: `SELECT count(*) FROM auth.users WHERE is_anonymous = true;` — alert if growth spikes between cron runs.
- **Found:** PR #205 follow-up, 2026-04-21.

### Tx detail — `router.refresh()` on tag picker close
- **Priority:** Low
- **What:** `transaction-detail-client.tsx` calls `router.refresh()` after the TagZonePicker drawer closes to sync `initialTags` from the server. Could be avoided by lifting `setTags` into a `onTagsChanged` callback that TagZonePicker invokes on add/remove, so the parent updates its local `tags` state optimistically and skips the round-trip.
- **Found:** perf-auditor review on tx detail redesign, 2026-04-18

### Tx detail — zone pickers always mounted (hidden trigger)
- **Priority:** Low
- **What:** CategoryZonePicker + DestinatarioZonePicker + TagZonePicker all render on mount with `hideTrigger + controlledOpen`. They pull from context so fetches are gated, but the Radix Dialog/Drawer portals register on mount. Mount-once-on-first-open pattern would save 3 portal registrations per detail page load. Not measurable today, revisit if picker count grows.
- **Found:** perf-auditor review on tx detail redesign, 2026-04-18

### `useRecurringMonth` callbacks use `router.refresh()` instead of `startTransition`
- **Priority:** Medium
- **What:** All three callbacks in `use-recurring-month.ts` (`confirmPayment`, `skipPayment`, `linkExisting`) call `router.refresh()` after the server action. Should wrap in `startTransition` instead — `router.refresh()` is a redundant network round-trip.
- **Found:** cache-doctor review, 2026-04-14

### `inicio-activity.tsx` non-token colors
- **Priority:** Low
- **What:** `bg-green-500/12` and `bg-orange-500/12` should be `bg-z-income/12` and `bg-z-expense/12`. Also eyebrow uses `text-[9px] font-bold` instead of `SECTION_EYEBROW_CLASS`.
- **Found:** zetas-front-guy review, 2026-04-14

### `recurring-confirm-inline.tsx` surface token
- **Priority:** Low
- **What:** Uses `bg-muted/50` (shadcn token) instead of Zeta surface tier token (`bg-z-surface-3/60` or `bg-black/20`).
- **Found:** zetas-front-guy review, 2026-04-14

### Shared PickerShell component
- **What:** Popover/dialog/drawer branching is duplicated across 3 zone pickers (~40 lines each, ~120 total). A shared `PickerShell` accepting `{ open, onOpenChange, trigger, title, icon, body, variant }` would eliminate the duplication.
- **When:** Extract when a 4th picker is added or when touching all 3 pickers.
- **Found:** Code reuse review, 2026-04-13

### Mobile `InicioMetricsGrid` "Gasto hoy" migration to `ExpandableStatTile`
- **Priority:** Low
- **What:** Slice-1 extracted `mobile/components/ui/ExpandableStatTile.tsx` and migrated the import reconcile grid, but `InicioMetricsGrid` "Gasto hoy" was left on its bespoke `PANEL_INSET_CLASS` chip shape (different value size, ring-chart sibling, compact currency formatter). A future pass should either (a) widen `ExpandableStatTile` with a `variant="inset-compact"` option to absorb it, or (b) extract a sibling `CompactStatTile` primitive. Worth doing next time we touch either surface.
- **Found:** zetas-front-guy follow-up on slice-1, 2026-04-19

### Mobile Afford — follow-up polish from slice-5 review
- **Priority:** Low
- **What:** Non-blocking items deferred from the zetas-front-guy / frontend-auditor / ux-analyst review on PR #197:
  - Extract the private `MetricTile` in `mobile/app/purchase-decision.tsx` into a shared `mobile/components/ui/StatTile.tsx` (non-interactive variant of `ExpandableStatTile`). Reuse opportunity flagged by multiple reviewers across slices.
  - Wishlist save errors currently reuse the top-level `setError` slot, which renders above the Analizar button. After a result is visible, wishlist errors appear far from the wishlist CTA that produced them. Add a local inline error under the "Guardar en deseos" button.
  - Surface `selectedAccount.name` in the verdict hero ("Con tu cuenta Bancolombia…") to anchor the analysis context.
  - Re-tapping Analizar while `savedToWishlist === true` silently resets the saved confirmation. Either preserve the flag when inputs are unchanged (stable input hash) or show a subtle toast "Guardaste una versión anterior".
  - Engine-level: when `urgency === "NECESSARY"` but verdict is `NOT_RECOMMENDED`, add a dedicated reason that names the tension ("Aunque lo marcaste como necesidad, tu colchón no aguanta este gasto.") — UI is already ready to render it.
  - `w-[47.5%]` arbitrary value on `MetricTile` — swap to `basis-[47%] flex-grow` or normalize container paddings and use `w-1/2 minus gap`.
  - Treat SQLite `SQLITE_CONSTRAINT_UNIQUE` (code 19) as success when saving to deseos (currently shows a red error for what should be a no-op).
- **Found:** agent review sweep on PR #197, 2026-04-19

### Mobile onboarding — follow-up polish from slice-2 review
- **Priority:** Low
- **What:** Non-blocking items deferred from the zetas-front-guy / frontend-auditor / ux-analyst / mobile-sync-doctor / mobile-webapp-parity reviews on PR #195:
  - Money input formatting — thousand separators + currency prefix so `5000000` renders as `$ 5.000.000 COP`. Meatier change; extract a shared `MoneyInput` component when we touch it.
  - Purpose acknowledgement on step 2 title/eyebrow — "Vamos a ayudarte a salir de deudas, {firstName}" instead of generic "Tu perfil". Reinforces the step-1 choice.
  - `save_money` reinforcement on step 3 — when `available > 0`, add a Narrator line: "Con eso podrías apartar {X} al mes para tu meta."
  - `profiles.debt_count` schema column — reference captures the count but there's no home for it. Add via supabase-migrator. Then onboarding can persist it.
  - `firstName` saved into `full_name` column — either rename DB column or add a `first_name` column so intent matches storage.
  - Error surface auto-scroll — on submit failure, scroll the error into view near the action bar.
  - Extract `SelectPill` primitive — currency pills + account-type pills + purpose tiles share the "radio-button with brass highlight" shape. Consolidating into one `components/ui/SelectPill.tsx` would DRY ~60 lines across steps.
  - `SECTION_EYEBROW_CLASS` tracking fix — `mobile/lib/constants/styles.ts:39` defines `tracking-[4px]` while the design system uses `tracking-[0.18em]`. The onboarding steps avoid the constant and inline the correct tracking, but any consumer that adopts the constant will get wrong tracking.
  - Webapp onboarding `locale` default — `webapp/src/app/onboarding/page.tsx:130` uses `navigator.language || "en-US"`. Mobile hardcodes `"es-CO"`. Changing the webapp fallback to `"es-CO"` aligns both platforms on the target-region default.
  - Webapp onboarding atomicity — `webapp/src/actions/onboarding.ts` has the same "update profile, then insert account" ordering that mobile just fixed. Also swap the webapp, or extract a shared `finish_onboarding(p_profile jsonb, p_account jsonb)` SECURITY DEFINER RPC so both platforms get true transactional behaviour.
  - `CurrencyCode` type in `mobile/components/onboarding/types.ts` is missing `PEN | CLP | ARS` relative to the DB enum. Expand when the picker grows.
- **Found:** agent review sweep on PR #195, 2026-04-19

### Mobile import wizard — follow-up polish from slice-1 review
- **Priority:** Low
- **What:** Non-blocking items deferred from the zetas-front-guy / frontend-auditor / ux-analyst review on PR #193:
  - `mobile/components/import/CreditCardSummary.tsx:242-270` — private `PeriodTile` duplicates `ExpandableStatTile`. Migrate.
  - `mobile/components/import/import-theme.tsx` — `themeClasses()` is a diverged copy of `themeSurfaceClasses()` in `lib/theme.tsx`. Remove entirely; consumers should call `themeSurfaceClasses(mode)` directly.
  - `mobile/lib/constants/colors.ts` — settings theme swatches (`#1E221E`, `#18181b`) should become `COLORS.surface2` / `COLORS.surface2Neutral` tokens so they can't drift silently.
  - `mobile/app/(tabs)/import.tsx:1355` — `AnimatedAccordion estimatedHeight={1200}` for the Row-2 reconcile panel is a worst-case estimate that produces blank-space flicker on short lists. Switch to dynamic `onLayout`-measured height (or reduce the estimate) once `AnimatedAccordion` grows a measured-mode.
  - `mobile/app/(tabs)/import.tsx:622-670` — `handlePrepareImport` calls `getReconciliationCandidates` then `getReconciliationCandidateById` per match (two awaits per item). Can be flattened to a single query that returns the full candidate in one pass — highest-latency path in the wizard.
  - UX: Narrator voice (Kalam) is used for both page-level annotations and in-panel empty states; should be reserved for the page-level summary. Convert in-panel empty states to plain `text-xs italic text-z-sage-dark`.
  - UX: `CreditCardStackCard` lacks a visible "linked" signal between the per-currency cards (both read as independent). Add an eyebrow header "Tarjeta · N monedas" above the stack.
  - UX: Step 2 → Step 3 → Step 2 loses scroll position on the review list — preserve offset on back.
  - UX: `ItemSeparator` uses `ml-12` but the checkbox indent is ~28px; hairline misaligns.
  - `mobile/app/(tabs)/import.tsx:981-989` etc. — `ImportProgress` + "Paso X de 4" eyebrow are redundant. Drop the eyebrow.
- **Found:** agent review sweep on PR #193, 2026-04-19

## Session handoff — 2026-04-18

### Shipped this session (merged to main)
- **PR #183** — tech-debt Wave 1 (tokens + createCachedClient pattern)
- **PR #184** — tech-debt Wave 2 (transaction_tags RLS hardening + WITH CHECK)
- **PR #185** — tech-debt Wave 3 (corrupted email-PDF cleanup script; dry-run found 0 prod rows)
- **PR #186** — has_auth guard on every encrypted view trigger
  - 14 trigger functions rebuilt across 7 tables (capture_tokens, destinatarios, email_ingest_addresses, profiles, recurring_templates, statement_snapshots, wishlist_items)
  - Gemini's perf refactor applied: `SELECT * INTO _old <tbl>_enc` instead of N preserve-subqueries on no-auth UPDATE path
  - Two migrations: `20260417193237_has_auth_guard_encrypted_triggers.sql` + `20260417203708_has_auth_guard_select_into_refactor.sql`
  - Pre-existing accounts/pdf_passwords/transactions update functions still on subquery form — out of scope, can refactor later if desired

### Discovered this session — added to backlog
- **Telegram webhook capture_tokens admin path** (Bugs section, Medium): both SELECT and UPDATE through view never worked end-to-end. Needs `set_capture_token_label` + `find_capture_token_by_chat_id` SECURITY DEFINER RPCs. Pre-existing, surfaced by supabase-migrator on PR #186.

### Triage candidates for next session
1. **Dashboard RECIENTE inline category assignment** (Features, High) — single-component, well-scoped, big UX win
2. **Promote-to-recurring success state** (Bugs, Med) — small user-facing polish
3. **Recurring templates — review unran 20260416 merge** (Bugs, Med) — needs audit SQL + merge migration
4. **Telegram webhook RPCs** (newly added Bug, Med) — completes encryption hardening story
5. **Mobile Apple/Play compliance prep** (Features, High) — user-blocked on assets; tech prep can run in parallel

### State
- Working dir: clean on main after PR #186 merged
- No active agent threads
- All Gemini comments on shipped PRs replied to and resolved or declined

## Session handoff — 2026-04-21

### Shipped this session
- **PR #204** — Flow 02 webapp mobile dashboard redesign (Variant B) — Pulse hero, chip-based widget grid with pack rows + shared accordion, arrangeable widgets zone, catalog sheet, Gemini comments addressed (useId for SVG gradient, optimistic-rollback snapshot on persist failure). *Merged.*
- **PR #205** — Flow 01 onboarding redesign + anonymous demo session. See the Flow 01 entry above for the full rundown.

### Discovered this session — added to backlog
- **Anonymous demo cleanup cron + rate limiting** (Tech Debt, Medium) — necessary follow-up to PR #205's anonymous "Ver demo" entry point. Scheduled deletion of anonymous users older than 7 days + captcha on the anonymous sign-in endpoint.

### Triage candidates for next session
1. **Anonymous demo cleanup cron** (newly added Tech Debt, Medium) — short migration or cron route, unblocks scaling the demo CTA.
2. **Flow 02 PR 3** — true drag-to-reorder + inline S/M/L resize for the widget zone (wireframe "Arrange" frame). Reanimated + gesture-handler work.
3. **Flow 03 webapp** — Add transaction rethink. Three variants in the wireframe, need to pick one before building.
4. **Flow 07 webapp** — "Can I afford it?" redesign. Mobile slice-5 shipped, webapp hasn't been touched yet.
5. **PR #190 drag-envelope UX review** — still pending user re-evaluation of long-press timing + assignment removal path.

## Session handoff — 2026-04-21 (evening)

### Shipped this session
- **PR #209** — Flow 04 Variant A: mobile-first 4-step import wizard + queue refactor. *Merged.*
- **PR #210** — Flow 03 webapp: Layout B transaction form redesign. *Merged.*
- **PR #211** — Flow 07 webapp: dedicated `/puedo-pagar` page replacing the old dialog + drawer. Includes `saveAffordToWishlist` server action, expanded widget with inline explainer + CTA, MobileLinkGrid entry. Gemini comments addressed (dynamic month, accountId effect-init; `parseMoney` declined — webapp `CurrencyInput` already strips formatting). *Merged.*

### Triage candidates for next session
1. **Anonymous demo cleanup cron** (Tech Debt, Medium) — still pending.
2. **Flow 02 PR 3** — drag-to-reorder + S/M/L resize for dashboard widget zone (Reanimated + gesture-handler).
3. **Flow 05 Plan redesign** — decide: PR #170 polish sufficient, or full Variant A pass?
4. **PR #190 drag-envelope UX review** — long-press timing + assignment removal path still pending re-evaluation.
5. **Bugs** — promote-to-recurring success state, recurring templates 20260416 merge audit, telegram webhook RPC migration.

## Session handoff — 2026-04-22

### Shipped this session
- **PR #212** — Mobile capture crea destinatario + recurrente + cuentas v2 tokens. *Merged* (commit `5d22762`).
  - `mobile/app/capture.tsx`: replaced `Alert("Próximamente")` stubs with Switch toggles that run alongside `createTransaction`. DEBT account (CREDIT_CARD/LOAN) guard at UI + repo layers.
  - `mobile/lib/repositories/destinatarios.ts` + `recurring.ts`: new write methods (`createDestinatarioWithPattern`, `createRecurringTemplate`) with local INSERT + sync_queue enqueue. SQLite migration v10 adds `destinatario_id` to `recurring_transaction_templates` for linkage.
  - `mobile/lib/sync/queue.ts`: new `enqueueInsert/Update/Delete` helpers — used by the two new repos.
  - `mobile/components/accounts/AccountFormFields.tsx`: extracted `FormField`, `NumericInput`, `DayPicker` (were duplicated byte-for-byte between create + edit).
  - `mobile/app/(tabs)/accounts.tsx` + `account/create.tsx` + `account/edit/[id].tsx` + `AccountTypeGrid.tsx` + `CurrencyPicker.tsx`: pre-v2 light-mode classes (`bg-gray-100/white`, `text-gray-500/900`, `bg-primary`) → v2 tokens (`bg-background`, `text-foreground`, `bg-z-brass`, `PANEL_SURFACE_SUBTLE_CLASS`, etc.) + `MobileHeader`.
  - Supabase migration `20260422003433_auto_generate_recurring_occurrences.sql` + `20260422010000_refine_recurring_occurrence_trigger.sql`: AFTER INSERT/UPDATE trigger on `recurring_transaction_templates_enc` auto-generates `recurring_occurrences` for current month + 14 days. UPDATE trigger has `WHEN` clause so it only fires on schedule changes.
  - Audit/gate agents run: `mobile-webapp-parity`, `mobile-sync-doctor`, `feature-dev:code-reviewer`. Gemini comments addressed (param reassignment fixed; drift logged as cross-cutting backlog item).

### Triage candidates for next session
1. **Mobile capture amount live-formatting** (Bugs, Medium) — COP thousand grouping while typing. ~30 min slice. Finishes the capture flow polish arc.
2. **Recurrence engine end-of-month drift** (Bugs, Medium) — paired `@zeta/shared/recurrence.ts` + Supabase trigger fix. Medium lift, rewards users with calendar-end recurring payments (31st of month).
3. **Anonymous demo cleanup cron** (Tech Debt, Medium) — still pending from last session.
4. **Flow 02 PR 3** — drag-to-reorder + S/M/L resize for dashboard widget zone.
5. **Subscriptions.tsx / bug-report.tsx / annotate-screenshot.tsx / purchase-decision.tsx** — mobile stubs flagged in the mobile audit (2026-04-22). Lower urgency.

### Memory added
- `feedback_webapp_source_of_truth.md` — principle that webapp is canonical; mobile mirrors. Parity gate before any mobile Supabase mutation. Drove the "fix drift in both places or not at all" decision on Gemini's recurrence comments.

## Session handoff — 2026-04-22 (evening)

### Shipped this session
- **PR #213** — `feat(mobile): captura formatea monto con separadores de miles`. *Merged* (commit `79aff3f`).
  - `mobile/app/capture.tsx`: TextInput muestra formato COP en vivo (`124124` → `124.124`) mientras el usuario escribe.
  - `mobile/lib/amount.ts`: nuevas `formatAmountInput` + `parseFormattedAmount` (dot = miles, coma = decimal); helper privado `isDecimalTail`. `parseLocalizedAmount` intacta — otros inputs numéricos (subscriptions, edit tx, budgets, plan sheets) no cambian.
- **PR #214** — `fix(recurrence): corrige drift de fin de mes en ambas implementaciones`. *Merged* (commit `551fc80`).
  - `packages/shared/src/utils/recurrence.ts`: `occurrenceAt(start, k, freq)` reemplaza `advanceByFrequency(current, freq)`. Ancla en `start_date` con contador `k` → Jan 31 MONTHLY preserva 31 (Feb 28 solo cuando hay clamp).
  - `supabase/migrations/20260422020000_fix_recurrence_eom_drift.sql`: mismo patrón con `v_start_date + (v_step * interval '1 month')`; un solo loop que inserta cuando `v_cursor >= v_range_start` (colapsa doble CASE).
  - 8 tests cubren Jan 31 / Jan 30 MONTHLY, Jan 31 QUARTERLY, Feb 29 ANNUAL en años no bisiestos, WEEKLY y `getNextOccurrence`.
  - Gemini HIGH comments atendidos: `toISOString().split("T")[0]` reemplazado por `format(d, "yyyy-MM-dd")` (date-fns) en las 4 apariciones para evitar off-by-one en zonas este de UTC.
  - `recurring-doctor` agent: PASS. Alcance: solo nuevas generaciones; ocurrencias ya drifted no se auto-corrigen.

### Pipeline
Gate pipeline: implement → `/simplify` (3 reviewers en paralelo) → aplicar (SQL CASE colapsado, `isDecimalTail` extraído) → Gemini review → aplicar fix (date-fns format) / declinar (2-decimal cap intencional).

### Triage candidates for next session
1. **Anonymous demo cleanup cron** (Tech Debt, Medium) — aún pendiente desde 2026-04-21.
2. **Flow 02 PR 3** — drag-to-reorder + S/M/L resize para widget zone del dashboard (Reanimated + gesture-handler).
3. **Backfill de ocurrencias drifted** — `recurring_occurrences` pendientes con fechas mal generadas (ej. Feb 28 de plantilla Jan 31) no se auto-corrigen. Migración opcional: delete `status='pending' AND generated_before fix_date` + regenerar. Bajo impacto — el próximo ciclo natural ya generará bien.
4. **Consolidar helpers de formato de monto en `@zeta/shared`** — `formatAmountInput`/`parseFormattedAmount` (mobile) y `formatDisplay`/`stripFormatting` (webapp `currency-input.tsx`) hacen lo mismo. Subir uno al shared package. Low priority.
5. **Mobile stubs** — `subscriptions.tsx`, `bug-report.tsx`, `annotate-screenshot.tsx`, `purchase-decision.tsx` (usuario indica: bug-report + annotate no se usan, bajar prioridad o eliminar).
6. **PR #190 drag-envelope UX review** — aún pendiente.

## Session handoff — 2026-04-22 (late night)

### Shipped this session
- **PR #221** — `feat(mobile): Movimientos parity slice 1 + perf refactor + mobile-perf-doctor agent`. *Merged* (commit `81229c3`).
  - Movimientos parity: `MovimientosRoot` (FlatList + pagination), `Lectura` (3-col summary + expandable SVG flow-by-day chart + rotating ChevronDown affordance), `Herramientas` (Categorizar + Importar chips with expandable inline panel, retain-last-tool close animation), `Utilidades` (search pill + MobileSheet filter drawer), `TransactionRow` (memoized, account dot + name, Categoría + Editar chips).
  - Perf: React.memo'd rows with stable `TransactionListRow` refs (no toItem wrapper), hoisted + conditionally mounted `CategoryPickerSheet`, request-id race guard, `txCountRef` to stop `loadData` recreation on append, summary totals via new `getMonthlyAggregates` SQL rollup (prev: summed paginated feed, numbers grew as user scrolled).
  - New agent `.claude/agents/mobile-perf-doctor.md` + `CLAUDE.md` review-gate entry. Bible sections §3.2 (AnimatedAccordion scale/close/affordance rules), §4.4 (race guards), §5.2 (summary totals from SQL) added during this PR's own review cycle.
- **PR #221 follow-up commit** — Gemini review fixes: `toISOString` timezone bug, useFocusEffect dep simplification, React.memo on Lectura/Herramientas + stabilized callbacks to stop chart re-render on search typing, narrowed `getTopUncategorized` SELECT. Also fixed pre-existing `mobile/lib/demo-data.ts` broken imports (category constants renamed in shared package; demo mode had been compile-broken).
- **`.github/workflows/mobile-pr-verify.yml`** — new CI workflow. Runs `pnpm install --frozen-lockfile` + `npx tsc --noEmit` against `mobile/` on every PR touching `mobile/**`, `packages/shared/**`, or root lockfile. Proven green on PR #221. Mobile now has the same pre-merge gate the webapp has via `pr-build-images.yml`.

### Parity/infra follow-ups committed on branch `chore/movimientos-followups`
- `categorization_source` alignment: mobile `updateTransaction` now flags `USER_OVERRIDE` on any category change (assign OR clear), matching webapp (`actions/transactions.ts:841` uses `categoryChanged`, true in both directions). Prior mobile behavior wrote `null` on clear — diverged from webapp.
- `getTransactions SELECT t.*` narrowing was considered, **declined for now**: 6 callers each consume many columns; narrowing is a real refactor with marginal perf gain (mobile SQLite rows are plaintext, no encrypted-column parse cost). Filed as a low-priority follow-up below.

### Triage candidates for next session
1. **Dogfood `mobile-perf-doctor` on main** — agent was registered during PR #221 so existing sessions can't see it. Next session will have it. Spawn as a retroactive audit against `mobile/components/movimientos/*` to validate the bible rules on the merged code, then on whatever tab we polish next.
2. **Mobile tab polish — pick one:** Budgets (smallest; still pre-v2 tokens `bg-z-surface-2-55`), Plan (`PlanRoot` parity vs `/plan` webapp; high-traffic), Deudas (`DeudasRoot` parity vs `/deudas`; high-visibility), or Movimientos slice 2 (destinatario/tag/vincular chips + email-pending sync — large, reopens recently-shipped files).
3. **Narrow `getTransactions` SELECT** (deferred from PR #221 Gemini review) — 6 callers, marginal gain. Do only when refactoring the repo anyway.
4. **Anonymous demo cleanup cron** — still pending from 2026-04-21.
5. **Flow 02 PR 3** — drag-to-reorder + S/M/L resize for the dashboard widget zone.
6. **Mobile stubs** — `subscriptions.tsx`, `bug-report.tsx`, `annotate-screenshot.tsx`, `purchase-decision.tsx` (user: bug-report + annotate unused — consider delete).
7. **PR #190 drag-envelope UX review** — still pending.
8. **Backfill drifted `recurring_occurrences`** — opt-in migration.

### Memory added / updated
- `feedback_mobile_perf_doctor.md` — commitment to grow the agent's bible after every mobile perf bug debugged.
- `.claude/agents/mobile-perf-doctor.md` — added §3.2 AnimatedAccordion close-animation + scale rules, §4.4 race guards on paginated loaders, §5.2 summary totals from SQL.

## Session handoff — 2026-04-22 (Plan polish)

### Shipped this session
- **PR #224** — `feat(mobile): Plan page polish` — open on `feat/mobile-plan-polish`.
  - `PlanNetHero` rewritten: always-visible inline SVG mini-chart (balance polyline, past solid / future dashed, today marker, zero line) + `AnimatedAccordion` breakdown (ingresos/fijos/gasto libre tinted panels + bottom-line math). Wrapped in `React.memo`.
  - New `PlanWeekTiles` (replaces `PlanExpandableChips`): two expandable tiles (próximo pago/ingreso) using shared `ExpandableChip` + `ChipEyebrow` + `ChipDetailHeading` primitives. Sooner-date tile gets brass ring hint; opposite dims when one is active. Accordion panel renders full pending list + "Crear en Recurrentes" CTA on empty state.
  - New `PlanToolsChips` (replaces `PlanDrillCards`): 3 plain chips (Presupuesto/Periodo/Recurrentes) with brass lucide icons + narrative status — alert words emphasized via `text-z-brass-hot`, no red/yellow tinted surfaces. Deseos removed from Plan entirely (lives in dashboard widget + `/puedo-pagar`).
  - `PlanRoot`: dropped `getWishlistCount` + `getActiveTemplates` queries. Planned totals now derived from occurrences (paid+pending+skipped sum) instead of `toMonthlyAmount × frequency` — more accurate and one less query. UTC→local date bug fixed via `toLocalDateString`.
  - New `/presupuesto` stack route (`mobile/app/presupuesto.tsx`) renders `<BudgetsRoot variant="sub">` for the back-arrow context. `BudgetsRoot` gained an optional `variant: "main" | "sub"` prop. Plan's Presupuesto chip now routes here instead of `/(tabs)/budgets`.
  - `/periodo` SWR cache: screen was spinning on every focus because planning_* tables aren't in `SYNC_TABLES`. Shipped module-scope cache at `mobile/lib/sync/periodoCache.ts` keyed by user_id, wired `clearPeriodoCache()` into `handleUserBoundary` (logout + user-switch).
  - Deleted 5 dead/replaced files: `PlanFlowChart`, `PlanExpandableChips`, `PlanDrillCards`, `PlanRecurringSummary`, `PlanBudgetSection`. Net: -540 lines across the feature folder.
  - `mobile/.gitignore` now excludes `*.aab` + `*.apk` (rescued a failed push where a 108MB EAS build was accidentally staged).
- **`.claude/agents/mobile-sync-doctor.md`** — new rule §6 "Screen data source" catches screens that hit Supabase directly instead of going through repositories. Added failure-pattern example with SWR cache snippet. User declined a separate `mobile-cache-doctor` agent — sync-doctor is the right home.

### Discovered this session — added to backlog
- **Mobile sync — planning_* tables** (Medium). Proper fix for `/periodo` SWR workaround.
- **Webapp mobile/v2/plan — parity with native execution hero** (Medium). Direction picked: port native's hero back to webapp. Requires expanding `getPlanPageData()` shape.

### Pipeline
Design preview → 3-col HTML mock (`claude-ai-design/plan-mobile-proposal.html`) → user picks direction → implement → `perf` + `zetas-front-guy` reviewers (parallel) → fix tokens+a11y+memo → `mobile-sync-doctor` + `feature-dev:code-reviewer` (parallel) → fix UTC date bug + accordion clip + cache leak → `/simplify` (reuse + quality + efficiency parallel) → fix ExpandableChip reuse + drop templates query + CHIP_CONFIG table → rescue from failed push (aab in gitignore).

### Triage candidates for next session
1. **Proper /periodo sync** — port planning_* tables into the engine + delete `periodoCache.ts`. Medium.
2. **Webapp mobile/v2/plan parity PR** — port native execution hero to webapp. Medium.
3. **Anonymous demo cleanup cron** — still pending since 2026-04-21.
4. **Flow 02 PR 3** — dashboard drag-to-reorder + S/M/L resize.
5. **Mobile tab polish — Deudas** (next in the sweep after Plan). Or Movimientos slice 2 if we want to return to that arc.

## Session handoff — 2026-04-23

### Shipped this session
- **PR #225** — `feat(mobile): /periodo sync via SQLite + opt-in BugFAB`. *Merged* (commit `36d2159`).
  - Planning sync: `planning_periods` / `planning_entries` / `planning_assignments` ahora viven en SQLite + pasan por el sync engine. DB_MIGRATIONS v11 mirror exacto de Supabase (con `currency_code`), `UNIQUE(income_entry_id, expense_entry_id)` + FKs.
  - `mobile/lib/repositories/planning.ts`: reads (`getActivePeriod`, `getPeriodEntries`, `getPeriodAssignments`, composite `getActivePeriodWithEntries`) + writes (`markEntryCompleted`, `updateAssignmentAmount`, `deleteAssignment`, `createAssignment`) con SQLite + `enqueueInsert/Update/Delete` en transacción.
  - `mobile/lib/repositories/recurring.ts`: nueva `getTemplatesByIds(ids)` (fix N+1 flagged en review).
  - `mobile/app/periodo.tsx` `loadData`: cero Supabase directo, lee solo de repos.
  - `PaymentSheet.tsx` + `ReassignSheet.tsx`: escrituras a `planning_entries` / `planning_assignments` via repo. `ReassignSheet` gana `periodId` prop — elimina el fallback de re-fetch a Supabase.
  - `mobile/lib/sync/periodoCache.ts` **eliminado**. Callsites en `auth.tsx` removidos.
  - BugFAB opt-in: `BugReportProvider` persiste `isFabEnabled` en SecureStore (`zeta.bug_fab_enabled`, default OFF). `BugFAB` devuelve `null` si off. ToggleRow en Ajustes → Privacidad y soporte.

### Discovered this session — added to backlog
- **Mobile /periodo PaymentSheet — pre-existing parity bugs** (High, data integrity). 5 findings flagged por `mobile-webapp-parity`: `description` en vez de `raw_description`/`clean_description`, idempotency key sin hash, `linked_manually: true` faltante, `recurrence_group_id` no stampado, balance delta faltante en create-mode. Pre-existentes en main, out-of-scope del PR para mantenerlo revisable.
- **Mobile Settings v2 polish** (Medium). Usuario quiere planificarlo con calma antes de tocar. Este PR solo metió la ToggleRow del BugFAB; todo lo demás (IdentityHero, agrupación, spacing, tipografía, orden de secciones) queda para sesión de diseño.
- **Mobile Plan — restaurar FLUJO DEL MES chart** (Medium). Chart de flujo diario (balance line + markers + hoy + totales) se perdió en rediseño PR #224. User quiere de vuelta. Scope: `PlanFlowSection` nuevo o expandable dentro de `PlanNetHero`.

### Pipeline
orient → mobile-sync-doctor + mobile-webapp-parity (paralelo) → fix push.ts type union → zetas-front-guy + feature-dev:code-reviewer (paralelo) en BugFAB → revert settings polish por discusión con calma → review PR → aplicar fix N+1 (`getTemplatesByIds`) → responder Gemini (falso positivo, recomendó lo ya hecho).

### Triage candidates for next session
1. **Webapp mobile/v2/plan parity** — port native execution hero a webapp (expandir `getPlanPageData()` shape). Pendiente desde 2026-04-22.
2. **PaymentSheet parity bugs** (nuevo, High) — fix los 5 gaps vs webapp. Data integrity issue, prioridad real.
3. **Anonymous demo cleanup cron** — pendiente desde 2026-04-21.
4. **Flow 02 PR 3** — dashboard drag-to-reorder + S/M/L resize.
5. **Mobile tab polish — Deudas** (próximo en el sweep) o Movimientos slice 2.
6. **Settings v2 polish** — sesión de diseño antes de tocar TSX.
7. **Restaurar FLUJO DEL MES chart** en Plan.

---

## Session handoff — 2026-04-28

### Shipped this session
- **PR #230** — `feat: Phase 1 IA shell — nav_focus, /gestionar redesigned as Más, Rappi-case account creation`. *Merged*.
  - Migration `20260428120000_add_nav_focus_to_profiles.sql`: 6-step view+trigger rebuild adding `nav_focus` enum (`PLAN`/`DEBT`) on `profiles_enc`. Backfill: `manage_debt` purpose → `DEBT`.
  - `NavFocusProvider` en `webapp/src/components/providers/nav-focus-provider.tsx`. Mounted en `(dashboard)/layout.tsx`. `useNavFocus()` consumido por mobile tab bar para slot variable.
  - `webapp/src/lib/constants/mobile-nav.ts`: `getMobileTabs(focus)` → 3 tabs + Más + FAB. Tercer slot Plan|Deudas.
  - `webapp/src/components/mobile/mobile-link-grid.tsx`: 4 secciones (Cuentas y saldos · Organizar · Planificar · Sistema) con `SECTION_EYEBROW_CLASS`. Tab inverso al `nav_focus` aparece bajo Planificar.
  - `/gestionar` retitulado a "Más" (no rename de ruta — mantener bookmarks existentes).
  - Onboarding actions: `finishOnboarding` deriva `nav_focus`. Settings → toggle `Foco principal`.
  - Rappi-case fix: empty state `/accounts` promueve `Crear cuenta manual` con `BRASS_BUTTON_CLASS`. FAB ya existía.

- **PR #231** — `chore: app store ios submit config`. *Merged*. `mobile/app.json` + `mobile/eas.json` + `docs/app-store/` (LISTING_ES.md, README, screenshots/preview specs). **No subió build todavía** — es solo config + checklist para próxima sesión.

- **PR #232** — `feat: Phase 2 onboarding — trim + skip path + currency from timezone`. *Merged*.
  - 5 steps → 3 funcionales + celebración. Step 1 welcome con CTA `Comenzar` + secundaria `Saltar configuración y explorar`.
  - `webapp/src/lib/utils/currency-from-timezone.ts`: IANA → CurrencyCode (Bogota→COP, Mexico_City→MXN, Sao_Paulo→BRL, Lima→PEN, default COP). Auto-detected — currency step eliminado.
  - `skipOnboardingWithDefaults({ full_name, timezone })` server action: idempotency guard (lee `onboarding_completed`), Zod (`timezone` regex `^[A-Za-z]+/[A-Za-z_/]+$`, name max 120), `null` para name (no placeholder), inserta "Mi cuenta" CHECKING $0. Defense-in-depth `.eq("user_id", user.id)`.
  - Step 3 usa `<SectionDivider label="Primera cuenta" />` per TOKENS.md §5 (no más `border-t border-white/6 pt-5`).
  - Skip handler con `try/finally` + `trackClientEvent("onboarding_skipped")` antes de `router.push("/dashboard")` (Gemini fix).

- **PR #233** — `chore: quick-wins sweep (BACKLOG #4 + #7)`. *Merged*.
  - PDF parser: `services/pdf_parser/main.py` añadió `_statements_have_content()`. Detector match con statements vacíos ahora levanta `ValueError` → fallback path → 422 `unsupported_format`. Antes el contenido vacío caía silencioso.
  - `webapp/src/actions/email-pdf-ingest.ts`: removed redundant `revalidateFinancialViews()` from `markEmailPdfStatementImported` (caller `importTransactions` ya lo dispara).
  - `webapp/src/app/(dashboard)/transactions/[id]/transaction-detail-client.tsx`: DialogFooter raw `<button>` → shadcn `<Button>` con `cn(DESTRUCTIVE_BUTTON_CLASS, "font-semibold")` (Gemini real regression — shadcn Button defaultea a `font-medium`, perdía peso visual).
  - `webapp/src/lib/constants/styles.ts`: añadido `DESTRUCTIVE_GHOST_BUTTON_CLASS`.
  - Removidos del BACKLOG: items #1, #2, #3, #6, #8 del antiguo "Quick wins" (5 ya estaban resueltos en main por PRs intermedios).

### Discovered this session — added to backlog
- **PDF redaction editor** (Low). User idea: si parser falla con `unsupported_format`, ofrecer enviar PDF a devs — pero antes permitir censurar datos sensibles (montos exactos, números de cuenta) con un editor in-browser. Diferido a future session.
- **/import "Tu banco no aparece" CTA removido** — reemplazado por mejor empty state en `/accounts`. Si parser falla, futuro CTA pedirá consentimiento para enviar PDF a devs (depende del redaction editor).

### Pipeline
plan mode (3 fases) → spawn supabase-migrator (PR #230) → server-action-reviewer + zetas-front-guy (Phase 2) → respond Gemini (PR #230 ValueError → 500 falso positivo, parser ya mapea 422; PR #232 skip handler analytics order; PR #233 font-semibold real regression) → drain quick wins → switch to main + handoff.

### Outstanding — Phase 3 (deferred)
- **Préstamos** — table `prestamos_enc` + view + INSTEAD OF triggers, `prestamo_events_enc` lifecycle log, `/prestamos` page (Me deben / Debo), CRUD + event logging, link opcional a transactions vía `transaction_id`. Detallar diseño cuando phase 1+2 estén soak'd.

### Outstanding — mobile native parity
Expo app sigue con estructura 4-tab. Ports pendientes del IA refactor:
- `nav_focus` en SQLite + sync engine
- Tab bar con tercer slot variable
- `/mas` o equivalente nativo (drawer? page?)
- Onboarding nativo trim + skip path

### Balance history chart: SOD vs EOD (cross-platform, P2)
- Surfaced by Gemini review on PR #252 (`mobile/lib/repositories/accounts-detail.ts:62`). The current `dailyMap.set(p.date, p.balance)` after the descending walk + `reverse()` stores the **last** balance written per date, which for non-today dates ends up being a pre-tx (start-of-day) value rather than the end-of-day balance financial charts conventionally show.
- **Webapp has the same algorithm** (`webapp/src/actions/accounts.ts:751-755`) — mobile intentionally mirrors. Mobile must NOT diverge unilaterally per the webapp-source-of-truth rule (would silently desync the two platforms' chart shapes).
- Fix has to land in webapp first, then mobile mirrors. Sketch: emit one synthetic EOD point per day equal to `running` value at the day-N → day-N+1 transition (i.e. SOD day N+1 = EOD day N), and `current_balance` for today. Test against an account with multi-tx days.

### Mobile SQLite — perf nits (P2)
- **Partial index for visible-tx filter** — surfaced by `mobile-sync-doctor` during Phase 4 Stage A review. The composite `idx_transactions_reconciled_visible(reconciled_into_transaction_id, transaction_date)` with `IS NULL` on the leading column causes a full index scan on dense histories. Fix in a future migration:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_transactions_not_reconciled
    ON transactions(account_id, transaction_date)
    WHERE reconciled_into_transaction_id IS NULL;
  ```
  Touches every visible-tx query (account detail, lists). Bundle with the next mobile schema migration; not a correctness bug.

### Phase 4 follow-ups (PR #252 shipped 2026-05-15)

PR #252 landed the three hero variants (flip / pulse / graph), `accounts-detail.ts` repo, and a QuickActionsBar **shell**. Remaining work:

- **QuickActionsBar dialogs — real ports.** `Pagar` / `Transferir` / `Ajustar` are currently `Alert.alert("Próximamente", …)` stubs in `mobile/components/accounts/QuickActionsBar.tsx`. Each needs to port the webapp dialog (`webapp/src/components/accounts/quick-payment-dialog.tsx`, `transfer-dialog.tsx`, `reconcile-balance-dialog.tsx`). Per dialog, this is: form UI + local SQLite mutation + sync engine push payload + `mobile-webapp-parity` + `mobile-sync-doctor` review. Treat each dialog as its own slice — bundling all three in one PR is multi-session work.
- **iOS sim verification of Phase 4** — never ran during the PR #252 session. Type-clean does NOT mean the flip animation, the "Más" Alert sheet, the safe-area inset, or the range-pills interaction work as expected. Open an account of each type (CREDIT_CARD, SAVINGS, CHECKING+debit, CASH, LOAN, INVESTMENT) and spot-check before piling more on top.
- **Empty-history fallback for `BalanceGraphHero`** — `accounts-detail.ts:48` returns a single point `[{today, currentBalance}]` when there are no txs; `GraphFace` then renders "Sin datos suficientes" because length < 2. Acceptable, but a brand-new account permanently shows that copy. Consider a separate `EmptyChartFace` with copy like "Aún sin movimientos" + an "Agregar primer movimiento" CTA.

### Triage candidates for next session — mobile parity continuation

Phase 3 (planificador 4-step + Deseos/Puedo-pagar parity) shipped via PRs #248 and #249. Phase 4 (heroes + QuickActionsBar shell) shipped via PR #252. Next slices:

**Primary (highest UX impact):**
1. **Phase 4 follow-up — QuickActionsBar real dialogs.** See "Phase 4 follow-ups" above.
2. **Phase 2 remainder — heavy widgets** — HealthZone, FlujoSection, ActividadHeatmap, DashboardAlerts, UpcomingPayments, BurnRate, RunwayMiniChart, MonthSelector, DashboardHero. Skia chart work on the dashboard. Spawn `mobile-perf-doctor`.
3. **Phase 5 — CRUD parity** — destinatarios, recurrentes, categorizar, categories, etiquetas, movimientos filters, transactions detail. Largest volume; biggest functional gap. Spawn `mobile-webapp-parity` + `mobile-sync-doctor`.

**Secondary (lower priority but contained):**
4. **Phase 3 follow-ups** — Reflections + Insights (needs `wishlist_reflections` SQLite sync), `debt_milestone` + `budget_surplus` nudges (server cross-refs), per-category `budgetRemaining` in mobile snapshot, scroll-to-verdict on puedo-pagar, single-tx batch persist + SQL aggregate snapshot perf wins.
5. **Phase 6 — Import wizard restoration** — Confirmar step, multi-statement table, password vault, email entry, screenshot mode. User runs imports monthly. Spawn `import-flow-doctor`.
6. **App Store submission** — `docs/app-store/LISTING_ES.md` demo-mode walkthrough → preview videos (user's lane) → `eas build` + `eas submit`.

**Lower priority (kept here for context):**
7. Phase 7 — Onboarding step alignment, magic-link auth, `nav_focus` SQLite column, settings sub-routes.
8. Phase 8 — Webapp `/suscripciones` port (closes RN orphan).
9. Phase 3 Préstamos design (different "Phase 3" — informal loans table; deferred from 2026-04 IA refactor).

---

## Mobile RN ↔ Webapp mobile-view parity audit (2026-05-16)

> Source: 6 parallel audit agents comparing webapp's mobile view (design source of truth) against the Expo RN app, page-by-page, component-by-component. Webapp mobile view is more polished; below is the work to bring RN to parity.
>
> Severity tags: **[P0]** missing feature / broken behavior · **[P1]** visible polish gap · **[P2]** minor cosmetic/copy · **[ORPHAN]** RN-only feature (decide: port to webapp or remove).
>
> **Re-sweep 2026-05-16:** 26 items resolved, 2 new gaps added since previous audit (2026-05-02). Resolved by PRs #246–#252.

### 1. Home / Dashboard / Accounts

#### `/dashboard` — `mobile/components/inicio/InicioRoot.tsx`
- [P0] Missing **HealthZone / HealthScore** section (`webapp/.../zones/health-zone.tsx`) — no health meters, score, runway equivalent.
- [P0] Missing **FlujoSection** — burn rate card, waterfall, cashflow charts (`flujo-section.tsx`, `flujo-waterfall.tsx`, `flujo-charts.tsx`).
- [P0] Missing **ActividadHeatmap** (calendar-style activity heatmap).
- [P0] **AccountsOverview** widget renders account cards but without sparklines — `AccountCard.tsx` shows balance only; port `getAccountsWithSparklineData` into `AccountsWidget`.
- [P0] Missing **DashboardAlerts** banner (`dashboard-alerts.tsx`) — attention widget in Herramientas is not equivalent.
- [P0] **PaymentReminders** partially done — `NextBillWidget` + `NextIncomeWidget` exist but lack the full `UpcomingPayments` card layout (reminder count, overdue badge, pay-now CTA).
- [P0] WIDGET_CATALOG partially implemented — `ritmo`, `attention`, `where_today`, `recent`, `puedo_comprarlo`, `next_bill`, `next_income`, `accounts` available; **DebtProgress, EmergencyFund, Deseos, SavingsRate, InterestPaid, BurnRate, RunwayMiniChart** are `available: false` stubs only (`mobile/lib/dashboard/widgets.ts`).
- [P0] Missing **MonthSelector / DashboardAccountPicker** — only `PulseRange` weekly/daily toggle; no month or account scope selector.
- [P0] Missing **InicioDiscoveryRail** (entry chips into Plan/Deseos/Decisión).
- [P1] Missing **DemoBanner / GuestBanner / DebtFreeBanner** conditional banners.
- [P1] Missing **dashboard customization persistence beyond widget list** — webapp persists `profiles.dashboard_config` via `getDashboardConfigWithPurpose` + `DashboardConfigProvider`; RN persists widget array via AsyncStorage only (not synced to Supabase — spawn `mobile-sync-doctor` if parity required).
- [P1] Missing **content-shaped skeletons** — RN has no per-widget skeleton.
- [P2] Header subtitle differs: RN shows date pill; webapp shows month + tagline.

#### `/accounts` (lista) — `mobile/app/(tabs)/accounts.tsx`
- [P0] Missing **AttentionCard** from `getAttentionSnapshot`.
- [P0] Missing **multi-currency footer** (secondary currency totals).
- [P0] Missing **liquidity vs debt grouping** ("Liquidez y ahorro" / "Deuda" sections).
- [P1] `AccountCard` has no sparkline / trend / brass accents — port `getAccountsWithSparklineData`.
- [P1] Empty state has "Nueva cuenta" CTA but is missing "Importar extracto" CTA.
- [P2] Dead/orphan file `mobile/app/accounts-list.tsx` — near-duplicate of `(tabs)/accounts.tsx`; remove or wire.

#### `/accounts/[id]` (detalle) — `mobile/app/account/[id].tsx`
- [P0] Missing **QuickPaymentDialog** (CC payments) — `QuickActionsBar` "Pagar" shows `Alert.alert` stub.
- [P0] Missing **TransferDialog** (between accounts) — `QuickActionsBar` "Transferir" shows `Alert.alert` stub.
- [P0] Missing **ReconcileBalanceDialog** (manual balance adjust) — `QuickActionsBar` "Ajustar" shows `Alert.alert` stub.
- [P0] Missing **StatementSnapshotsCard / StatementHistoryTimeline** (CC/loan/savings statement history with metrics + due dates).
- [P1] `RecentTransactions` shows category chip but missing destinatario field (only `merchant_name`); no brass tokens on row badges.
- [P1] Header is bespoke instead of `MobileHeader variant="sub"`.
- [P1] No skeleton; uses `ActivityIndicator`.
- [P2] Stat tiles use raw `bg-white` / `border-gray-100` instead of `PANEL_INSET_CLASS`.
- [P1] Delete confirm uses `Alert.alert` instead of styled AlertDialog.
- [P1] No FAB on `/accounts` list — inconsistent with other tabs.

### 2. Transactions / Capture

#### `/(tabs)/transactions` — `MovimientosRoot`
- [P0] `MovimientosUtilidades` filter pills incomplete — `accountId`, `direction`, `showExcluded` present; missing `tagId`, `dateFrom`, `dateTo`, `amountMin`, `amountMax`, `capture_method`.
- [P0] `MovimientosHerramientas` missing `pendingEmails` tile/prop (Bancolombia email-ingest approval flow).
- [P0] No "Compra consciente / ¿Debería comprar esto?" entry tile.
- [P1] `MovimientosTransactionRow` has inline `CategoryZonePicker` only — missing `DestinatarioZonePicker`, `TagZonePicker`, `LinkPickerSheet` chips; RN navigates to detail for those.
- [P1] No `Link2` (link-to-occurrence) or `Repeat` (recurring) badge on rows.
- [P1] No "Cargar más" / count indicator on infinite scroll.
- [P2] Verify `MovimientosLectura` parity (chart needs `transactions` + `debtAccountIds`).

#### `/transactions/[id]` (detail) — `mobile/app/transaction/[id].tsx`
- [P0] No **PromoteToRecurringButton** ("Hacer recurrente").
- [P0] No **LinkPickerSheet** ("Vincular a recurrente") — `getCandidateOccurrencesForTransaction` + `linkExistingTransactionToOccurrence` absent.
- [P0] No destinatario assign/change UI on detail.
- [P0] No tag add/picker — `editTagIds` stored but no `TagZonePicker` UI; only read-only display.
- [P0] No "linked recurring" surface when `isLinkedToOccurrence === true` (with unlink action).
- [P1] No installment surface (`installment_number` / `installment_count`) for CC cuotas.
- [P1] No `capture_method` tier badge (PDF_IMPORT / EMAIL_IMPORT / OCR / MANUAL_FORM / TEXT_QUICK_CAPTURE).
- [P1] RN status mapping (`CLEARED/PENDING/POSTED`) is placeholder — webapp has no such field; remove or align.
- [P2] Verify `is_excluded` 1/0 boolean round-trip via sync (`mobile-sync-doctor`).

#### `/transactions/new` — `mobile/app/transactions/new.tsx`
- [P0] File exists but is a stub ("Formulario en construcción") — full `MobileTransactionForm` (date, amount, account, category, destinatario, currency, notes, tags, "create destinatario" + "create recurring template" toggles) not implemented.
- [P0] No `?type=expense|income|transfer` preset routing.
- [P0] No transfer-between-accounts flow — `capture.tsx` transfer option shows `Alert.alert` stub.
- [P1] No installment fields on RN capture.

#### Capture flows
- [P0] RN `capture.tsx` calls local repo `createTransaction`, NOT the `createQuickCaptureTransaction` server action — verify same `parseQuickCaptureText` + `autoCategorize` + idempotency parity.
- [ORPHAN] `capture-screenshot`, `capture-voice`, `annotate-screenshot` — RN-only. Verify screenshot uses `OCR_BATCH` capture_method correctly. Voice already shares `parseQuickCaptureText`.
- [P1] No discoverability — list/detail tabs don't expose all 3 capture entry points.

### 3. Plan / Periodo / Presupuesto / Recurrentes / Pendientes

#### `/plan` — `PlanRoot`
- [P0] No tab nav (Resumen / Presupuesto / Periodo / Recurrentes / Deseos) — RN exposes only via `PlanToolsChips` separate stack routes.
- [P0] No `PlanMainAccountsSection` (current balance per main account, totalInBase, unconvertible warning) — `mobile/components/plan/PlanMainAccountsCard.tsx` does not exist.
- [P1] Plan-expandable-chips partially done — `PlanToolsChips` renders status chips and `PlanWeekTiles` shows income/payment week tiles, but no inline `plan-drill-cards` drill into pending vs paid.
- [P1] No `plan-distribution` / `plan-flow-chart` (planned-vs-confirmed cashflow).
- [P1] No deseos/wishlist link in plan surface.

#### `/periodo` — `mobile/app/periodo.tsx`
- [P0] No entry create/edit (`EntryFormDialog` for INCOME/EXPENSE) — RN periodo is read-only.
- [P0] No `AutoAssignButton` for unassigned expenses.
- [P0] No delete entry, no toggle income status (`onToggleStatus`, `handleDeleteEntry`).
- [P1] **Missing "Sincronizar recurrentes" button** — webapp gained `seedPeriodFromRecurring` trigger (cd5345c); RN `/periodo` has no equivalent sync action. *(New gap since 2026-05-02)*
- [P1] Status enum mismatch: RN `PLANNED/COMPLETED/SKIPPED` vs webapp lowercase `pending/paid/skipped` from occurrences. Confirm sync layer maps both.
- [P2] Header still uses bespoke `pt-14`/`ArrowLeft` instead of `MobileHeader variant="sub"`.

#### `/presupuesto` — `BudgetsRoot`
- [P0] No 50/30/20 allocation chip + `Plan5030_20Sheet` (essential vs wants %).
- [P0] No category grouping by pressure (over → near → safe) — RN renders flat list.
- [P0] No treemap visualization.
- [P1] No essential vs wants split breakdown.
- [P1] Verify `PressureChip` ("En control / Atención / Sobre límite") on RN BudgetsHero.
- [P1] No category drill-down on tap.

#### `/recurrentes` — `RecurrentesRoot`
- [P0] **No template editor.** No `recurring-form-dialog` equivalent. Users cannot create/edit recurring templates from app — only mark occurrences paid/skipped.
- [P0] No `mobile-recurrentes-templates-strip` (horizontal strip of all templates with edit affordance).
- [P0] No link-picker / merge-picker sheets — user can't manually link existing transaction to occurrence.
- [P0] No `recurring-impact-dialog` for amount/frequency mid-cycle changes.
- [P1] No `recurring-mini-calendar` or `recurring-payment-timeline`.
- [P1] No "Próximas" 30/60/90-day cashflow projection tile.
- [P2] `RecurringSummaryCard` shows 4 counters; webapp shows total expected + breakdown chips with status colors.

#### `/pendientes`
- [P0] Route exists (`mobile/app/pendientes.tsx`) as scaffold only — shows "Próximamente" placeholder; full pending-occurrences list (chronological, pay/skip actions) not implemented.

#### Cross-cutting (plan cluster)
- [P1] Status badge palette (`bg-z-alert/10`, `bg-z-income/10`) diverges from webapp pending/paid (`pendiente` brass, `pagado` sage).
- [P2] Tab order in `(tabs)/_layout.tsx` exposes `plan` + `deudas` as top-level tabs with `budgets` hidden; webapp consolidates Plan as single hub with internal tabs.

#### New RN files needed
- `mobile/components/recurrentes/RecurringFormSheet.tsx`
- `mobile/components/budgets/AllocationSheet.tsx`
- `mobile/components/plan/PlanMainAccountsCard.tsx`

### 4. Deudas / Deseos / Puedo-pagar

#### `/deudas`
- [P0] No "Pago extra" action (`ExtraPaymentTrigger` / sheet).
- [P0] No multi-currency rollup (`secondaryCurrencies`) on `DeudasHero`.
- [P0] No `ExchangeRateNudge` (USD/COP vs 30d avg).
- [P0] No month selector for past-month reads.
- [P1] No "closest debt-free" tile (`closestExitName` + months + progress per loan).
- [P1] `DeudasSalaryBar` uses prop-passed `monthlyIncome`; port `getCurrentSalaryBreakdown()` from `@zeta/shared` for parity.
- [P1] No "Simular pagos" chip-row pattern above salary bar.

#### `/deudas/planificador`
- [DONE — feat/mobile-planificador-4step] 4-step flow (Cash → Estrategia → Comparar → Detalle), multi-cashEntry input, custom strategy + cascade redirects, multi-scenario A/B/C, scenario persistence (getScenarios/saveScenario/deleteScenario via Supabase), empty state, income context. Uses shared `runScenario()`.
- [P1] **Compare/Detail timeline area chart deferred** — RN has no recharts; needs Skia line/area component. Mobile currently shows a comparison table + savings callouts only. Webapp `salary-timeline-chart.tsx` is the heaviest port and `compare-step.tsx` overlay is the chart users will most miss.
- [P1] **runScenario perf on multi-year debts** — `useMemo` recomputes all (≤3) scenarios synchronously on every dispatch. With a 90-month debt + 3 scenarios this can block the JS thread ~50–150ms on mid-tier Android. Defer via `useEffect`-driven state, or split into per-scenario memos so only the active scenario recomputes on `UPDATE_SCENARIO`.
- [P2] **CashStep form state lost on step switch** — `showForm` + `form` are local state; switching to step 2 and back resets the partial entry. Lift in-progress fields into the reducer or keep all step subtrees mounted with conditional visibility.
- [P2] **Tab labels** match webapp now ("1. Efectivo" etc).

#### Deseos (`/deseos` → `/plan?tab=deseos`)
- [DONE — feat/mobile-deseos-puedopagar-parity] Live re-score (`getWishlistItemsWithFreshScores`), verdict chip + score per row, urgency/desire chips, per-row CTAs (Reevaluar / Completar / Comprado / Eliminar), `DeseosEnrichDrawer`, bought-items section (incl. `reflected`), local `NudgeBanner` (score_transition + desire_maturity).
- [P0] **`DeseosReflectionCard`** — 14d/60d post-purchase reflection + worth_it + rating. Requires `wishlist_reflections` SQLite schema + push/pull + repository. Spawn `mobile-sync-doctor` when picked up.
- [P0] **`DeseosInsights`** — aggregated patterns. Depends on reflections sync above.
- [P1] Nudge variants `debt_milestone` + `budget_surplus` deferred — require server-side cross-table queries (budget spend + upcoming-payment heuristic); local nudge service skips them.
- [P2] Sort drift: RN orders by urgency-then-created; webapp orders by enriched-score-desc then unenriched. Decide canonical order.

#### `/puedo-pagar`
- [DONE — feat/mobile-deseos-puedopagar-parity] Name field, category picker (reuses `CategoryPickerSheet`), reset button, save-to-wishlist persists `last_verdict` / `last_score` / `category_id` / `funding_type` / `installments` / `account_id` + `enriched=true` (matches webapp `saveAffordToWishlist`). Uses `@zeta/shared` `analyzePurchaseDecision` (same engine as webapp).
- [P1] **Scroll-to-verdict** — `AppKeyboardAwareScrollView` doesn't forward refs; results appear inline at bottom without auto-scroll. Small wrapper edit needed.
- [P2] **Deseos perf — single-tx batch persist** in `getWishlistItemsWithFreshScores`. Each item's `persistWishlistScore` opens its own `withTransactionAsync` (SQLite serializes them). Collect score deltas synchronously, then a single transaction running all UPDATE + sync_queue inserts. Cuts wall-time roughly N× on mid-tier Android.
- [P2] **Deseos perf — SQL aggregate for snapshot** in `getFinancialSnapshot`. Currently materializes up to 1000 transaction rows through JS to compute `monthlyIncome`/`monthlyExpenses`. Replace with `SELECT direction, SUM(ABS(amount)) ... GROUP BY direction` (excluding debt-account inflows) — two scalars instead of 1k rows.

#### `/subscriptions`
- [ORPHAN] **RN-only screen.** Webapp has no `/suscripciones` UI; manages via `is_subscription` flag + `recurring_transaction_templates`. RN screen CRUDs templates filtered to `SUBSCRIPTIONS_CATEGORY_ID` with suggested-name chips. **Recommendation: port to webapp** as `/suscripciones` (single-category recurring view) — real user feature. Until then, ensure RN shares validators/side-effects with webapp recurring flows (parity gate).

#### Cross-cutting (decision tools)
- [P1] Confirm `useSafeAreaInsets` honored on all RN debt/deseos screens.
- [P2] RN Deseos summary uses `text-z-alert` for total; webapp uses neutral. Pick one tone token.

### 5. Import / Categorizar / Destinatarios / Categories / Etiquetas

#### `/import`
- [P0] Step count gap — webapp 6 steps, RN condenses to 4 (`pick` → `review` → `reconcile` → `result`); "Destinatarios sugeridos" assignment and final confirmation are implicit rather than dedicated wizard pages.
- [P0] `previewImportReconciliation` not used — RN builds ad-hoc reconciliation preview inline (`import.tsx:609–720`) instead of the canonical `ReconciliationPreviewResult`; cross-source AUTO_MERGE scoring fixes from #250 (1/1-cuota, terse descriptions) not applied. *(Scoring drift widened since 2026-05-02 — see new gap below)*
- [P0] No pending-email-statement entry (`pending-email-statements.tsx`) — can't pick up `EMAIL_PDF_IMPORT` queued by email ingest.
- [P0] No screenshot/OCR entry (`?mode=screenshot` + `getPendingScreenshotFile()`) in import wizard — screenshot capture is a separate standalone route, not integrated into the import flow.

#### `/categorizar`
- [P0] No "Auto-review" tab + `bulkConfirmAutoCategory`.
- [P0] No bulk-select / bulk-categorize (`BulkActionBar` + `bulkCategorize`).
- [P0] No category suggestion chips inline on rows.
- [P1] No undo / toast confirmation after assigning.

#### `/destinatarios`
- [P0] No create destinatario flow (`create-destinatario-dialog.tsx`).
- [P0] No edit (rename, change category, toggle active, edit notes) — detail read-only.
- [P0] Rule display exists on detail but no add/edit/delete controls (`addDestinatarioRule` / `removeDestinatarioRule` absent).
- [P0] No merge destinatarios (`merge-dialog.tsx`).
- [P0] No "Suggestions" tab (`destinatario-suggestions-tab.tsx`) — clusters of unassigned merchants.
- [P0] No `bulkLinkToDestinatario` retroactive matcher.
- [P0] No delete destinatario.
- [P0] No zone picker (`destinatario-zone-picker.tsx`).
- [P1] No spend stats / monthly chart / direction split / cashflow / top categories on detail (webapp 838 LOC).

#### `/categories`
- [P0] `CategoryFormSheet` has color presets but no icon picker — webapp has `IconPicker` with Lucide icons + emoji.
- [P0] No zone assignment (essentials/wants/savings).
- [P0] No category kit selection / onboarding kit picker.
- [P1] No `displayOrder` reordering (drag).

#### `/etiquetas` (tags)
- [P0] Route exists (`mobile/app/etiquetas.tsx`) as scaffold only — shows "Próximamente"; full CRUD to view/create/edit/delete/assign tags not implemented.

#### `/gestionar` (Más hub)
- [P1] `menu.tsx` does not surface `AttentionHub` (signals + action/suggestion counts) — static link grid only.

#### Cross-cutting (data hygiene)
- [P1] Empty states minimal vs richer webapp empty states with primary CTAs.
- [P2] Unaccented strings: `categorizar.tsx` ("categoria", "transaccion") and `CategoriesRoot.tsx` ("Categorias", "personalizadas", "sincronizaran").

### 6. Settings / Auth / Nav shell

#### Tab bar — `MobileTabBar.tsx`
- [P1] FAB context-actions hardcoded in `handleFabAction()` switch — webapp `FabMenu` accepts per-route `contextActions` (`new-recurring`, `new-account`); RN serves the same fixed menu regardless of active tab.
- [P1] Quick-capture shows "Próximamente" `Alert.alert` — webapp ships it; wire to `capture.tsx` (`parseQuickCaptureText`).
- [P2] Active label `text-muted-fg-70` non-default token — verify NativeWind resolution.

#### Header — `MobileHeader.tsx`
- [P1] No `backStyle="exit"` (X icon, "Salir") for committed wizards.
- [P1] No attention badge + avatar menu via `MobileShellProvider`.
- [P2] Solid `bg-background-92` instead of `expo-blur` — confirm sticky+blur parity.

#### `/settings`
- [P0] Flat single screen vs sectioned `SettingsNavigationList`. Missing sub-routes: `/settings/perfil`, `/integraciones`, `/email`, `/pdf-passwords`, `/etiquetas`, `/analytics`, `/bug`.
- [P0] Missing surfaces: Integraciones (Telegram/MCP/IA tokens), Email ingest, PDF passwords manager, Tags editor, Analytics activity, Bug report form, Demo-mode card UX, Review-mode toggle (dev), Build info.
- [P1] RN-only biometrics + sync controls — keep but reorganize under sectioned list for layout parity.
- [P1] Missing disclaimer copy ("Zeta no es un asesor financiero…").
- [P2] `menu.tsx` duplicates settings entry-points instead of pointing to `/gestionar` parity.

#### `/onboarding`
- [P1] Step counts differ: webapp 4 (`FUNCTIONAL_STEPS=3` + celebration) vs RN 5 (welcome/profile/pulse/account/complete) — eyebrows say "Paso 1 de 3" vs "Paso 1 de 5".
- [P0] RN persists via `bootstrapOnboardingLocally` (SQLite) but does NOT call `finishOnboarding` server action — verify `app_purpose`, `estimated_monthly_income/expenses`, `preferred_currency`, `timezone`, `locale`, default account, `dashboard_config`, `mobile_layout` sync to Supabase on complete. Parity gate.
- [P1] No `skipOnboardingWithDefaults` path on RN.
- [P1] No `trackClientEvent` analytics (`onboarding_started/step_completed/skipped/completed`).
- [P2] Step copy diverges ("Sobre ti" vs "Tu perfil").

#### `/auth`
- [P0] No magic-link / passwordless path (webapp `AuthSessionShortcuts`).
- [P1] Auth callback error states partially wired (`reset-password` has basic handling) — `auth_callback_failed` and `auth_callback_missing_params` states missing.
- [P1] RN-only biometrics — keep, but ensure no duplication.
- [P2] Webapp wraps login in `PANEL_SURFACE_CLASS` card with hero copy; RN renders form on background. Align hero copy.

#### Modals / sheets / safe area
- [P1] Verify `MobileSheet` + `FabMenuSheet` overlay above tab bar (z-order discipline).
- [P1] Confirm every focus-mode screen honors `useSafeAreaInsets()` — `menu.tsx` to verify.

#### Visual polish (shell)
- [P1] Port `mobile-settings.tsx` sectioned card pattern (`rounded-xl border divide-y` + `ChevronRight`) — settings is currently flat monolithic screen.
- [P2] Lucide icon mismatch: `menu.tsx` uses `Wallet/Upload/Settings/PiggyBank/Repeat`; webapp `mobile-nav.ts` uses `LayoutDashboard/ArrowLeftRight/PiggyBank/Landmark/LayoutGrid`. Align `Más` hub icon with `LayoutGrid`.

### Triage (parity)

**P0 count reduced from ~80 → ~62 items.** Suggested attack order:
1. **Fill missing route implementations** — `/transactions/new` full form, `/pendientes` list, `/etiquetas` CRUD, `/settings/*` sub-routes.
2. **Dashboard widget catalog** — import 7 missing widgets (HealthZone, Flujo, Heatmap, DashboardAlerts, BurnRate, RunwayMiniChart, MonthSelector scope).
3. **Account detail dialogs** — QuickPaymentDialog / TransferDialog / ReconcileBalanceDialog (bar shell done, dialogs stubbed).
4. **CRUD gaps** — destinatarios edit/create/merge, recurring template editor, deseos reflection + insights.
5. **Import wizard** — previewImportReconciliation parity (apply #250 scoring), email-statement entry, screenshot/OCR integration.
6. **Budgets** — 50/30/20 allocation chip, pressure grouping, treemap.
7. **Polish sweep** — `MobileHeader variant="sub"` on `/periodo`, FAB context-actions per-route, "Sincronizar recurrentes" in `/periodo`, accented copy strings.

**New gaps since 2026-05-02:**
- **[P1] `/periodo` missing "Sincronizar recurrentes"** — webapp cd5345c added `seedPeriodFromRecurring` call; RN not updated.
- **[P2] Import AUTO_MERGE scoring drift** — webapp #250 fixed 1/1-cuota detection and cross-source AUTO_MERGE scoring; RN ad-hoc reconciliation builder (`import.tsx:609–720`) pre-dates these fixes.

**ORPHANS to decide:** `/subscriptions` (port to webapp recommended), `capture-screenshot` + `capture-voice` + `annotate-screenshot` (RN-only by design — verify they share shared utils).

## Subscriptions feature (2026-05-27, branch feat/subscriptions)
- **[P2] `ensureCurrentOccurrences()` on render** — `/suscripciones` (and `/plan`) call it every load to idempotently generate occurrences. Acceptable now (idempotent, fast after first daily run). When recurring usage grows, move occurrence generation to a cron/scheduled function and drop the ensure from all render paths. (perf-auditor, 2026-05-27)

### Subscriptions follow-ups (deferred from feat/subscriptions, 2026-05-27)
- **[P2] Task 10 — no-destinatario detection fallback** — surface `getDestinatarioSuggestions()` repeating-charge candidates on `/suscripciones` as a "crea un destinatario para rastrear esto" nudge (links to existing destinatario-create flow; no new mutation). Catches subscriptions for merchants with no destinatario yet. NOT built — core feature ships without it.
- **[P3] Mobile subscriptions write-path prep** (when mobile gains subscription UI): (a) recreate SQLite `subscriptions` with `currency_code TEXT NOT NULL DEFAULT 'COP'`; (b) add `"subscriptions"` to `SyncTableName` union in `mobile/lib/sync/push.ts`; (c) mirror the live-uniqueness guards locally — `subscriptions_one_live_per_template` (one live row per `recurring_template_id`) + `subscriptions_one_suggestion_per_destinatario` (one `'suggested'` row per merchant) — to prevent duplicate live rows before a sync cycle. (Updated 2026-05-27 — the old single `subscriptions_one_live_per_destinatario` guard was replaced; see DONE note below.)

### Subscriptions — multiple per destinatario (DONE — PR #278, 2026-05-27)
- **Shipped:** A merchant can now have several live subscriptions, each anchored to its own recurring template. Solves the Google Play case (`GOOGLE *PLAY YOUTUBE` bills YouTube Premium, Google One, etc. under one identical descriptor → one "Google Play" destinatario, N templates). Migration `20260527180000_allow_multiple_subscriptions_per_destinatario.sql` (applied to remote): replaced `subscriptions_one_live_per_destinatario` with `subscriptions_one_live_per_template` + `subscriptions_one_suggestion_per_destinatario`; re-scoped the cancel-drift reactivation trigger from destinatario to template. `upsertSubscriptionFromTemplate` keys on `recurring_template_id` (adopts an unlinked detection suggestion before inserting); `formalizeSubscription` skips templates already backing a live sub.
- **[P3] UI label for same-merchant subs** — when a destinatario has multiple subscriptions, rows show the destinatario name repeated (distinguished only by amount). Surface the recurring template's `merchant_name` instead. Touches: cached query in `getSubscriptionsCached` (add `template.merchant_name`), `SubscriptionWithDetails` domain type, `subscription-row.tsx`, and the mobile read query (`mobile/lib/repositories/subscriptions.ts`) for parity. (NOT built — amount currently disambiguates.)
- **[P3] Same-merchant amount-collision risk** — `findMatchingOccurrence()` disambiguates same-destinatario occurrences by amount with a ±50% tolerance (`occurrences.ts`). Two subscriptions for the same merchant priced within ~2× of each other can mis-link a transaction to the wrong occurrence. Acceptable for typical Google Play spread (YouTube Premium vs Google One differ >2×); revisit if users report mis-links. (NOT built.)

## 2026-05-30 session — deferred (audit + activation work; see `docs/audit-2026-05-30-ship-and-activation.md`)

### Stale shared tests (user asked to fix/remove/defer → deferred for a focused session)
- **[P2] `auto-categorize.test.ts` — 39/45 fail, stale from the category-kits taxonomy refactor.** The engine (`packages/shared/src/utils/auto-categorize.ts`) returns the CURRENT taxonomy (`CATEGORY_HOGAR`/`ESTILO_DE_VIDA`/`OBLIGACIONES`/`INGRESOS` parents); the test still asserts the OLD keys (`SERVICIOS`/`SUSCRIPCIONES`/`ENTRETENIMIENTO`/`MASCOTAS`/`SALARIO`/`PAGOS_DEUDA`/`INVERSIONES`). Return shape (`category_id`) is fine. Fix = rewrite each expectation to the current taxonomy, verifying each merchant→category mapping is *semantically* correct (don't just rubber-stamp `autoCategorize` output — that defeats the test). The normalization/word-boundary cases (CAT-01/02) are largely taxonomy-independent and may already be salvageable.
- **[P3] `debt-stats.test.ts` — 1 fail ("returns null for loan remaining months when monthlyPayment is null").** `computeDebtStats` returns `{months:0}` via the `?? 0` fallback at `debt-stats.ts:195` (headline coupled to top-progress account) instead of `null` when that loan has no monthly payment. Decide intended behavior — `null` ("unknown payoff") is arguably more correct than `{months:0}` ("paid off") — then fix impl OR test. Verify the debt-page headline consumer before changing the impl.

### Mobile perf nice-to-haves (mobile-perf-doctor on the 2026-05-30 push/tracking work; HIGH items already fixed)
- **[P2] `reschedulePaymentReminders` SQL bound** — `getPendingOccurrences()` loads ALL pending rows then filters by horizon in JS. Add an optional `beforeDate` param + `LIMIT 30` pushed to SQL (`mobile/lib/repositories/recurring.ts`). Also parallelize the `scheduleNotificationAsync` loop with `Promise.all` (currently sequential, up to 30 bridge round-trips). (Concurrency in-flight guard already shipped.)
- **[P3] `_layout.tsx` AppState listener** re-registers on every auth state change (`[session, demoMode]` deps) — stabilize via `sessionRef`/`demoModeRef` so it registers once. (Notification-listener churn already fixed via `routerRef` + empty deps.)
- **[P3] `accounts-list.tsx`** — extract a stable `renderAccountCard` `useCallback` + `React.memo(AccountCard)` (pre-existing inline closures); change `listHeader` `useMemo` dep `accounts.length` → boolean `hasAccounts`.
- **[P3] `product-events.ts`** — `trackProductEvent` calls `supabase.auth.getSession()` per event; pass `userId` from the caller's known context where available (capture/categorize) to drop a round-trip. Fire-and-forget, non-blocking — low priority.

### Pre-existing UI debt (zetas-front-guy flagged while reviewing 2026-05-30 changes; NOT introduced this session)
- **[P3] `settings.tsx` ThemeSelector swatch hex literals** `#1E221E` (= `z-surface-2`) + `#18181b` are inlined (`style={{ backgroundColor }}`) at ~lines 186-187 — move to `COLORS`/a `THEME_SWATCHES` map sourced from tokens.
- **[P3] `settings.tsx` ScrollView clearance** uses raw `insets.bottom + 24` (~lines 799) instead of `MOBILE_TAB_BAR_CLEARANCE` — verify it clears the floating FAB on this surface.

### Weekly digest — remaining slices (engine + data-action SHIPPED + verified; see audit §8)
- ✅ **DONE — `getWeeklyDigest()` data action** (`webapp/src/actions/weekly-digest.ts`, tsc clean): week-windowed spend (this/last 7 days merged across month boundaries, TZ-stable UTC date math), top category (month-scoped proxy — noted), budget pace via `getDailyBudgetPace`, OUTFLOW upcoming via `getUpcomingRecurrences(7)` → `buildWeeklyDigest`. Composes existing cached actions (no `"use cache"` wrapper, like `getRitmo`).
- **[P2] In-app digest surface** — a "Resumen semanal" card (mobile-webapp + native) consuming `getWeeklyDigest()` / the shared engine. Standalone value before delivery lands.
- **[P2] Delivery** — recommended **email via Resend** (already wired, no token infra, reaches web+mobile) over Expo push (needs `push_tokens` table + mobile registration + Expo Push send). Cron via Supabase **pg_cron + pg_net** hitting a secret-guarded route. Cross-user computation needs `zeta_decrypt_as` RPCs (admin client can't decrypt `_enc` tables) — **spawn `supabase-migrator`** for the RPC + pg_cron migration. This is the genuinely hard, encryption-sensitive slice.

### Pre-existing (observed 2026-05-30)
- **[P2] `@zeta/shared` test suite is red on the current tree** (40 failures = the two stale files above). CI may be failing — triage with the two test items above.

### PDF parser service — unrecognized-files storage broken in prod (found 2026-06-10)
- **[P1] Parser container can't reach Supabase Storage** — the `unrecognized-statements` bucket is empty even though "enviar para soporte" was used from prod. `save_unrecognized()` (services/pdf_parser/storage.py) falls back to the container's local disk, which is ephemeral — submitted samples are lost on redeploy. Fix: pass the Supabase URL + service key env vars to the parser service in `docker-compose.prod.yml` (check `_get_client()` for the exact var names) and verify an upload lands in the bucket.
- **[P3] `save_unrecognized()` hardcodes `.pdf` extension** — screenshots get saved as `*.pdf`-named PNGs. Preserve the original extension.

### Import multi-screenshot — deferred polish (2026-06-10, from import-flow-doctor review)
- **[P3] Results-step hint for OCR_BATCH skips** — when an OCR_BATCH import reports `skipped > 0`, add a soft note: "Si faltó alguna transacción, puede deberse a capturas superpuestas". Dedup key already includes authorization_number; this covers the residual identical-rows edge.

### Deudas/recurring — /simplify follow-ups (2026-06-10, deferred by design)
- **[P2] Unified `registerDebtPaymentLeg` service** — three paths insert a debt-payment INFLOW independently (checklist leg B in recurring-templates.ts, extra-payment.ts inflow, ensureDebtCompanionLeg in occurrences.ts), each with its own idempotency-provider string and copy. Extract to `lib/debt/` so strings/category fallback can't drift; consider a dedicated SYSTEM-tier capture_method (DB enum migration) instead of MANUAL_FORM for system-generated legs. Unifying idempotency keys naively would change dedup for existing rows — needs care.
- **[P2] Month-level occurrence uniqueness as DB constraint** — the guard in ensureOccurrencesForRange is app-level only (TOCTOU under concurrent ensureCurrentOccurrences). Real fix: `period_key` column ('YYYY-MM' for MONTHLY) + UNIQUE(template_id, period_key), backfill migration, all insert paths (webapp + mobile sync) updated together.
- **[P2] BankBadge → existing bank identity system** — bank-badge.tsx regex-matches names + hardcodes brand hexes, duplicating `accounts.bank_key` + `BANK_LOGOS` (lib/icons/bank-logos) + `LetterMark`/`AccountIcon`. Thread bank_key through extractDebtAccounts (shared type change) and render the real SVG marks.
- **[P3] Batch screenshot OCR concurrency** — step-upload posts images sequentially (10 × ~2-5s). Bounded concurrency (3) needs a parser-side check first (single uvicorn worker; tesseract CPU-bound).
- **[P3] Image detection double-OCR** — detect_and_parse_image runs ocr_image() for detection, then bancolombia_web runs image_to_data again. Use image_to_data once: join words for detection text, reuse boxes for parsing.
- **[P3] Shared `useLoadMore` hook** — movimientos-root + recent-transactions each hand-roll the load-more state machine.
- **[P3] Shared `ExpandableCard` shell** — six new deudas components repeat PANEL_INSET + aria-expanded button + Expand + brass border scaffolding.

### Final-review findings deferred (2026-06-10, /code-review on PR #288)
- **[P1] Companion-leg cleanup on revert/delete** — revertOccurrence's `linked_manually=true` branch only nulls the recurrence group; deleteTransaction reverses only its own delta. Reverting/deleting the source OUTFLOW orphans the synthetic debt INFLOW + its balance delta; re-paying mints a second companion (new source tx id ⇒ new idempotency key). Fix: both paths must locate the companion (same recurrence_group, debt-account INFLOW) and delete + reverse via the payoff helpers.
- **[P2] Personal-debts totals mix currencies** — getPersonalDebtsOverview sums outstanding_amount across currency_code; PersonasCard formats with page currency. Needs per-currency totals or FX normalization (CreatePersonalDebtSheet already creates USD debts from USD transactions).
- **[P2] /deudas dual server sections** — mobile (lg:hidden) and desktop (hidden lg:block) both render every request: ~7 device-specific queries wasted per request + doubled HTML. Extract one shared loader; stream lens-specific data (countdown/personas) like archivedObligations.
- **[P2] Demo mode never filtered on debt page** — pre-existing page-wide gap (no getIsDemoFilter anywhere in actions/debt.ts) now extended to trend + archived history. Fix at the account-fetch boundary for the whole file.
- **[P3] Deudas lens unaddressable** — localStorage-only persistence ('zeta:deudas-lens'): no deep links, hydration flash to Carga. Hybrid ?lens= param (fallback localStorage) + history.replaceState.
- **[P3] Month-window math** — hand-rolled `${getFullYear()}-${padStart}` strings in debt.ts/occurrences.ts; lib/utils/date.ts already exports monthsBeforeStart/monthStartStr/formatMonthParam. Also MONTHS_ES in debt-trend-card vs formatMonthLabelShort; initialsOf 3rd copy; GroupDivider 3rd divider.
- **[P3] Dead code from the lens rewrite** — DebtAccountRow (0 consumers, stale 'canonical' docstring) + CHIP_NEUTRAL_CLASS (0 consumers): delete or re-adopt.
- **[P3] runSubscriptionDetection blocks importTransactions tail** — 12-month scan + subscriptions fetch run serially at the end of every import; parallelize or fire-and-forget. Also upsertSubscriptionFromTemplate runs (and busts the subscriptions cache) on every non-subscription template edit.
- **Note:** migration 20260610140559's updated_at tie-break already ran in prod with user-confirmed survivors; residual risk limited to other environments restored from pre-migration dumps.

## 2026-06-11 session — webapp polish sweep (two audit passes, 16 surfaces)

**Plan:** `docs/polish-plan-2026-06-11.md` — canonical continuation plan (Wave 2/3, chrome API gaps, systemic sweeps).

- **Done this session:** budget editing restored (mobile sheet editor + Ajustes mode/income + desktop tap-to-edit + delete; dead code removed); presupuesto chrome dedup (double px-4/clearance, bg-[#111] → tokens); wave-1 polish agents (accounts + categorizar restructure, PageHeaderRow desktop-only central fix, suscripciones wiring + deseos sweep).
- **Top of Wave 2 (correctness, minutes):** UTC "today" default bug in voice-capture-sheet + mobile-transaction-form (after ~7pm saves tomorrow) → shared `todayLocalISO()`; landing legal links `href="#"`; debt-direction trend chip shows green on growing debt (graph-face.tsx).
- **Known feature-scope deferrals:** Transferencia tab saves plain OUTFLOW (no transfer semantics); onboarding import-first rebuild (Flow 01); Exportar datos.

## 2026-06-11 — budget builder review findings (pre-existing, deferred)

- **`is_demo` latent bug family in budget mutations:** `upsertBudget`, `bulkUpsertBudgets`, `deleteBudget`, `deleteBudgetForCategory` neither set `is_demo` on write nor filter it on delete. For demo-mode users, writes land `is_demo=false` → invisible to the demo-filtered `getBudgetSummaryCached`. `applyBudgetScenario` + `applyBudgetComposition` do it correctly — mirror that pattern across the four siblings. (server-action-reviewer, budget builder gate)
- **`getBudgetSummaryCached` uses `createAdminClient()` inside `"use cache"`:** works (no encrypted columns) but diverges from the `createCachedClient(accessToken)` convention. Migrate on next cache-doctor pass. (perf-auditor)

## 2026-06-22 — mobile email import queue (parity gate findings)

- **[P2] Mobile email-approve (and PDF import) skip `linkTransactionToOccurrence`** — `mobile/lib/repositories/pending-email.ts` `approveEmailTransaction` mirrors the webapp but intentionally omits occurrence-linking to match mobile's existing `createTransaction`/PDF-import convention. User-visible gap: a recurring payment captured by email (or PDF) won't auto-clear its occurrence on the Plan screen until the webapp syncs and runs its own path. Consistent across mobile paths, not a new regression. Fix options: port the occurrence-link logic into mobile's tx-insert paths, or move it to a server-side trigger so both platforms get it for free.
- **[P3] `(supabase as any)` casts in `pending-email.ts`** — the mobile Supabase client type doesn't enumerate `pending_email_transactions` / `email_ingest_addresses` (webapp-managed, not synced to SQLite). Cosmetic; regenerate mobile Supabase types on the next refresh to drop the casts.

## 2026-06-22 — mobile inline destinatario create (follow-up)

- **[P2] Mobile destinatario inline-create is name-only — webapp has a full wizard.** `mobile/components/transactions/DestinatarioPicker.tsx` now shows "Crear «query»" when the search has no match and calls `createDestinatarioWithPattern({ user_id, name })` (name only, no pattern/kind/category). The webapp's create is a richer wizard (`create-destinatario-dialog.tsx` / `destinatario-create-form.tsx`): kind (merchant vs person), default category, and a matching rule/pattern. Bring the mobile inline-create up to wizard parity next session — likely a small create sheet launched from the picker (prefilled name), seeding a pattern from the transaction's merchant so future tx auto-match. Apply the same inline-create affordance to the Categoría and Etiquetas pickers.

## 2026-06-24 — destinatario detail/edit page redesign (deferred, before/after Phase 4)

- **[P2] Replace the native `Select` "Categoría por defecto" with `CategoryZonePicker`.** `webapp/src/components/destinatarios/destinatario-detail.tsx:239-261` uses a shadcn `Select` (flat category list, parents disabled, children indented with `&nbsp;`) — not the zoned/colored/searchable `CategoryZonePicker` used everywhere else. Swap it (it supports `name="default_category_id"` + controlled value, so it's close to drop-in). Consistency + the disabled-parents UX is confusing.
- **[P2] Redesign the "Datos del destinatario" form layout.** The edit card is cramped and hard to read (see Image #20): tight spacing, the category dropdown overlays other fields, the is_active toggle row + helper text are awkward. Apply the same card/label/spacing tokens and the centered/grouped patterns from the standardization pass. Consider aligning with the Idea-2 detail aesthetic once Phase 4 lands so destinatario + transaction detail feel consistent.
- Surfaces: `/destinatarios/[id]` → `destinatario-detail.tsx`.

## 2026-07-01 — Modos (feature shipped on feat/modos): opportunistic hardening

- **[P2] Cap candidate-ID fan-out for tag filters.** `getModoTransactionIds` (`webapp/src/actions/modos.ts`) and the multi-tag prefetch in `getTransactionsCached` (`webapp/src/actions/transactions.ts`) use the "fetch transaction_tags → build IN-list → refilter transactions" pattern with no `.limit()` and no cap on tag count. A popular tag (or OR of several high-volume tags) can produce a multi-thousand-element `.in("id", [...])`. Options: add `.limit(5000)` circuit breaker, add `.max(20)` to `tag_ids` in `modoSchema` + the `tags` CSV filter, or collapse into a single PostgREST embedded join (`transactions.select("id, transaction_tags!inner(tag_id)").in("transaction_tags.tag_id", tagIds)`). Mitigated today by `"use cache"` on both call sites; not on the default `/transactions` load. (perf-auditor 2026-07-01)
- **[P3] `DatePicker` should accept/forward an `id`.** `@/components/ui/date-picker.tsx` doesn't expose `id`, so `<Label>` can't pair `htmlFor` to the trigger (modo-form-dialog, transaction-form, transfer-dialog all have this gap). Fix at the component level, not per call-site. (zetas-front-guy 2026-07-01)

## 2026-07-03 — rediseño fila de movimientos (feat/movimientos-row-redesign): hallazgos diferidos

- **[P2] Nombre de la recurrente vinculada en el tile del sheet nativo.** El sheet "Más" del app nativo muestra "Vinculada a recurrente" genérico; el webapp muestra el `templateMerchant`. Requiere query local a `recurring_occurrences`/templates por `transaction_id` (espejo de `getLinkedRecurringForTransaction`). También falta el mini-sheet de acciones (ver recurrente / desvincular) que el webapp ya tiene.
- **[P3] Índice cubriente para `getBalanceHistory`.** El nuevo ORDER BY (`transaction_date, transaction_time, created_at`) no está cubierto por índices; solo importa en `accounts-detail.ts:31-45` (LIMIT 5000, sin cota mensual). Si el chart de detalle de cuenta se siente lento: `CREATE INDEX idx_transactions_account_date_time ON transactions(account_id, transaction_date DESC, transaction_time DESC, created_at DESC)`. (mobile-perf-doctor 2026-07-03)
- **[P3] Reuso de referencias de fila en resets del feed móvil.** `loadData({reset:true})` reemplaza el array completo con objetos SQL nuevos → memo de las filas se anula en cada focus. Mitigación: diff-and-reuse (comparar id+updated_at y conservar la referencia previa). (mobile-perf-doctor 2026-07-03)
- **[P3] Estrategia única de montaje para MobileSheet condicional.** Patrón correcto = montar al abrir + desmontar retrasado tras la animación (implementado en MovimientosTransactionRow). `app/transaction/[id].tsx` tiene el anti-patrón (`{show && <... visible={show}>}` — el slide de cierre nunca corre). Unificar y documentar. (mobile-perf-doctor 2026-07-03)
