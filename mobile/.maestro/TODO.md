# TODO: Implementación Maestro E2E — Zeta Finance

## Fase 1: Setup local (Prioridad Alta)
- [ ] Instalar Maestro CLI en máquina local
- [ ] Instalar IDB companion (para iOS simulator)
- [ ] Crear archivo `.maestro/.env` con credenciales de test
- [ ] Verificar que Maestro detecta el emulador/simulador: `maestro hierarchy`

## Fase 2: Agregar testID a componentes (Prioridad Alta)
- [ ] **Auth screens**
  - [ ] `login.tsx`: `login-screen`, `login-email-input`, `login-password-input`, `login-submit-button`, `login-error-message`, `login-signup-link`, `login-biometric-button`
  - [ ] `signup.tsx`: `signup-screen`, `signup-name-input`, `signup-email-input`, `signup-password-input`, `signup-submit-button`, `signup-success-message`
  - [ ] `forgot-password.tsx`: `forgot-password-screen`, `forgot-password-email-input`, `forgot-password-submit-button`
- [ ] **Tab navigation**
  - [ ] `_layout.tsx`: `tab-dashboard`, `tab-accounts`, `tab-transactions`, `tab-budgets`, `tab-import`, `tab-settings`
- [ ] **Dashboard**
  - [ ] `(tabs)/index.tsx`: `dashboard-screen`
  - [ ] `BalanceCard.tsx`: `balance-card`
  - [ ] `MonthSummary.tsx`: `month-summary-card`
  - [ ] `CategoryBreakdown.tsx`: `category-breakdown`
- [ ] **Accounts**
  - [ ] `(tabs)/accounts.tsx`: `accounts-screen`
  - [ ] `AccountCard.tsx`: `account-card`
  - [ ] `account/[id].tsx`: `account-detail-screen`, `account-balance`
  - [ ] `account/create.tsx`: `account-create-screen`, `account-create-submit`
- [ ] **Transactions**
  - [ ] `(tabs)/transactions.tsx`: `transactions-screen`, `transaction-list`
  - [ ] `TransactionRow.tsx`: `transaction-row`
  - [ ] `SearchBar.tsx`: `transactions-search-input`
  - [ ] `transaction/[id].tsx`: `transaction-detail-screen`
- [ ] **Import**
  - [ ] `(tabs)/import.tsx`: `import-screen`, `import-upload-button`
- [ ] **Settings**
  - [ ] `(tabs)/settings.tsx`: `settings-screen`, `settings-logout-button`

## Fase 3: Validar flows existentes (Prioridad Alta)
- [ ] Ejecutar `login-success.yaml` — verificar que pasa
- [ ] Ejecutar `login-invalid-credentials.yaml` — verificar que pasa
- [ ] Ejecutar `signup.yaml` — ajustar según UI real
- [ ] Ejecutar `view-accounts.yaml` — verificar navegación
- [ ] Ejecutar `account-detail.yaml` — verificar modal/sheet
- [ ] Ejecutar `view-transactions.yaml` — verificar lista
- [ ] Ejecutar `search-transactions.yaml` — verificar filtrado
- [ ] Ejecutar `import-pdf-wizard.yaml` — verificar wizard
- [ ] Ajustar selectores y timeouts según comportamiento real

## Fase 4: Expandir cobertura (Prioridad Media)
- [ ] Flow: Crear cuenta nueva (formulario completo)
- [ ] Flow: Editar cuenta existente
- [ ] Flow: Ver detalle de transacción
- [ ] Flow: Captura rápida de gasto (FloatingCaptureButton → modal)
- [ ] Flow: Cambiar mes en dashboard (MonthSelector)
- [ ] Flow: Onboarding de usuario nuevo
- [ ] Flow: Desbloqueo biométrico (BiometricLockScreen)
- [ ] Flow: Modo demo (login sin credenciales)
- [ ] Flow: Navegación completa entre todos los tabs

## Fase 5: CI/CD (Prioridad Media)
- [ ] Agregar script `test:e2e` en `mobile/package.json`
- [ ] Crear GitHub Action workflow para Maestro tests
- [ ] Configurar EAS Workflows para E2E en builds
- [ ] Generar reportes JUnit: `maestro test --format junit --output results.xml`
- [ ] Evaluar Maestro Cloud vs self-hosted para CI

## Fase 6: Mejoras (Prioridad Baja)
- [ ] Agregar screenshots automáticos en puntos clave
- [ ] Crear flow de regresión visual (snapshot comparisons)
- [ ] Documentar proceso de escritura de nuevos tests
- [ ] Agregar `testID` a componentes de `@zeta/shared` si aplica
- [ ] Explorar Maestro para testing de deep links (`zeta://`)
- [ ] Evaluar testing de notificaciones push
