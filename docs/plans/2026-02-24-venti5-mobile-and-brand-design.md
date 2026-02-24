# Venti5 — Mobile App & Brand Identity Design

> Date: 2026-02-24
> Status: Approved
> Scope: Brand identity foundation + React Native/Expo mobile MVP

---

## Part 1: Brand Identity

### Name & Positioning

**Venti5** — "Tus finanzas, claras."

Wordplay on "veinticinco" (25). Brand voice: clear, confident, not preachy. Gives users control without lecturing about money.

### Color Palette

Clean minimal with one bold primary. Emerald green signals growth, money, and trust — differentiates from Colombia's blue-dominated banking landscape (Bancolombia, BBVA, Davivienda).

| Role | Name | Hex | Usage |
|---|---|---|---|
| Primary | Emerald | `#10B981` | CTAs, active states, key metrics, logo accent |
| Primary dark | Deep emerald | `#059669` | Hover/pressed states |
| Primary light | Emerald tint | `#D1FAE5` | Backgrounds, badges, highlights |
| Neutral 900 | Near black | `#111827` | Headings, primary text |
| Neutral 600 | Dark gray | `#4B5563` | Body text, secondary content |
| Neutral 200 | Light gray | `#E5E7EB` | Borders, dividers |
| Neutral 50 | Off-white | `#F9FAFB` | Page backgrounds |
| White | Pure white | `#FFFFFF` | Cards, surfaces |
| Success | Green | `#22C55E` | Positive changes, income |
| Warning | Amber | `#F59E0B` | Budget alerts, approaching limits |
| Error | Red | `#EF4444` | Overspent, negative, debt alerts |
| Info | Blue | `#3B82F6` | Informational, neutral highlights |

### Typography

| Role | Font | Weight | Reasoning |
|---|---|---|---|
| Headings | Inter | 600, 700 | Clean geometric sans-serif. Excellent tabular numbers for finance. |
| Body | Inter | 400, 500 | Same family, consistent. Highly legible at mobile sizes. |
| Numbers | Inter tabular figures | 500 | Currency displays align columns with same-width digits. |

### Logo

- **Wordmark**: "Venti5" in Inter Bold, "5" in primary emerald.
- **Icon mark**: Stylized "V5" monogram for app icon and favicon.
- **App icon**: Emerald background + white icon mark.

### Spacing & Radius

| Token | Value | Usage |
|---|---|---|
| `radius-sm` | 6px | Inputs, small buttons |
| `radius-md` | 10px | Cards, modals |
| `radius-lg` | 16px | Large containers, bottom sheets |
| `radius-full` | 9999px | Pills, avatars, tags |
| `space-unit` | 4px | Base unit (multiples: 8, 12, 16, 24, 32) |

---

## Part 2: Mobile App Architecture

### Decision Record

- **Framework**: React Native + Expo (not Flutter) — reuses TypeScript skills, Supabase JS SDK, and shared types. EAS handles Apple signing/provisioning for first-time iOS developer.
- **Architecture**: Local-first with SQLite + queue-based sync to Supabase.
- **Repo**: Monorepo — `mobile/` alongside `webapp/`, shared `packages/shared/`.
- **UX**: Completely remade for mobile. Not a web clone.

### Monorepo Structure

```
personal_finance_manager/
├── webapp/                    # Existing Next.js app (unchanged)
├── mobile/                    # Expo app
│   ├── app/                   # Expo Router (file-based routing)
│   │   ├── (tabs)/            # Tab navigator
│   │   │   ├── index.tsx      # Dashboard
│   │   │   ├── transactions.tsx
│   │   │   ├── import.tsx
│   │   │   └── settings.tsx
│   │   ├── (auth)/            # Login/signup screens
│   │   │   ├── login.tsx
│   │   │   └── signup.tsx
│   │   ├── transaction/[id].tsx
│   │   └── _layout.tsx        # Root layout
│   ├── components/            # Mobile-specific components
│   ├── lib/
│   │   ├── db/                # SQLite schema + queries
│   │   ├── sync/              # Supabase <-> SQLite sync logic
│   │   └── supabase.ts        # Supabase client for mobile
│   ├── theme/                 # Venti5 brand tokens (NativeWind)
│   ├── app.json
│   ├── package.json
│   └── tsconfig.json
├── packages/
│   └── shared/
│       ├── types/             # database.ts, domain.ts
│       ├── utils/             # currency.ts, date.ts, idempotency.ts
│       └── constants/         # Categories, enums
├── services/                  # Existing PDF parser
├── supabase/                  # Existing migrations
└── package.json               # Root pnpm workspaces config
```

### Local-First Architecture

```
┌─────────────────────────────────────┐
│           Mobile App UI             │
├─────────────────────────────────────┤
│         Repository Layer            │
│   (reads/writes to local SQLite)    │
├──────────────┬──────────────────────┤
│  expo-sqlite │    Sync Engine       │
│  (local DB)  │  (background sync)   │
├──────────────┴──────────────────────┤
│         Supabase (remote)           │
│   Auth · Postgres · Realtime        │
└─────────────────────────────────────┘
```

1. All reads from local SQLite — instant, offline-capable.
2. All writes to local SQLite first — then queued for sync.
3. Sync engine runs in background: push local changes, pull remote changes.
4. Conflict resolution: last-write-wins for simple fields. Transactions dedup via `idempotency_key`.

SQLite tables mirror Supabase: `accounts`, `transactions`, `categories`, `profiles`, `statement_snapshots`. Plus `sync_queue` and `sync_metadata` for sync state.

### MVP Screens

**Tab 1 — Dashboard**
- Net balance (big number, top)
- Monthly spend vs income summary
- Top spending categories
- "Importar extracto" FAB
- Pull-to-refresh triggers sync

**Tab 2 — Transacciones**
- Scrollable list grouped by date
- Each row: icon + merchant/description + category pill + amount (colored by direction)
- Search bar (full-text on description/merchant)
- Filter by account, category, date range
- Tap → detail screen

**Tab 3 — Importar**
- Document picker (camera or files)
- Calls existing Python parser via `/api/parse-statement`
- 3-step flow: Select PDF → Review → Confirm
- Requires network (parser is server-side), shows offline message

**Tab 4 — Ajustes**
- Account management
- Profile info
- Sync status indicator
- Plan info (Free/Pro)
- Sign out

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 52+ with Expo Router v4 |
| Language | TypeScript (strict) |
| Styling | NativeWind v4 |
| State | Zustand |
| Local DB | expo-sqlite |
| Remote | @supabase/supabase-js |
| Auth | Supabase Auth + expo-secure-store |
| Navigation | Expo Router (file-based, tab layout) |
| Animations | react-native-reanimated 3 |
| Charts | victory-native or react-native-gifted-charts |
| PDF picker | expo-document-picker |
| Notifications | expo-notifications (infrastructure only in v1) |
| Icons | lucide-react-native |
| Build/Deploy | EAS Build + EAS Submit |

### Auth Flow

1. App opens → check expo-secure-store for Supabase session
2. Valid session → hydrate from SQLite cache → Dashboard → background sync
3. No session → Login screen → Supabase Auth (email/password)
4. After login → initial sync: pull all data from Supabase → populate SQLite
5. Store session in expo-secure-store (encrypted native keychain)

### NOT in MVP

- Debt dashboard — web only for now
- Category management — web only
- Recurring transactions — web only
- AI chat — future
- Budgets — future
- Push notification alerts — infra ready, no alerts in v1
- Dark mode — tokens support it, ship light-only first
