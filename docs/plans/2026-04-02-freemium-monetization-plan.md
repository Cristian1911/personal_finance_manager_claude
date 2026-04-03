# Freemium Monetization Plan — Zeta

**Date:** 2026-04-02
**Status:** Draft
**Philosophy:** Everything free up to a point. Limits feel natural, not punitive. Users upgrade because they *outgrow* the free tier, not because features are hidden behind a wall.

---

## 1. Guiding Principles

1. **No feature gates** — Every feature is accessible on the free tier. Limits are on *volume*, not *capability*.
2. **Generous free tier** — A casual user tracking 1-2 accounts with manual entry should never hit a wall.
3. **Upgrade triggers are organic** — The user discovers they need more because they're *using the app more*, not because we blocked something arbitrarily.
4. **No dark patterns** — No "you've used 9 of 10 imports" nag banners. Show usage clearly in settings, nudge gently.
5. **Cost-aligned limits** — Features that cost us money (API calls, storage, compute) have tighter free limits. Pure UI features are generous.

---

## 2. Tier Structure

### Free (Gratis)
*For users getting started or tracking finances casually.*

### Pro (COP $14,900/mes or ~$3.50 USD/mo)
*For users actively managing multiple accounts, importing statements, and optimizing debt.*

### Why this price?
- Colombian market: Nequi/Daviplata transfers are ~$0. Bank apps are free. Users won't pay $10+/mo for finance tracking.
- COP $14,900 = less than a coffee + snack. Psychologically "nothing."
- Annual option: COP $149,000/year (~$35 USD, ~2 months free).

---

## 3. Feature Limits by Tier

### Accounts

| Capability | Free | Pro |
|---|---|---|
| Active accounts | 3 | Unlimited |
| Account types | All types | All types |
| Multi-currency | Yes | Yes |
| Balance reconciliation | Yes | Yes |

**Why 3?** Most casual users have 1 savings + 1 credit card + 1 cash. Power users with 5+ accounts across banks are clearly engaged enough to pay.

### Transactions

| Capability | Free | Pro |
|---|---|---|
| Manual entry | Unlimited | Unlimited |
| Transaction history | 6 months | Unlimited |
| Bulk categorization | Up to 10 at once | Unlimited batch |
| Bulk tag assignment | Up to 10 at once | Unlimited batch |
| Advanced filters | Basic (date, category, account) | Full (amount range, destinatario, tags, direction, status, capture method) |
| Export (CSV) | No | Yes |

**Why unlimited manual entry?** It's the core loop. Limiting it kills engagement. History limit is the natural upgrade — when users want to see last year's spending, they've proven the app is valuable to them.

### PDF Import

| Capability | Free | Pro |
|---|---|---|
| PDF imports per month | 3 statements | Unlimited |
| Supported banks | All 14 parsers | All 14 parsers |
| Password-protected PDFs | Yes | Yes |
| Reconciliation engine | Yes | Yes |
| Statement snapshots | Latest only | Full history |

**Why 3/month?** Most people get 1-3 statements per month (savings, credit card, maybe a loan). A user importing 5+ statements is tracking multiple accounts seriously — exactly the Pro user.

**Cost justification:** PDF parsing uses compute (Python service, OCR). 3/month keeps the parser load manageable for free users.

### Email Ingestion

| Capability | Free | Pro |
|---|---|---|
| Email ingest address | Yes (1) | Yes (1) |
| Text email alerts/month | 30 | Unlimited (current cap: 100/day) |
| PDF statement via email | No | Yes |
| Auto-import toggle | No (always review) | Yes |
| Unrecognized email storage | 10 | 50 |

**Why gate auto-import?** Auto-import is the "set it and forget it" feature. Free users review each transaction (which keeps them engaged). Pro users trust the system and want hands-off operation.

**Why gate email PDF?** It's the new feature with real compute cost (storage + parser). Text alerts are lightweight. PDF parsing is not.

### Budgets

| Capability | Free | Pro |
|---|---|---|
| Budget categories | 5 | Unlimited |
| Budget modes (limit vs allocation) | Spending limit only | Both modes |
| 50/30/20 allocation view | View only | Editable allocations |
| 3-month spending averages | Yes | Yes |
| Fixed/variable breakdown | Yes | Yes |

**Why 5 categories?** Enough for Alimentacion, Transporte, Entretenimiento, Servicios, Otros. A user creating 10+ budget categories is clearly in "optimize my life" mode.

### Debt Tools

| Capability | Free | Pro |
|---|---|---|
| Debt overview dashboard | Yes | Yes |
| Credit utilization gauge | Yes | Yes |
| Monthly interest estimate | Yes | Yes |
| Debt-free countdown | Yes | Yes |
| Debt simulator | 1 saved scenario | Unlimited scenarios |
| Scenario comparison | No | Side-by-side |
| Salary timeline projection | Basic (one income) | Multi-income, raises |
| Payment impact tracking | Yes | Yes |

**Why free debt dashboard?** Debt awareness is the hook. Showing someone "you're paying $X in interest" creates urgency. The simulator is where they *act on it* — that's the upgrade moment.

### Categories & Destinatarios

| Capability | Free | Pro |
|---|---|---|
| Custom categories | 10 | Unlimited |
| Category hierarchy (parent/child) | Yes | Yes |
| Destinatario profiles | 20 | Unlimited |
| Pattern matching rules | 3 per destinatario | Unlimited |
| Merchant suggestions | Yes | Yes |
| Merchant merging | No | Yes |

**Why generous category limits?** Categories are core to the experience. 10 custom + system defaults covers most users. Destinatario rules are the automation play — 3 per merchant is enough for simple cases, power users with complex patterns upgrade.

### Dashboard & Plan

| Capability | Free | Pro |
|---|---|---|
| Dashboard widgets | All visible | All visible |
| Dashboard customization (reorder/hide) | No (default layout) | Yes |
| Plan page (financial roadmap) | Full access | Full access |
| Health meters | Yes | Yes |
| Attention hub / action items | Yes | Yes |

**Why free Plan page?** It's the "Am I on track?" answer — the app's core value. Gating it would undermine the product. Dashboard *customization* is a power-user nicety.

### Capture Methods

| Capability | Free | Pro |
|---|---|---|
| Manual entry | Yes | Yes |
| PDF import | 3/month | Unlimited |
| Email text alerts | 30/month | Unlimited |
| Email PDF statements | No | Yes |
| Voice capture | 10/month | Unlimited |
| Telegram bot | Yes | Yes |
| Capture tokens (external) | 1 | 3 |

**Why limit voice capture?** It calls the Gemini API = real cost per use. 10/month lets users try it; heavy users pay.

### Tags & Analytics

| Capability | Free | Pro |
|---|---|---|
| Tags | 5 | Unlimited |
| Tag groups | 1 | Unlimited |
| Monthly spending summary | Current month + last month | Full history |
| Category trends over time | 3 months | 12+ months |
| Net worth history | 3 months | Full history |
| Purchase decision helper | 3/month | Unlimited |

**Why limit analytics history?** Historical data is the killer retention feature. Seeing "you spent 30% less on food this year vs last year" is powerful — and only possible with history. Free users get enough to understand the value; Pro unlocks the full picture.

### Recurring Transactions

| Capability | Free | Pro |
|---|---|---|
| Recurring templates | 5 | Unlimited |
| Auto-creation from imports | Yes | Yes |
| Upcoming occurrences view | Yes | Yes |
| Payment recording | Yes | Yes |

---

## 4. What Stays Completely Free (No Limits)

These should NEVER be limited — they're either core to the experience or cost nothing:

- **Manual transaction entry** — the core loop
- **All account types** — no "savings accounts are Pro"
- **Multi-currency support** — Colombian users need USD + COP at minimum
- **Auto-categorization** — deterministic, zero cost, improves the product
- **Basic budgets** — core "am I on track?" answer
- **Debt overview** — awareness drives engagement
- **Plan page** — the app's soul
- **Health meters** — quick status check
- **Attention hub** — action items drive retention
- **Idempotency / dedup** — data integrity isn't a feature, it's a requirement

---

## 5. Upgrade Triggers (Natural Moments)

These are the moments where a free user realizes they need Pro. The UI should show a gentle, helpful message — not a paywall:

| Moment | Message (Spanish) |
|---|---|
| Adding 4th account | "Tienes 3 cuentas activas. Con Pro puedes agregar todas las que necesites." |
| 4th PDF import in a month | "Ya importaste 3 extractos este mes. Con Pro puedes importar ilimitado." |
| Viewing transactions older than 6 months | "Tu historial completo está guardado. Con Pro puedes ver todo tu historial." |
| Creating 6th budget category | "Ya tienes 5 presupuestos activos. Con Pro puedes presupuestar cada categoría." |
| Trying to export CSV | "Exporta tus datos en CSV con Pro." |
| 2nd debt scenario | "Ya tienes un escenario guardado. Con Pro puedes comparar múltiples estrategias." |
| Trying dashboard customization | "Personaliza tu dashboard con Pro." |
| 31st email alert in a month | "Procesamos 30 alertas gratis este mes. Con Pro no hay límite." |

---

## 6. Implementation Strategy

### Phase 0: Tracking (Before Building Paywall)
**Do first, before any paywall code:**

1. Add usage counters to the database:
   ```
   profiles.plan_tier TEXT DEFAULT 'free'
   profiles.plan_started_at TIMESTAMPTZ
   profiles.plan_expires_at TIMESTAMPTZ
   ```

2. Add a `user_usage_stats` materialized view or cached query:
   - Active account count
   - PDF imports this month
   - Email alerts this month
   - Voice captures this month
   - Custom category count
   - Destinatario count
   - Transaction history depth (oldest transaction date)

3. **Instrument upgrade trigger points** — log when users hit limits (even before enforcing them). This data tells you which limits matter and which are too tight/loose.

### Phase 1: Soft Limits (Awareness Only)
- Show usage in settings: "3 de 3 cuentas activas (Gratis)"
- Show gentle banners at trigger points (not blocking)
- No enforcement — everything still works
- Collect data on which triggers fire most often

### Phase 2: Payment Integration
- Stripe (supports COP) or MercadoPago (more natural for Colombian users)
- Monthly + annual billing
- Free trial: 14 days of Pro for new signups (no credit card required)

### Phase 3: Hard Limits
- Enforce limits only after payment is working
- Existing data is never deleted — if a free user had 5 accounts and we enforce 3, they can view all 5 but can't create new ones until they deactivate or upgrade
- Grandfathering: early adopters who signed up before paywall get 6 months Pro free

---

## 7. Revenue Projection (Sanity Check)

Assumptions:
- 1,000 monthly active users after 6 months
- 5% conversion to Pro (conservative for finance apps)
- COP $14,900/month

```
50 Pro users × $14,900 COP/mo = $745,000 COP/mo (~$175 USD/mo)
```

That barely covers hosting. But at 10,000 MAU with 8% conversion:
```
800 Pro users × $14,900 COP/mo = $11,920,000 COP/mo (~$2,800 USD/mo)
```

This covers infrastructure + a modest income. The real play is reaching 50K+ users through Colombian fintech communities, TikTok finance content, and word of mouth.

---

## 8. What NOT to Monetize

| Feature | Why Free |
|---|---|
| Security (2FA, encryption) | Charging for security is unethical |
| Data export (basic) | Users own their data. CSV export is Pro but they can always delete their account with a data dump |
| Bug fixes / stability | Obviously |
| Spanish localization | It's the primary language |
| Onboarding | Never gate the first experience |
| Mobile app (future) | The app itself isn't the product; the value is |

---

## 9. Competitive Context (Colombia)

| App | Price | Model |
|---|---|---|
| Fintonic (defunct in CO) | Free | Ad-supported |
| Monefy | Free / $2.99 one-time | Feature unlock |
| Wallet by BudgetBakers | Free / $5/mo | Premium features |
| Bank apps (Bancolombia, Nequi) | Free | Loss leader for banking |
| Excel / Google Sheets | Free | DIY |

Zeta's edge: **multi-bank PDF import + auto-categorization + debt simulator**. No Colombian app does this. The free tier should showcase this edge; Pro makes it frictionless.

---

## 10. Open Questions

1. **One-time purchase option?** Some users prefer paying once. Consider a "Pro de por vida" at COP $299,000 (~$70 USD). Risk: loses recurring revenue. Benefit: higher conversion for price-sensitive Colombian market.

2. **Family plan?** Shared household finances are common. COP $19,900/mo for 2 users could work later.

3. **MercadoPago vs Stripe?** MercadoPago is more familiar to Colombian users (tied to MercadoLibre). Stripe has better developer experience. Could offer both.

4. **What about ads?** Hard no for a finance app — users' financial data proximity to ads is a trust killer.

5. **Freemium or free trial first?** Start with freemium (soft limits). A free trial implies "you'll lose access" which creates anxiety. Freemium says "use what you need, pay when you're ready."
