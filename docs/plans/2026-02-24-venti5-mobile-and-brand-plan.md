# Venti5 Mobile App & Brand Identity — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up the Venti5 brand identity in Pencil, then scaffold and build a React Native/Expo mobile MVP (Dashboard + Transactions + PDF Import) with local-first SQLite architecture in a monorepo alongside the existing webapp.

**Architecture:** Monorepo with pnpm workspaces. Expo Router for navigation, NativeWind for styling, expo-sqlite for local-first storage, Supabase JS for auth and remote sync. Shared types/utils in `packages/shared/`.

**Tech Stack:** Expo SDK 52+, Expo Router v4, NativeWind v4, Zustand, expo-sqlite, @supabase/supabase-js, react-native-reanimated, lucide-react-native, EAS Build.

**Design doc:** `docs/plans/2026-02-24-venti5-mobile-and-brand-design.md`

---

## Phase 0: Brand Identity in Pencil

### Task 0.1: Create Venti5 Brand Board in Pencil

**Files:**
- Create: `design/venti5-brand.pen` (via Pencil MCP)

**Step 1: Open new Pencil document**

Use `mcp__pencil__open_document("new")` to create a fresh canvas.

**Step 2: Get design guidelines and style guide**

- Call `mcp__pencil__get_guidelines(topic="landing-page")` for general design rules.
- Call `mcp__pencil__get_style_guide_tags()` then `mcp__pencil__get_style_guide(tags=["minimal", "clean", "fintech", "modern", "white", "green", "mobile", "website"])` for inspiration.

**Step 3: Design the brand board**

Create a frame containing:
1. **Logo section**: "Venti5" wordmark in Inter Bold, "5" in `#10B981` emerald, rest in `#111827`.
2. **Color palette**: 12 color swatches with hex labels (see design doc for exact values).
3. **Typography scale**: Heading sizes (H1: 32px, H2: 24px, H3: 20px, Body: 16px, Caption: 14px) all in Inter.
4. **Spacing/radius tokens**: Visual reference for radius-sm/md/lg/full.
5. **App icon concept**: Emerald square with rounded corners + white "V5" monogram.

**Step 4: Take screenshot and validate**

Use `mcp__pencil__get_screenshot` to verify the board looks clean and cohesive.

**Step 5: Save the .pen file**

Save to `design/venti5-brand.pen`.

---

## Phase 1: Monorepo + Expo Scaffold

### Task 1.1: Set Up Root Monorepo with pnpm Workspaces

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Modify: `webapp/package.json` (add workspace name)

**Step 1: Create root `package.json`**

```json
{
  "private": true,
  "name": "venti5",
  "scripts": {
    "web": "pnpm --filter webapp dev",
    "mobile": "pnpm --filter mobile start",
    "build:web": "pnpm --filter webapp build"
  }
}
```

**Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "webapp"
  - "mobile"
  - "packages/*"
```

**Step 3: Add name to `webapp/package.json`**

Add `"name": "webapp"` field if not already present.

**Step 4: Run `pnpm install` from root to verify workspace resolution**

Run: `pnpm install`
Expected: Lockfile updates, no errors.

**Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml webapp/package.json pnpm-lock.yaml
git commit -m "chore: set up pnpm monorepo workspaces"
```

---

### Task 1.2: Create Shared Package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types/database.ts` (copy from webapp)
- Create: `packages/shared/src/types/domain.ts` (adapted from webapp)
- Create: `packages/shared/src/utils/currency.ts` (copy from webapp)
- Create: `packages/shared/src/utils/date.ts` (adapted — remove Next.js-specific imports)
- Create: `packages/shared/src/utils/idempotency.ts` (copy from webapp)
- Create: `packages/shared/src/index.ts` (barrel export)

**Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@venti5/shared",
  "version": "0.0.1",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "date-fns": "^4.1.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create `packages/shared/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 3: Copy type files**

- Copy `webapp/src/types/database.ts` → `packages/shared/src/types/database.ts`
- Create `packages/shared/src/types/domain.ts` — same content as webapp's but without `@/` import alias. Use relative import: `import type { Tables, Enums } from "./database";`

**Step 4: Copy utility files**

- Copy `currency.ts`, `date.ts`, `idempotency.ts` from `webapp/src/lib/utils/` → `packages/shared/src/utils/`.
- In each file: replace `@/types/domain` import with `../types/domain`.
- In `idempotency.ts`: uses `crypto.subtle` which works in both web and React Native (Expo's crypto polyfill). No changes needed.

**Step 5: Create barrel export `packages/shared/src/index.ts`**

```typescript
export * from "./types/database";
export * from "./types/domain";
export * from "./utils/currency";
export * from "./utils/date";
export * from "./utils/idempotency";
```

**Step 6: Run `pnpm install` from root to register the shared package**

Run: `pnpm install`

**Step 7: Commit**

```bash
git add packages/
git commit -m "feat: create @venti5/shared package with types and utils"
```

---

### Task 1.3: Scaffold Expo App

**Files:**
- Create: `mobile/` directory (via `create-expo-app`)

**Step 1: Create Expo app**

Run from project root:
```bash
npx create-expo-app@latest mobile --template tabs
```

This gives us Expo Router with tab navigation pre-configured.

**Step 2: Verify it runs**

```bash
cd mobile && npx expo start
```

Expected: Metro bundler starts, QR code shown. Press `i` for iOS simulator or scan with Expo Go.

**Step 3: Clean up template boilerplate**

Remove default template screens/content — we'll replace with our own. Keep the `_layout.tsx` structure but strip example content.

**Step 4: Add `@venti5/shared` dependency to `mobile/package.json`**

```json
"dependencies": {
  "@venti5/shared": "workspace:*"
}
```

Run: `pnpm install` from root.

**Step 5: Commit**

```bash
git add mobile/ pnpm-lock.yaml
git commit -m "feat: scaffold Expo app with tab navigation"
```

---

### Task 1.4: Set Up NativeWind + Venti5 Theme

**Files:**
- Modify: `mobile/package.json` (add nativewind deps)
- Create: `mobile/global.css`
- Create: `mobile/tailwind.config.ts`
- Create: `mobile/nativewind-env.d.ts`
- Modify: `mobile/app/_layout.tsx` (import global.css)
- Modify: `mobile/metro.config.js` (add nativewind transformer)

**Step 1: Install NativeWind**

```bash
cd mobile && pnpm add nativewind tailwindcss react-native-reanimated react-native-safe-area-context
pnpm add -D nativewind@^4 tailwindcss@^3
```

Follow Expo setup from NativeWind v4 docs (metro config, babel preset).

**Step 2: Create `mobile/tailwind.config.ts`**

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#10B981",
          dark: "#059669",
          light: "#D1FAE5",
        },
        neutral: {
          50: "#F9FAFB",
          200: "#E5E7EB",
          600: "#4B5563",
          900: "#111827",
        },
        success: "#22C55E",
        warning: "#F59E0B",
        error: "#EF4444",
        info: "#3B82F6",
      },
      fontFamily: {
        inter: ["Inter"],
        "inter-medium": ["Inter_500Medium"],
        "inter-semibold": ["Inter_600SemiBold"],
        "inter-bold": ["Inter_700Bold"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
      },
    },
  },
  plugins: [],
};
export default config;
```

**Step 3: Create `mobile/global.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 4: Set up metro config and babel for NativeWind**

Follow NativeWind Expo setup: add `nativewind/babel` to babel presets, configure `metro.config.js` with `withNativeWind`.

**Step 5: Import global.css in `mobile/app/_layout.tsx`**

Add `import "../global.css";` at the top.

**Step 6: Install Inter font via expo-font**

```bash
cd mobile && pnpm add @expo-google-fonts/inter expo-font
```

Load font in root layout:
```typescript
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
```

**Step 7: Verify NativeWind works**

Create a simple test screen with `className="bg-primary text-white p-4"`. Run the app.
Expected: Green background, white text, padding.

**Step 8: Commit**

```bash
git add mobile/
git commit -m "feat: set up NativeWind with Venti5 brand theme"
```

---

## Phase 2: Auth + SQLite + Sync

### Task 2.1: Set Up Supabase Auth for Mobile

**Files:**
- Create: `mobile/lib/supabase.ts`
- Modify: `mobile/package.json` (add supabase deps)
- Create: `mobile/lib/auth.ts`
- Modify: `mobile/app/_layout.tsx` (auth provider)

**Step 1: Install Supabase + secure storage**

```bash
cd mobile && pnpm add @supabase/supabase-js expo-secure-store react-native-url-polyfill
```

**Step 2: Create `mobile/lib/supabase.ts`**

```typescript
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import type { Database } from "@venti5/shared";

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
```

**Step 3: Create `mobile/.env`**

```
EXPO_PUBLIC_SUPABASE_URL=https://tgkhaxipfgskxydotdtu.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

**Step 4: Create `mobile/lib/auth.ts`** — auth context with session state

```typescript
import { createContext, useContext } from "react";
import type { Session } from "@supabase/supabase-js";

type AuthContextType = {
  session: Session | null;
  loading: boolean;
};

export const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);
```

**Step 5: Wire auth into root `_layout.tsx`**

- Listen to `supabase.auth.onAuthStateChange` in root layout
- Provide `AuthContext`
- Redirect to `(auth)/login` if no session, to `(tabs)` if authenticated

**Step 6: Create minimal login screen at `mobile/app/(auth)/login.tsx`**

- Email + password inputs
- "Iniciar sesión" button calling `supabase.auth.signInWithPassword`
- Error display
- Link to signup (can be a stub for now)

**Step 7: Verify login flow works against live Supabase**

Run app → should redirect to login → enter credentials → should redirect to tabs.

**Step 8: Commit**

```bash
git add mobile/
git commit -m "feat: set up Supabase auth with expo-secure-store"
```

---

### Task 2.2: Set Up Local SQLite Database

**Files:**
- Create: `mobile/lib/db/schema.ts`
- Create: `mobile/lib/db/database.ts`
- Create: `mobile/lib/db/migrations.ts`
- Test: `mobile/lib/db/__tests__/schema.test.ts`

**Step 1: Install expo-sqlite**

```bash
cd mobile && pnpm add expo-sqlite
```

**Step 2: Create `mobile/lib/db/schema.ts`** — SQL statements for local tables

Mirror the 5 MVP tables from Supabase:

```typescript
export const MIGRATIONS = [
  // v1: Core tables
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL,
    institution_name TEXT,
    currency_code TEXT NOT NULL DEFAULT 'COP',
    current_balance REAL NOT NULL DEFAULT 0,
    available_balance REAL,
    credit_limit REAL,
    interest_rate REAL,
    is_active INTEGER NOT NULL DEFAULT 1,
    icon TEXT,
    color TEXT,
    payment_day INTEGER,
    cutoff_day INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    name_es TEXT,
    icon TEXT,
    color TEXT,
    parent_id TEXT,
    is_system INTEGER NOT NULL DEFAULT 0,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    category_id TEXT,
    amount REAL NOT NULL,
    direction TEXT NOT NULL,
    description TEXT,
    merchant_name TEXT,
    raw_description TEXT,
    transaction_date TEXT NOT NULL,
    post_date TEXT,
    status TEXT NOT NULL DEFAULT 'POSTED',
    idempotency_key TEXT UNIQUE,
    is_excluded INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
  )`,
  `CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    email TEXT,
    full_name TEXT,
    plan TEXT NOT NULL DEFAULT 'free',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS statement_snapshots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    period TEXT NOT NULL,
    statement_date TEXT,
    statement_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  // Sync infrastructure
  `CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    synced_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS sync_metadata (
    table_name TEXT PRIMARY KEY,
    last_synced_at TEXT
  )`,
  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_idempotency ON transactions(idempotency_key)`,
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_unsynced ON sync_queue(synced_at) WHERE synced_at IS NULL`,
];
```

**Step 3: Create `mobile/lib/db/database.ts`** — DB init + migration runner

```typescript
import * as SQLite from "expo-sqlite";
import { MIGRATIONS } from "./schema";

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("venti5.db");
  await runMigrations(db);
  return db;
}

async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync("PRAGMA journal_mode = WAL;");
  await database.execAsync("PRAGMA foreign_keys = ON;");
  for (const migration of MIGRATIONS) {
    await database.execAsync(migration);
  }
}
```

**Step 4: Write test for schema creation**

```typescript
// mobile/lib/db/__tests__/schema.test.ts
import { MIGRATIONS } from "../schema";

describe("SQLite schema", () => {
  it("has migrations for all core tables", () => {
    const sql = MIGRATIONS.join("\n");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS accounts");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS categories");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS transactions");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS profiles");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS sync_queue");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS sync_metadata");
  });

  it("all migrations are non-empty strings", () => {
    for (const m of MIGRATIONS) {
      expect(typeof m).toBe("string");
      expect(m.trim().length).toBeGreaterThan(0);
    }
  });
});
```

**Step 5: Run test**

```bash
cd mobile && npx jest lib/db/__tests__/schema.test.ts
```

**Step 6: Commit**

```bash
git add mobile/lib/db/
git commit -m "feat: set up local SQLite schema mirroring Supabase tables"
```

---

### Task 2.3: Build Sync Engine

**Files:**
- Create: `mobile/lib/sync/pull.ts`
- Create: `mobile/lib/sync/push.ts`
- Create: `mobile/lib/sync/engine.ts`
- Create: `mobile/lib/sync/hooks.ts`

**Step 1: Create `mobile/lib/sync/pull.ts`** — download data from Supabase → SQLite

```typescript
import { supabase } from "../supabase";
import { getDatabase } from "../db/database";

const SYNC_TABLES = ["profiles", "accounts", "categories", "transactions", "statement_snapshots"] as const;

export async function pullTable(tableName: typeof SYNC_TABLES[number]): Promise<number> {
  const db = await getDatabase();
  const meta = await db.getFirstAsync<{ last_synced_at: string | null }>(
    "SELECT last_synced_at FROM sync_metadata WHERE table_name = ?",
    [tableName]
  );

  let query = supabase.from(tableName).select("*");
  if (meta?.last_synced_at) {
    query = query.gt("updated_at", meta.last_synced_at);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!data || data.length === 0) return 0;

  // Upsert each row into local SQLite
  for (const row of data) {
    const columns = Object.keys(row);
    const placeholders = columns.map(() => "?").join(", ");
    const values = columns.map((col) => {
      const val = row[col];
      if (val === null || val === undefined) return null;
      if (typeof val === "object") return JSON.stringify(val);
      if (typeof val === "boolean") return val ? 1 : 0;
      return val;
    });

    await db.runAsync(
      `INSERT OR REPLACE INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`,
      values
    );
  }

  // Update sync timestamp
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO sync_metadata (table_name, last_synced_at) VALUES (?, ?)`,
    [tableName, now]
  );

  return data.length;
}

export async function pullAll(): Promise<Record<string, number>> {
  const results: Record<string, number> = {};
  for (const table of SYNC_TABLES) {
    results[table] = await pullTable(table);
  }
  return results;
}
```

**Step 2: Create `mobile/lib/sync/push.ts`** — upload local changes to Supabase

```typescript
import { supabase } from "../supabase";
import { getDatabase } from "../db/database";

export async function pushPendingChanges(): Promise<number> {
  const db = await getDatabase();
  const pending = await db.getAllAsync<{
    id: number;
    table_name: string;
    record_id: string;
    operation: string;
    payload: string;
  }>("SELECT * FROM sync_queue WHERE synced_at IS NULL ORDER BY created_at ASC");

  let synced = 0;
  for (const item of pending) {
    const data = JSON.parse(item.payload);
    let error;

    if (item.operation === "INSERT") {
      ({ error } = await supabase.from(item.table_name).upsert(data));
    } else if (item.operation === "UPDATE") {
      ({ error } = await supabase.from(item.table_name).update(data).eq("id", item.record_id));
    } else if (item.operation === "DELETE") {
      ({ error } = await supabase.from(item.table_name).delete().eq("id", item.record_id));
    }

    if (!error) {
      await db.runAsync(
        "UPDATE sync_queue SET synced_at = datetime('now') WHERE id = ?",
        [item.id]
      );
      synced++;
    }
  }

  return synced;
}
```

**Step 3: Create `mobile/lib/sync/engine.ts`** — orchestrates pull + push

```typescript
import { pullAll } from "./pull";
import { pushPendingChanges } from "./push";

export type SyncStatus = "idle" | "syncing" | "error";

export async function syncAll(): Promise<{ pushed: number; pulled: Record<string, number> }> {
  // Push first (send local changes before pulling remote)
  const pushed = await pushPendingChanges();
  const pulled = await pullAll();
  return { pushed, pulled };
}
```

**Step 4: Create `mobile/lib/sync/hooks.ts`** — React hook for sync state

```typescript
import { useState, useCallback } from "react";
import { syncAll, type SyncStatus } from "./engine";

export function useSync() {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const sync = useCallback(async () => {
    if (status === "syncing") return;
    setStatus("syncing");
    try {
      await syncAll();
      setLastSynced(new Date());
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, [status]);

  return { status, lastSynced, sync };
}
```

**Step 5: Commit**

```bash
git add mobile/lib/sync/
git commit -m "feat: build sync engine (pull from Supabase, push local changes)"
```

---

### Task 2.4: Create Zustand Store + Repository Layer

**Files:**
- Create: `mobile/lib/store.ts`
- Create: `mobile/lib/repositories/accounts.ts`
- Create: `mobile/lib/repositories/transactions.ts`
- Create: `mobile/lib/repositories/categories.ts`

**Step 1: Install Zustand**

```bash
cd mobile && pnpm add zustand
```

**Step 2: Create `mobile/lib/store.ts`** — global app state

```typescript
import { create } from "zustand";
import type { Account, Transaction, Category } from "@venti5/shared";

type AppState = {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  setAccounts: (accounts: Account[]) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setCategories: (categories: Category[]) => void;
};

export const useAppStore = create<AppState>((set) => ({
  accounts: [],
  transactions: [],
  categories: [],
  setAccounts: (accounts) => set({ accounts }),
  setTransactions: (transactions) => set({ transactions }),
  setCategories: (categories) => set({ categories }),
}));
```

**Step 3: Create repository files** — each reads from SQLite + populates store

Each repository follows the same pattern:
- `getAll()`: reads from SQLite, returns typed array
- `getById()`: reads single record
- Writes go through SQLite + add to `sync_queue`

Example for `mobile/lib/repositories/accounts.ts`:
```typescript
import { getDatabase } from "../db/database";
import type { Account } from "@venti5/shared";

export async function getAllAccounts(): Promise<Account[]> {
  const db = await getDatabase();
  return db.getAllAsync<Account>(
    "SELECT * FROM accounts WHERE is_active = 1 ORDER BY display_order"
  );
}

export async function getAccountById(id: string): Promise<Account | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Account>("SELECT * FROM accounts WHERE id = ?", [id]);
}
```

Similar pattern for `transactions.ts` (with date filtering, search, pagination) and `categories.ts`.

**Step 4: Commit**

```bash
git add mobile/lib/store.ts mobile/lib/repositories/
git commit -m "feat: add Zustand store and repository layer for local data"
```

---

## Phase 3: MVP Screens

### Task 3.1: Tab Navigation + Root Layout

**Files:**
- Modify: `mobile/app/_layout.tsx`
- Modify: `mobile/app/(tabs)/_layout.tsx`
- Create: `mobile/app/(auth)/_layout.tsx`

**Step 1: Configure root layout**

Root layout should:
- Load Inter fonts
- Import `global.css`
- Provide `AuthContext`
- Listen to auth state changes
- Show splash screen until fonts loaded

**Step 2: Configure tab layout at `mobile/app/(tabs)/_layout.tsx`**

4 tabs with lucide-react-native icons:
- Dashboard (LayoutDashboard icon)
- Transacciones (Receipt icon)
- Importar (Upload icon)
- Ajustes (Settings icon)

Tab bar styling: white background, primary emerald active color, neutral-600 inactive.

**Step 3: Create auth layout at `mobile/app/(auth)/_layout.tsx`**

Simple Stack navigator for login/signup screens.

**Step 4: Verify navigation works**

Run app → login → should see 4 tabs with icons and labels.

**Step 5: Commit**

```bash
git add mobile/app/
git commit -m "feat: configure tab navigation with Venti5 theme"
```

---

### Task 3.2: Dashboard Screen

**Files:**
- Create: `mobile/app/(tabs)/index.tsx`
- Create: `mobile/components/dashboard/BalanceCard.tsx`
- Create: `mobile/components/dashboard/MonthSummary.tsx`
- Create: `mobile/components/dashboard/CategoryBreakdown.tsx`

**Step 1: Build BalanceCard component**

Large card at top showing:
- "Balance total" label (neutral-600, 14px)
- Sum of all account balances formatted with `formatCurrency` from `@venti5/shared`
- Subtitle: "{N} cuentas activas" (neutral-600)

Styling: white card, `rounded-lg`, shadow-sm, padding-6.

**Step 2: Build MonthSummary component**

Two side-by-side cards:
- "Ingresos" (green text): total INFLOW this month
- "Gastos" (error red text): total OUTFLOW this month

Each uses `formatCurrency`. Query transactions from SQLite filtered by current month.

**Step 3: Build CategoryBreakdown component**

Horizontal bar chart or simple list of top 5 spending categories this month.
Each row: category icon + name + amount + percentage bar.
Use data from transactions grouped by category_id, joined with categories table.

For MVP: use simple View-based bars, not a charting library. Keeps it lightweight.

**Step 4: Compose Dashboard screen**

```typescript
// mobile/app/(tabs)/index.tsx
export default function DashboardScreen() {
  // Pull data from Zustand store (populated by sync on app load)
  // Pull-to-refresh triggers sync
  return (
    <ScrollView refreshControl={<RefreshControl onRefresh={sync} />}>
      <BalanceCard />
      <MonthSummary />
      <CategoryBreakdown />
    </ScrollView>
  );
}
```

**Step 5: Verify with real data** — login, sync, see dashboard populated.

**Step 6: Commit**

```bash
git add mobile/app/\(tabs\)/index.tsx mobile/components/dashboard/
git commit -m "feat: build dashboard screen with balance, summary, and categories"
```

---

### Task 3.3: Transactions Screen

**Files:**
- Create: `mobile/app/(tabs)/transactions.tsx`
- Create: `mobile/components/transactions/TransactionRow.tsx`
- Create: `mobile/components/transactions/SearchBar.tsx`
- Create: `mobile/app/transaction/[id].tsx`

**Step 1: Build TransactionRow component**

Each row shows:
- Left: category icon (or default) with colored background circle
- Center: merchant_name or description (bold), category name below (neutral-600)
- Right: formatted amount, colored green (INFLOW) or neutral-900 (OUTFLOW)
- Date as section header (grouped by day)

**Step 2: Build SearchBar component**

TextInput with search icon. Filters transactions by `description LIKE '%query%'` OR `merchant_name LIKE '%query%'` in SQLite.

**Step 3: Build Transactions list screen**

- SectionList grouped by date (Spanish formatted via `formatDate`)
- SearchBar at top (scrolls with list)
- Tap row → navigate to `transaction/[id]`
- Load from SQLite via repository, paginated (50 at a time, load more on scroll)

**Step 4: Build Transaction detail screen at `mobile/app/transaction/[id].tsx`**

Full transaction info:
- Amount (large), direction indicator
- Account name, category pill
- Date, status
- Raw description
- Notes field (read-only for MVP)

**Step 5: Verify search and navigation work.**

**Step 6: Commit**

```bash
git add mobile/app/ mobile/components/transactions/
git commit -m "feat: build transactions list with search and detail view"
```

---

### Task 3.4: Import Screen

**Files:**
- Create: `mobile/app/(tabs)/import.tsx`
- Create: `mobile/components/import/PdfPicker.tsx`
- Create: `mobile/components/import/ReviewStep.tsx`
- Create: `mobile/components/import/ResultStep.tsx`

**Step 1: Install expo-document-picker**

```bash
cd mobile && pnpm add expo-document-picker
```

**Step 2: Build PdfPicker component**

- Large dashed-border drop zone with upload icon
- Tap → opens document picker filtered to `application/pdf`
- Shows selected file name + size
- "Procesar extracto" button

**Step 3: Build the import flow**

3 steps managed by local state (`step: 'pick' | 'review' | 'result'`):

1. **Pick**: PdfPicker → on select, upload PDF to `/api/parse-statement` on the webapp's domain (same endpoint the web uses). Show loading spinner.
2. **Review**: Show parsed transactions in a FlatList. Each row has a checkbox (select/deselect). "Importar {N} transacciones" button at bottom.
3. **Result**: Show success count. "Ver transacciones" button navigates to Transactions tab.

**Important**: The import endpoint URL should come from env var `EXPO_PUBLIC_API_URL` pointing to the deployed webapp (e.g., `https://your-app.vercel.app`).

**Step 4: Upload logic**

```typescript
const formData = new FormData();
formData.append("file", {
  uri: document.uri,
  name: document.name,
  type: "application/pdf",
} as any);

const response = await fetch(`${API_URL}/api/parse-statement`, {
  method: "POST",
  body: formData,
  headers: { Authorization: `Bearer ${session.access_token}` },
});
```

**Step 5: On confirm import** — insert transactions into local SQLite + add to sync_queue for push to Supabase. Use `computeIdempotencyKey` from `@venti5/shared` for dedup.

**Step 6: Verify full import flow** — pick PDF → see parsed transactions → confirm → see them in Transactions tab.

**Step 7: Commit**

```bash
git add mobile/app/ mobile/components/import/
git commit -m "feat: build PDF import flow with document picker"
```

---

### Task 3.5: Settings Screen

**Files:**
- Create: `mobile/app/(tabs)/settings.tsx`

**Step 1: Build Settings screen**

Simple list of sections:

```
Perfil
├── Nombre: {full_name}
├── Email: {email}
└── Plan: Gratuito / Pro

Sincronización
├── Estado: Sincronizado ✓ / Sincronizando... / Error
├── Última sync: hace 5 minutos
└── [Sincronizar ahora] button

Cuentas
└── List of accounts with name + type + balance

Sesión
└── [Cerrar sesión] button (red)
```

**Step 2: Sign out logic**

```typescript
await supabase.auth.signOut();
// Clear local SQLite data
const db = await getDatabase();
await db.execAsync("DELETE FROM transactions; DELETE FROM accounts; DELETE FROM categories; DELETE FROM profiles; DELETE FROM sync_queue; DELETE FROM sync_metadata;");
```

**Step 3: Commit**

```bash
git add mobile/app/\(tabs\)/settings.tsx
git commit -m "feat: build settings screen with sync status and sign out"
```

---

## Phase 4: Polish + Build

### Task 4.1: App Icon and Splash Screen

**Files:**
- Create: `mobile/assets/icon.png` (1024x1024, emerald bg + white V5 mark)
- Create: `mobile/assets/splash.png` (emerald bg + white Venti5 wordmark)
- Modify: `mobile/app.json` (icon, splash, name config)

**Step 1: Configure app.json**

```json
{
  "expo": {
    "name": "Venti5",
    "slug": "venti5",
    "scheme": "venti5",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#10B981"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.venti5.app"
    },
    "android": {
      "package": "com.venti5.app",
      "adaptiveIcon": {
        "foregroundImage": "./assets/icon.png",
        "backgroundColor": "#10B981"
      }
    }
  }
}
```

**Step 2: Generate icon and splash assets**

Use a tool or simple design: emerald `#10B981` background, centered white "V5" text in Inter Bold.

**Step 3: Commit**

```bash
git add mobile/assets/ mobile/app.json
git commit -m "feat: add Venti5 app icon and splash screen"
```

---

### Task 4.2: First EAS Build (iOS)

**Step 1: Install EAS CLI**

```bash
npm install -g eas-cli
```

**Step 2: Log in to Expo account**

```bash
eas login
```

**Step 3: Configure EAS**

```bash
cd mobile && eas build:configure
```

This creates `eas.json` with build profiles.

**Step 4: Register iOS bundle ID**

```bash
eas credentials --platform ios
```

EAS handles Apple Developer certificate and provisioning profile creation.

**Step 5: Create development build**

```bash
eas build --platform ios --profile development
```

**Step 6: Install on simulator or device via TestFlight**

Follow EAS output for install instructions.

**Step 7: Commit**

```bash
git add mobile/eas.json
git commit -m "chore: configure EAS build for iOS"
```

---

## Summary: Task Dependency Graph

```
Phase 0: Brand (Pencil)     ──→ Task 0.1 (brand board)
                                    │
Phase 1: Scaffold            ──→ Task 1.1 (monorepo) → Task 1.2 (shared pkg) → Task 1.3 (expo) → Task 1.4 (nativewind)
                                                                                                         │
Phase 2: Infrastructure      ──→ Task 2.1 (auth) → Task 2.2 (sqlite) → Task 2.3 (sync) → Task 2.4 (store)
                                                                                                    │
Phase 3: Screens             ──→ Task 3.1 (navigation) → Task 3.2 (dashboard) → Task 3.3 (transactions) → Task 3.4 (import) → Task 3.5 (settings)
                                                                                                                                      │
Phase 4: Polish              ──→ Task 4.1 (icon/splash) → Task 4.2 (EAS build)
```

**Total: 14 tasks, ~4 phases.**
Phase 0 can run in parallel with Phase 1. Phases 2-4 are sequential.
