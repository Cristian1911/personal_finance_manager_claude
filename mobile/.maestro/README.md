# Maestro E2E Tests — Zeta Finance

Tests E2E para la app móvil usando [Maestro](https://maestro.dev/).

## Estructura

```
.maestro/
├── config.yaml              # Configuración global
├── .env.example             # Variables de entorno (template)
├── helpers/                 # Flows reutilizables
│   ├── login.yaml
│   └── logout.yaml
└── flows/                   # Tests organizados por feature
    ├── auth/
    │   ├── login-success.yaml
    │   ├── login-invalid-credentials.yaml
    │   └── signup.yaml
    ├── accounts/
    │   ├── view-accounts.yaml
    │   └── account-detail.yaml
    ├── transactions/
    │   ├── view-transactions.yaml
    │   └── search-transactions.yaml
    └── import/
        └── import-pdf-wizard.yaml
```

## Setup local

```bash
# 1. Instalar Maestro CLI
curl -Ls "https://get.maestro.mobile.dev" | bash

# 2. (iOS) Instalar IDB
brew tap facebook/fb
brew install facebook/fb/idb-companion

# 3. Configurar variables de entorno
cp .maestro/.env.example .maestro/.env
# Editar .env con credenciales de test

# 4. Iniciar emulador/simulador y la app
pnpm ios   # o pnpm android

# 5. Ejecutar tests
maestro test .maestro/flows/                           # Todos
maestro test .maestro/flows/auth/login-success.yaml    # Uno específico
maestro test --include-tags=smoke .maestro/flows/      # Solo smoke tests
maestro test --env-file=.maestro/.env .maestro/flows/  # Con env file
```

## Maestro Studio (inspector visual)

```bash
maestro studio
```

Abre un inspector interactivo para explorar la UI y generar comandos YAML.

## Tags

| Tag | Descripción |
|-----|-------------|
| `smoke` | Tests mínimos para verificar que la app funciona |
| `auth` | Flujos de autenticación |
| `accounts` | Gestión de cuentas |
| `transactions` | Transacciones y búsqueda |
| `import` | Importación de PDFs |
| `regression` | Suite completa de regresión |

## Convenciones

- **testID**: Todos los componentes testeados deben tener `testID` con formato `{screen}-{element}-{type}`
  - Ejemplos: `login-email-input`, `dashboard-balance-card`, `tab-accounts`
- **Helpers**: Flows reutilizables van en `helpers/` y se invocan con `runFlow`
- **Variables**: Usar `${VARIABLE}` para datos dinámicos, definir en `.env`
- **Idioma**: Comentarios y nombres de archivo en español, comandos YAML en inglés
