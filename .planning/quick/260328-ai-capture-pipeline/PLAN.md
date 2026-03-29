# AI Capture Pipeline — Planning Document

**Created:** 2026-03-28
**Status:** Phase 1 complete, Phases 2-5 pending GSD planning
**Context:** Research from `/last30days` on AI financial transaction capture

## Completed: Phase 1 — Voice Capture (Web Speech API)

Built and merged:
- `useVoiceCapture` hook (`webapp/src/hooks/use-voice-capture.ts`) — wraps Web Speech API with es-CO locale
- `VoiceCaptureSheet` component (`webapp/src/components/mobile/voice-capture-sheet.tsx`) — full flow: mic → speech → parseQuickCaptureText → preview → confirm → createTransaction
- Web Speech API type declarations (`webapp/src/types/speech-recognition.d.ts`)
- FAB menu updated with "Captura por voz" action (prominent, brass-accented button)
- Mobile sheet provider wired to show VoiceCaptureSheet on "voice" action
- **Cost:** $0 — uses device-native speech recognition
- **Compatibility:** Chrome, Edge, Safari. Firefox falls back to text input.

## Pending: Phase 2 — Universal Capture Endpoint (`/api/capture`)

**Goal:** Single API endpoint that accepts text/image/audio from any external source.

### What to build
1. **`POST /api/capture` route** in `webapp/src/app/api/capture/route.ts`
   - Auth: scoped capture tokens (not full Bearer JWTs)
   - Input: `{ type: "text" | "image" | "audio", content: string, source: string }`
   - Text → `parseQuickCaptureText()` → `createTransaction()` if confidence > 0.7
   - Returns structured response with confirmation or missing fields
2. **Capture token system**
   - New table: `capture_tokens` (user_id, token, default_account_id, created_at, revoked_at)
   - Migration: `supabase migration new create_capture_tokens`
   - Settings UI: generate/revoke tokens, set default account
3. **Rate limiting** — 60 req/min per token to prevent abuse

### Dependencies
- None — uses existing `parseQuickCaptureText`, `autoCategorize`, `createTransaction`

### Cost: $0

### Estimated effort: 1-2 days

---

## Pending: Phase 3 — Telegram Bot Adapter

**Goal:** Free messaging bot for quick expense capture from Telegram.

### What to build
1. **Telegram bot** via BotFather — register @ZetaFinBot (or similar)
2. **Webhook handler** — can be:
   - A Next.js API route (`/api/webhooks/telegram`) that proxies to `/api/capture`
   - Or an n8n workflow on the VPS
3. **Account linking flow**
   - User sends `/start` → bot replies with link to Zeta settings
   - User generates capture token → pastes into Telegram → linked
4. **Message handling**
   - Text: "15k café" → parse → create → reply with confirmation
   - Photo: future (Phase 4 receipt OCR)
   - Commands: `/gasto`, `/ingreso`, `/balance`, `/undo`
5. **Reply format:**
   ```
   ✓ Registrado: $15,000 · Gasto · café
   Cuenta: Bancolombia ****4398
   ```

### Dependencies
- Phase 2 (`/api/capture` endpoint)
- Telegram Bot API (free, no message limits)

### Cost: $0

### Estimated effort: 1 day

---

## Pending: Phase 4 — Receipt OCR Pipeline

**Goal:** Take a photo of a receipt → extract merchant, amount, date → create transaction.

### What to build
1. **New parser module:** `services/pdf_parser/parsers/receipt_ocr.py`
   - Input: image file (JPEG/PNG/WEBP)
   - Process: pytesseract OCR (Spanish, `--psm 6` for block text) → regex extraction
   - Colombian receipt patterns:
     - Total: `TOTAL\s*\$?\s*([\d.,]+)`
     - Date: various DD/MM/YYYY patterns
     - Merchant: first non-empty lines (store name, NIT)
     - Tax (IVA): `IVA\s*\$?\s*([\d.,]+)`
   - Output: `ReceiptParseResponse(merchant_name, total, date, currency, items, raw_text, confidence)`

2. **New FastAPI endpoint:** `POST /parse-receipt` in `services/pdf_parser/main.py`
   - Auth: X-Parser-Key (same as existing)
   - Input: FormData with image file
   - Calls `parse_receipt()` from receipt_ocr module
   - Returns structured receipt data

3. **New webapp proxy:** `POST /api/parse-receipt` in `webapp/src/app/api/parse-receipt/route.ts`
   - Same pattern as `/api/parse-statement`
   - Auth: Bearer/cookie
   - Max file: 10MB
   - Timeout: 30s

4. **Camera capture UI**
   - New "Foto de recibo" option in FAB menu
   - Uses `<input type="file" accept="image/*" capture="environment">`
   - Upload → OCR → preview → confirm → createTransaction

5. **Supabase storage bucket** for receipt images (optional, for reference)
   - `receipt-images` bucket (private, user-scoped RLS)

### Dependencies
- pytesseract + tesseract-ocr-spa (already in Docker image)
- No new Python deps needed

### Cost: $0 (pytesseract is local, no API calls)

### Estimated effort: 3 days

### Key decision needed
- Store receipt images permanently? (storage cost vs. reference value)
- Fallback to LLM extraction for non-standard receipts? (Claude Haiku ~$0.001/receipt)

---

## Pending: Phase 5 — WhatsApp Adapter

**Goal:** Capture expenses via WhatsApp (highest adoption in Colombia).

### Options to evaluate

**Option A: n8n workflow (recommended start)**
- Self-hosted n8n on VPS (Docker, $0)
- WhatsApp Business Cloud API ($0.05/conversation)
- Flow: WhatsApp message → n8n webhook → POST /api/capture → reply
- Pros: visual workflow, easy to modify, no code
- Cons: n8n maintenance, one more Docker container

**Option B: Direct WhatsApp Cloud API**
- Webhook directly to `/api/webhooks/whatsapp`
- Requires Meta Business verification
- More control, less moving parts
- Pros: no n8n dependency
- Cons: more code, Meta verification process

### What to build
1. **WhatsApp Business account** — Meta Business verification
2. **Webhook handler** — either n8n or direct API route
3. **Message types:**
   - Text: same as Telegram → parseQuickCaptureText
   - Photo: forward to `/parse-receipt` (Phase 4)
   - Voice note: decode audio → Whisper API ($0.006/min) → parseQuickCaptureText
4. **Reply templates** — WhatsApp requires pre-approved templates for outbound

### Dependencies
- Phase 2 (`/api/capture` endpoint)
- Phase 4 (receipt OCR for photo messages)
- Meta Business verification (~1-2 weeks)
- WhatsApp Cloud API access

### Cost
- WhatsApp API: ~$0.05/conversation (24h window)
- Whisper API for voice notes: ~$0.006/min
- n8n self-hosted: $0

### Estimated effort: 2 days (after Meta verification)

---

## Completed: Phase 2 — Universal Capture Endpoint + Token Auth

Built and ready:
- **Migration:** `capture_tokens` table with RLS, token lookup index, default account
- **Server actions:** `getCaptureTokens()`, `createCaptureToken()`, `revokeCaptureToken()` in `webapp/src/actions/capture-tokens.ts`
- **`POST /api/capture` route** in `webapp/src/app/api/capture/route.ts`
  - Auth: `Bearer zeta_...` capture token (not Supabase JWT)
  - Input: `{ type: "text", content: "gasté 15k en café", account_id?: "uuid" }`
  - Processing: regex → Gemini Flash fallback → auto-categorize → insert transaction
  - Output: `{ status: "created", transaction: {...}, message: "..." }` or `{ status: "needs_confirmation", missing_fields: [...] }`
  - Idempotency: `CAPTURE_API` provider key prevents duplicates
  - Account verification: confirms account belongs to token owner
- **Token format:** `zeta_` + 48 hex chars (24 random bytes)
- **Still needed:** Settings UI for token management (generate/revoke/set default account)

---

## Pending: Phase 6 — Zeta MCP Server

**Goal:** Expose Zeta's financial data to any MCP-compatible AI (Claude Desktop, Claude Code, etc.)

### Architecture
```
Claude Desktop / Claude Code / any MCP client
        ↓ (MCP protocol)
Zeta MCP Server (Node.js, local process)
        ↓ (HTTPS)
POST /api/capture          — create transactions
GET  /api/mcp/summary      — financial summary
GET  /api/mcp/transactions  — filtered transactions
GET  /api/mcp/budgets       — budget status
GET  /api/mcp/debts         — debt overview
GET  /api/mcp/accounts      — account list
        ↓
Supabase (via capture token auth)
```

### MCP Tools to implement

| Tool | Description | API Route |
|---|---|---|
| `get_financial_summary` | Balances, available to spend, freshness, budget pulse | `GET /api/mcp/summary` |
| `get_transactions` | Filter by date, account, category, direction, search | `GET /api/mcp/transactions` |
| `get_budget_status` | 50/30/20 allocation, per-category spending vs limits | `GET /api/mcp/budgets` |
| `get_debt_overview` | Debts, rates, payoff timeline, debt-free date | `GET /api/mcp/debts` |
| `get_upcoming_payments` | Pending recurring obligations | `GET /api/mcp/upcoming` |
| `get_accounts` | All accounts with balances, currencies, types | `GET /api/mcp/accounts` |
| `create_transaction` | Quick capture via text | `POST /api/capture` (already built) |
| `evaluate_purchase` | Can I afford X? Uses purchase-decision logic | `POST /api/mcp/evaluate-purchase` |

### MCP Server package structure
```
packages/mcp-server/
├── package.json
├── src/
│   ├── index.ts          — MCP server entry point
│   ├── tools.ts          — tool definitions + handlers
│   ├── api-client.ts     — fetch wrapper for Zeta API
│   └── types.ts          — shared types
└── README.md             — setup instructions
```

### User setup
1. Generate capture token in Zeta Settings
2. Install MCP server:
   ```json
   // claude_desktop_config.json
   {
     "mcpServers": {
       "zeta": {
         "command": "npx",
         "args": ["@zeta/mcp-server"],
         "env": {
           "ZETA_API_URL": "https://zeta.example.com",
           "ZETA_CAPTURE_TOKEN": "zeta_abc123..."
         }
       }
     }
   }
   ```
3. Done — Claude can now query financial data

### What to build (API side)
1. **Read-only API routes** (`/api/mcp/*`) — same capture token auth
2. **MCP server package** — `packages/mcp-server/` using `@modelcontextprotocol/sdk`
3. **Settings UI** — token management + MCP setup instructions

### Dependencies
- Phase 2 (`/api/capture` + token system) — ✅ DONE
- `@modelcontextprotocol/sdk` package
- Read-only API routes for financial data

### Cost: $0 (MCP server runs locally on user's machine)

### Estimated effort: 3-4 days

### Key example interactions

**User in Claude Desktop:** "¿Cuánto he gastado en restaurantes este mes?"
```
Claude → get_transactions(category: "food", date_from: "2026-03-01")
Zeta API → returns transactions
Claude: "Este mes llevas $340,000 en restaurantes (12 transacciones).
         Tu presupuesto de alimentación es $500,000, te quedan $160,000."
```

**User:** "¿Me puedo comprar unos AirPods de 800k?"
```
Claude → evaluate_purchase(amount: 800000)
Claude → get_financial_summary()
Zeta API → returns summary + purchase evaluation
Claude: "Tu margen libre es $1.2M. Los AirPods son el 67% de tu margen
         libre después de pagos pendientes. Es viable pero te deja ajustado.
         Sugiero esperar al próximo ingreso el día 30."
```

**User:** "Registra que almorcé por 25 mil"
```
Claude → create_transaction(content: "almuerzo 25 mil")
Zeta API → creates transaction, returns confirmation
Claude: "Listo, registré $25,000 · Almuerzo en tu cuenta Bancolombia."
```

---

## Implementation Order

```
Phase 1 ✅  Voice Capture (Web Speech API)        — DONE
Phase 2 ✅  /api/capture + token auth              — DONE
Phase 3     Telegram bot adapter                   — Free, fast to test
Phase 4     Receipt OCR pipeline                   — Photo capture
Phase 5     WhatsApp adapter                       — Highest Colombian adoption
Phase 6     Zeta MCP server                        — AI-powered financial assistant
```

Phase 3 is the next quick win (1 day, $0).
Phase 6 (MCP) needs the read-only API routes first, then the MCP package.
Phase 4 is independent and can be parallelized with anything.
Phase 5 requires Meta verification lead time — start the application early.

## Research Sources

Based on `/last30days` research (2026-03-28):
- TaxHacker (2,478 likes @aiwithjainam) — open-source self-hosted receipt OCR
- Finly (@RaffaySajjad) — voice + receipt scan, $59.99 lifetime
- VaultAudit AI (@damiengold01) — offline receipt OCR, no bank link
- n8n receipt pipeline (@suburbancyber) — $29 template, email → AI → expense log
- whisper.cpp + Tauri (@MatSilverstein, 493 likes) — local Whisper for audio
- `parseQuickCaptureText()` already handles Colombian Spanish expense parsing
