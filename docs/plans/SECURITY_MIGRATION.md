# Security Migration Plan
**Audited:** 2026-02-27 | **Status:** Pending
**Scope:** Web app, Mobile (iOS/Android), PDF Parser service, Supabase database

---

## Context

Full security audit conducted on 2026-02-27 covering all layers of the app.
The app handles real banking data (balances, transactions, account numbers, statements).
Three critical gaps must be resolved before the app has multiple real users.

Audit report reference: conversation of 2026-02-27.

---

## P0 — Critical (24–48h)

### P0.1 — Enable RLS on core banking tables
**File to create:** `supabase/migrations/YYYYMMDD_enable_rls_core_tables.sql`

Tables currently missing RLS: `profiles`, `accounts`, `transactions`.
Any authenticated user can read/write all other users' banking data.

```sql
-- accounts
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own accounts" ON accounts FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transactions" ON transactions FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON profiles FOR ALL
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);
```

After creating the migration: `npx supabase db push --project-id tgkhaxipfgskxydotdtu`

---

### P0.2 — Fix IDOR in server actions
**Files:** `webapp/src/actions/`

Add `.eq("user_id", user.id)` filter to every read/update/delete query after the auth check.

| File | Actions to fix |
|------|----------------|
| `accounts.ts:32,135,149` | `getAccount`, `updateAccount`, `deleteAccount` |
| `transactions.ts:92,219,237,254` | `getTransaction`, `deleteTransaction`, `toggleExcludeTransaction`, `bulkExcludeTransactions` |
| `categories.ts:191,207,233` | `updateCategory`, `deleteCategory`, `updateCategoryOrder` |
| `budgets.ts:13,65,88` | `getBudgets` (no filter at all), `deleteBudget`, `getBudgetSummary` |
| `recurring-templates.ts:86,244,261` | `getRecurringTemplate`, `deleteRecurringTemplate`, `toggleRecurringTemplate` |
| `categorize.ts:88,152` | `categorizeTransaction`, `bulkCategorize` |
| `statement-snapshots.ts:9` | `getStatementSnapshots` |

Pattern for every fix:
```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!user) return { success: false, error: "No autenticado" };

const { data, error } = await supabase
  .from("accounts")
  .select("*")
  .eq("user_id", user.id)  // ← add this
  .eq("id", id);
```

---

### P0.3 — Add authentication to PDF parser
**Files:** `services/pdf_parser/main.py`, `webapp/src/app/api/parse-statement/route.ts`, `webapp/src/app/api/save-unrecognized/route.ts`

The `/parse` and `/save-unrecognized` endpoints have zero authentication.

**Parser side (`main.py`):**
```python
from fastapi.security import APIKeyHeader
from fastapi import Security, HTTPException

API_KEY = os.getenv("PARSER_API_KEY")
api_key_header = APIKeyHeader(name="X-Parser-Key", auto_error=False)

async def verify_key(key: str = Security(api_key_header)):
    if not key or key != API_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")

@app.post("/parse", dependencies=[Depends(verify_key)])
async def parse_pdf(...):
    ...
```

**Webapp proxy side (both API routes):**
```typescript
const proxyRes = await fetch(`${PARSER_URL}/parse`, {
  method: "POST",
  headers: {
    "X-Parser-Key": process.env.PDF_PARSER_API_KEY!,  // ← add
  },
  body: proxyForm,
});
```

Also add to `main.py` after reading content:
```python
MAX_PDF_BYTES = 50 * 1024 * 1024  # 50 MB
content = await file.read()
if len(content) > MAX_PDF_BYTES:
    raise HTTPException(status_code=413, detail="Archivo demasiado grande")
if not content.startswith(b"%PDF"):
    raise HTTPException(status_code=400, detail="El archivo no es un PDF válido")
```

---

### P0.4 — HTTPS on PDF parser (production)
**File:** `services/pdf_parser/main.py:150`

Remove `reload=True` from uvicorn call (dev-only, security risk in production):
```python
# Change from:
uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

# To (use env-gated config):
is_dev = os.getenv("APP_ENV", "production") != "production"
uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=is_dev)
```

The parser is already behind Docker's internal network (not publicly exposed).
nginx handles HTTPS for the webapp. No additional TLS needed for the parser itself
as long as it stays internal-only and the `PARSER_API_KEY` secret is set.

---

### P0.5 — Rotate ANON_KEY and migrate to Supabase publishable key
**Manual action first — do before any code changes.**

> ✅ `.gitignore` already covers `.env*` and `*/.env*` as of recent changes — skip that step.

**Step 1 — Supabase dashboard**
1. Check if the key was ever committed to git:
   ```bash
   git log --all -S "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" --oneline
   ```
2. Rotate legacy anon key: Dashboard → Settings → API → Rotate anon key.
3. Generate new keys: Dashboard → API Keys → New publishable key + New secret key.

**Step 2 — GitHub Secrets** (Settings → Secrets → Actions):
- Add `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (new publishable key value)
- Add `SUPABASE_SECRET_KEY` (new secret key value)
- Keep `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` alive until deploy verified, then delete

**Step 3 — Code changes** (all files, updated to reflect recent additions):

| File | Change |
|------|--------|
| `webapp/src/lib/supabase/client.ts:7` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `webapp/src/lib/supabase/server.ts:10` | same |
| `webapp/src/lib/supabase/middleware.ts:24` | same |
| `webapp/src/lib/supabase/admin.ts:6` | `SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_SERVICE_ROLE` → `SUPABASE_SECRET_KEY` (drop the dual fallback) |
| `mobile/lib/supabase.ts:71` | `EXPO_PUBLIC_SUPABASE_ANON_KEY` → `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `mobile/.env` | update key value locally — do not commit |
| `services/pdf_parser/storage.py:15` | `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SECRET_KEY` |
| `docker-compose.yml:7,15` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `docker-compose.prod.yml:15` | same |
| `.github/workflows/deploy.yml:115,116,185,186` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `.github/workflows/deploy.yml:189` | `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SECRET_KEY` |
| `.github/workflows/pr-build-images.yml:76,77` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `.github/workflows/mobile-apk.yml:112–116,133,134` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; `EXPO_PUBLIC_SUPABASE_ANON_KEY` → `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |

**Step 4 — Verify SDK before merging:**
```bash
grep '"@supabase/supabase-js"' webapp/package.json mobile/package.json
```
New publishable keys require SDK >= 2.x. The SDK handles the key format difference
transparently — no `Authorization: Bearer` changes needed in app code.

**Step 5 — After successful deploy:** delete `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from GitHub Secrets.

---

## P1 — High (within 1 week)

### P1.1 — Docker Compose security hardening
**Files:** `docker-compose.yml`, `docker-compose.prod.yml`

```yaml
services:
  pdf-parser:
    environment:
      - LOG_LEVEL=${PDF_PARSER_LOG_LEVEL:-INFO}
      - PARSER_API_KEY=${PDF_PARSER_API_KEY}        # ← add
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SECRET_KEY=${SUPABASE_SECRET_KEY}  # ← currently missing from container
    deploy:
      resources:
        limits:
          memory: 512m                               # ← add, prevents OOM from large PDFs
```

Also add `USER appuser` to `services/pdf_parser/Dockerfile`:
```dockerfile
RUN adduser --disabled-password --gecos '' appuser
USER appuser
```

---

### P1.2 — CI/CD: add security scanning
**File:** `.github/workflows/deploy.yml`

Add a `security-scan` job before build jobs:

```yaml
  security-scan:
    runs-on: ubuntu-latest
    needs: [changes]
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Secret scanning (gitleaks)
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Audit Python deps
        if: needs.changes.outputs.parser_changed == 'true'
        run: |
          pip install pip-audit
          pip-audit --requirement services/pdf_parser/requirements.txt --fail-on-vuln

      - name: Audit Node deps
        if: needs.changes.outputs.webapp_changed == 'true'
        run: npm audit --audit-level=high --prefix webapp

  build-webapp:
    needs: [changes, security-scan]   # blocks build on scan failure
    ...

  build-parser:
    needs: [changes, security-scan]
    ...
```

Also add a Supabase migration step to the deploy job:
```yaml
      - name: Apply Supabase migrations
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
        run: npx supabase db push --project-id tgkhaxipfgskxydotdtu
```

---

### P1.3 — Nginx hardening
**Files:** `infra/nginx/default.conf`, `infra/nginx/default.conf.template`

Add to the `server { listen 443 ssl; ... }` block:

```nginx
# HSTS — forces HTTPS for 1 year, browser-enforced
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

# CSP — prevents XSS from escalating to data theft
add_header Content-Security-Policy "default-src 'self'; connect-src 'self' https://*.supabase.co; img-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;

# Rate limiting for PDF upload endpoint
limit_req_zone $binary_remote_addr zone=pdf_parse:10m rate=5r/m;
```

Add a specific location block for the parse endpoint:
```nginx
location /api/parse-statement {
    limit_req zone=pdf_parse burst=3 nodelay;
    proxy_pass http://webapp;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

---

### P1.4 — Supabase auth config
**File:** `supabase/config.toml`

```toml
[auth]
minimum_password_length = 12
password_requirements = "lower_upper_letters_digits_symbols"
enable_confirmations = true

[auth.sessions]
timebox = "24h"
inactivity_timeout = "8h"
```

Push to remote: `npx supabase config push --project-id tgkhaxipfgskxydotdtu`

Also enforce same password validation client-side:
- `webapp/src/app/(auth)/signup/page.tsx` — add Zod `.min(12).regex(...)` rule
- `mobile/app/(auth)/signup.tsx:32` — same

---

### P1.5 — Add missing DELETE policy to statement_snapshots
**File:** `supabase/migrations/` (new migration)

```sql
CREATE POLICY "Users can delete own snapshots"
  ON statement_snapshots FOR DELETE
  USING ((SELECT auth.uid()) = user_id);
```

---

### P1.6 — Secure PDF temp file handling
**File:** `services/pdf_parser/main.py:79`

```python
import os
import stat

with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
    content = await file.read()
    tmp.write(content)
    tmp_path = tmp.name

# Restrict to owner read/write only immediately after creation
os.chmod(tmp_path, stat.S_IRUSR | stat.S_IWUSR)

try:
    # ... parsing logic ...
finally:
    try:
        os.remove(tmp_path)
    except OSError:
        pass  # Log but don't swallow silently
```

---

## P2 — Medium (within 2 weeks)

### P2.1 — Sanitize error messages returned to clients
**Files:** `webapp/src/app/api/parse-statement/route.ts:66`, `webapp/src/app/api/bug-reports/route.ts:123,150`

Never forward raw error messages to the client. Log server-side, return a code:
```typescript
// Instead of:
return NextResponse.json({ error: uploadError.message });

// Do:
console.error("[bug-reports] upload failed:", uploadError);
return NextResponse.json({ error: "No se pudo subir el archivo. Intenta de nuevo." }, { status: 500 });
```

---

### P2.2 — GDPR: Add account deletion flow
**Missing from entire codebase.**

1. Add a Supabase Edge Function or RPC that deletes from `auth.users` (cascades to all tables).
2. Add a "Eliminar cuenta" button in `webapp/src/app/(dashboard)/settings/` and `mobile/app/(tabs)/settings.tsx`.
3. Require password confirmation before deletion.
4. Document data retention policy for users.

---

### P2.3 — Mobile: deep link token validation
**File:** `mobile/app/(auth)/reset-password.tsx:27`

Validate the token before calling `setSession()`:
```typescript
// After extracting access_token from URL:
if (!accessToken || !refreshToken) {
  setError("Enlace inválido o expirado.");
  return;
}
// Validate token is a well-formed JWT (3 dot-separated base64 segments)
const parts = accessToken.split(".");
if (parts.length !== 3) {
  setError("Token inválido.");
  return;
}
```

Consider migrating to iOS Universal Links / Android App Links (HTTPS-based)
instead of `venti5://` custom scheme for the password reset flow, which
prevents other apps from intercepting the reset URL.

---

### P2.4 — Mobile: SQLite encryption at rest
**File:** `mobile/lib/db/database.ts:11`

The `venti5.db` SQLite file stores balances, transactions, and statement snapshots
in plaintext. If the device is compromised or backed up unencrypted, all data is exposed.

Options (evaluate in order):
1. `@op-engineering/op-sqlite` with SQLCipher — most straightforward
2. `expo-sqlite` + manual field-level encryption for sensitive columns only
3. Rely entirely on Supabase (remote) + in-memory state with no local persistence

The right choice depends on offline-first requirements. Evaluate before implementing.

---

### P2.5 — Mobile: fix cleartext traffic on Android
**File:** `mobile/android/app/src/main/AndroidManifest.xml`

Add to `<application>` tag:
```xml
android:usesCleartextTraffic="false"
```

Add `mobile/android/app/src/main/res/xml/network_security_config.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="false">
    <domain includeSubdomains="true">supabase.co</domain>
    <domain includeSubdomains="true">pfm.sanson1911.cloud</domain>
  </domain-config>
</network-security-config>
```

Reference it in the manifest:
```xml
android:networkSecurityConfig="@xml/network_security_config"
```

---

### P2.6 — Fix race condition in recurring payment recording
**File:** `webapp/src/actions/recurring-templates.ts:516`

Transaction inserts and balance updates happen in a loop with no DB transaction.
If the request fails mid-loop, balances become inconsistent.

Move the logic into a Supabase RPC function that wraps both operations in a
single `BEGIN/COMMIT`. This requires a new migration with the stored procedure
and updating the server action to call `supabase.rpc("insert_recurring_batch", {...})`.

---

## P3 — Low (within 1 month)

| # | Issue | File | Fix |
|---|-------|------|-----|
| P3.1 | Missing rate limiting on API routes | `webapp/src/app/api/` | Add `upstash/ratelimit` or middleware-level rate limiting |
| P3.2 | Middleware protected-paths hardcoded | `webapp/src/lib/supabase/middleware.ts:33` | Switch to blocklist pattern or prefix matching |
| P3.3 | Console logging in mobile production | Multiple `mobile/app/` files | Add `react-native-logs` with prod filter; strip `.error()` calls or redact |
| P3.4 | Unnecessary Android permissions | `mobile/android/.../AndroidManifest.xml` | Remove `SYSTEM_ALERT_WINDOW`, `VIBRATE` from production build |
| P3.5 | No CORS config on PDF parser | `services/pdf_parser/main.py` | Add `CORSMiddleware` with allowlist of your domain only |
| P3.6 | PDF parser deps unpinned | `services/pdf_parser/pyproject.toml` | Run `pip-audit`; pin exact versions for pdfplumber, pdf2image, pytesseract |
| P3.7 | Inconsistent auth error handling | `actions/categorize.ts:20` etc. | Standardize: always return `{ success: false, error: "No autenticado" }` |
| P3.8 | Mobile: switch to EAS Secrets | `mobile/eas.json`, `mobile/.env` | `eas secret:create` for SUPABASE_URL and PUBLISHABLE_KEY; remove from `.env` |
| P3.9 | Certificate pinning on mobile | `mobile/lib/supabase.ts` | Evaluate `react-native-ssl-pinning`; pin `*.supabase.co` SHA-256 |

---

## Execution Order

```
DAY 1 (manual, no Evaristo)
  ├── Rotate ANON_KEY in Supabase dashboard
  ├── Generate new publishable + secret keys
  ├── Add mobile/.env to .gitignore
  └── Update GitHub Secrets with new key names

DAY 2-3 (use Evaristo to parallelize)
  ├── P0.1  RLS migration (accounts, transactions, profiles)
  ├── P0.2  IDOR fixes across all server actions (~15 files)
  ├── P0.3  PDF parser auth (PARSER_API_KEY + file validation)
  ├── P0.4  uvicorn reload=True fix
  └── P0.5  Key rename across all files (anon → publishable)

DAY 4-7 (use Evaristo)
  ├── P1.1  Docker Compose: PARSER_API_KEY + SUPABASE_SECRET_KEY + memory limits
  ├── P1.2  CI/CD: gitleaks + pip-audit + npm audit + supabase db push
  ├── P1.3  Nginx: HSTS + CSP + rate limiting
  ├── P1.4  supabase/config.toml: password policy + email confirm + sessions
  ├── P1.5  statement_snapshots DELETE policy migration
  └── P1.6  PDF temp file: chmod 600 + explicit cleanup

WEEK 2 (use Evaristo)
  ├── P2.1  Sanitize error messages in API routes
  ├── P2.3  Mobile: deep link token validation
  ├── P2.5  Mobile: Android cleartext traffic fix
  └── P2.6  Recurring payments race condition → Supabase RPC

WEEK 3-4 (evaluate + implement)
  ├── P2.2  GDPR account deletion flow
  ├── P2.4  Mobile SQLite encryption (needs architecture decision first)
  └── P3.x  Low priority items per available time

ONGOING
  └── pip-audit + npm audit in CI blocks all deploys on high-severity vulns
```

---

## Key Gotchas for the Next Session

- **RLS migration must be applied to remote** with `npx supabase db push`, not just local.
- **ANON_KEY rotation breaks all existing sessions** — do it during low-traffic hours.
- **Supabase publishable key + SDK version**: verify `@supabase/supabase-js` is current before switching; new keys don't use `Authorization: Bearer` internally.
- **`SUPABASE_SECRET_KEY` is missing from the pdf-parser container** in the current compose files — it's passed to the VPS host but not forwarded into the container. The `storage.py` fallback to local disk is therefore always active in production.
- **Do not use `--no-verify` or `--force` on any git operations** during this migration — secret scanning hooks must run.
- After P0.1 (RLS), run a quick sanity check: log in as User A, try to fetch User B's account ID via the Supabase JS console. Should return empty results.
