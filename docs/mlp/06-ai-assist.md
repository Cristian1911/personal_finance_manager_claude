# Optional AI assist — where a small typed classifier earns its place (2026-09-26)

## Rule: AI proposes, deterministic code decides
- A small, fast model returns **typed output only** (JSON schema → validated with Zod in `@zeta/shared`). Invalid output means the call is discarded and the deterministic path wins.
- It never writes money data on its own. Its output is either (a) a **suggestion the user confirms** or (b) a **draft of a deterministic rule/template** that is then reviewed and executes without AI.
- Priority is always: user rule > verified shared dictionary > AI suggestion > nothing.
- Optional: a single toggle in Ajustes ("Ayudas inteligentes"), plus per-feature kill switches server-side. The UI never says "IA"; it just shows a suggestion chip.
- Every AI output is logged with `source = AI_SUGGESTION`, and we track the acceptance rate per feature. A feature whose acceptance falls below ~70% gets turned off.

## Where it's genuinely useful (ranked)

### 1. Merchant normalization — shared, cached, the biggest win
The problem isn't categorizing, it's that one merchant has many raw names: `MERCADOPAGO*FALABELLA`, `PAYU*RAPPI`, `DLO*UBER`, `CLARO COLOMBIA S A E S P`.
- Input: one raw descriptor string. Output: `{ canonical_merchant, kind: business | person | own_transfer | bank_fee | tax | cash, suggested_category (from a fixed global taxonomy), confidence }`.
- **Cached globally by descriptor.** Merchant descriptors aren't personal, so each unique string is classified once for all users and stored in a shared dictionary. The cost is per new descriptor, not per transaction.
- It feeds the existing destinatario rules deterministically: the canonical merchant becomes (or matches) a destinatario, and category comes from the merchant default. New users get good first-day categorization without training.
- **Privacy guard:** descriptors that look like person transfers ("TRANSFERENCIA A …", Nequi/Daviplata to a name) are detected deterministically and never sent.

### 2. Manual capture by text or voice
- Voice → text uses the **phone's own speech recognition** (already built: `expo-speech-recognition` in `mobile/app/capture-voice.tsx`). It costs us nothing; no Whisper.
- Text → typed transaction: the deterministic parser runs first (`parseQuickCaptureText` in `@zeta/shared`, extended with Colombian money slang: "45 lucas", "2 palos", "mil", "barras"). AI is the fallback only when fields stay empty.
- Output schema: `{ amount, direction, merchant?, category_id (enum of the user's categories), date ("ayer" → ISO), account_id? (enum), split?: { people: string[], my_share } , trip? }`.
- Example: *"almuerzo con Juan, 45 mil, pagué yo y me debe la mitad"* → Almuerzo · −$45.000 · Restaurantes · tu parte $22.500 · Juan te debe $22.500. It's shown as a pre-filled form; one tap to save.
- This is where AI categorization works well, because the text is the user's own words, not a bank's truncated descriptor.

### 3. Drafting notification/email templates (not parsing live data)
- When a notification from a chosen bank app matches no template, AI proposes the slot marking (which span is the amount, merchant, card, direction). The training card arrives **pre-filled**, and the user confirms with one tap instead of tapping each part.
- The confirmed result is a **deterministic template**. AI never parses live transactions.
- Send the *shape*, not the data: digits are masked (`$<NUM>`, `*<CARD4>`) before the call.
- Same pattern server-side for the template pack when a bank changes wording, and for the backlog of **95 unrecognized emails** already in production: AI drafts the parser pattern, a human approves it.

### 4. Weak-duplicate tie-breaker (only if the data says so)
- Idempotency keys stay deterministic; AI must never compute them. Exact duplicates are already handled.
- The only gap is *weak matches* (same amount ±days, different descriptor strings) that become Revisar cards. AI could answer `{ same_transaction: bool, confidence }` to pre-select the answer on the card, but it still asks.
- **Measure first:** count weak-match cards per user per week. Build only if it's more than ~2/week. Merchant normalization (#1) will already fix most of them, because both descriptors map to the same canonical merchant.

## Where it should NOT be used
- Computing idempotency keys, Disponible, verdicts, balances or bill matching. These must be exact and explainable.
- Directly categorizing bank transactions without the dictionary layer (the descriptor-naming problem you described).
- Writing the weekly digest or pushes. Rule-based text is predictable and free.
- Anything that sends a person's name, full notification text or statement contents to a model.

## Keeping it cheap
- Server calls go to a small model (e.g. Claude Haiku 4.5) with structured output, from backend routes only (no API key on the phone). Check current pricing before building.
- Global descriptor cache (#1) means volume grows with *unique merchants*, not with transactions.
- Manual capture (#2) happens only on the ~9% of transactions users type or say, and only when the deterministic parser can't fill the fields.
- Later: on-device models with typed output (Apple Foundation Models with guided generation on iOS; Gemini Nano via ML Kit on recent Android) for #2. They're free and private, but only on recent high-end phones, so the server model stays as the fallback.

## MLP cut
- **v1:** #2 (voice/text capture with on-device speech + deterministic parser + AI fallback) and #1 (merchant normalization, shared cache).
- **v1.1:** #3 (template drafting in the training card; server-side assistance for the template pack and unrecognized emails).
- **Only if measured:** #4.
