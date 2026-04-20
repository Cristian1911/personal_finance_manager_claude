# Google Play — Data Safety Declaration

Pre-filled answers to copy into the Play Console Data Safety form for Zeta.
Review before submission. Values reflect actual data practices as of 2026-04-20.

## Data collection

### Personal info

| Data type | Collected | Required/Optional | Shared | Purpose |
|---|---|---|---|---|
| Email address | Yes | Required | No | App functionality, account management |
| User IDs | Yes | Required | No | App functionality (internal UUID) |
| Name | No | — | — | — |
| Phone number | No | — | — | — |
| Address | No | — | — | — |
| Race/ethnicity | No | — | — | — |
| Political/religious beliefs | No | — | — | — |
| Sexual orientation | No | — | — | — |

### Financial info

| Data type | Collected | Required/Optional | Shared | Purpose |
|---|---|---|---|---|
| User payment info | No | — | — | — |
| Purchase history | No | — | — | — |
| Credit score | No | — | — | — |
| Other financial info | Yes | Required | No | App functionality (transactions, balances, budgets entered by user) |

### Files and docs

| Data type | Collected | Required/Optional | Shared | Purpose |
|---|---|---|---|---|
| Files and docs | Yes | Optional | No | App functionality (bank statement PDF uploads for import) |

### App activity

| Data type | Collected | Required/Optional | Shared | Purpose |
|---|---|---|---|---|
| App interactions | Yes | Required | No | Analytics, app functionality (diagnostics) |
| Other user-generated content | Yes | Optional | No | App functionality (tags, notes, categories) |
| In-app search history | No | — | — | — |
| Installed apps | No | — | — | — |

### App info and performance

| Data type | Collected | Required/Optional | Shared | Purpose |
|---|---|---|---|---|
| Crash logs | Yes | Required | No | App functionality (error diagnosis) |
| Diagnostics | Yes | Required | No | Analytics (app performance) |

### Not collected

- Health and fitness
- Messages
- Photos and videos (no camera / photo library access)
- Audio files
- Calendar
- Contacts
- Web browsing history
- Device or other IDs (no advertising ID, no cross-app tracking)
- Location

## Data sharing

**We do not share any collected data with third parties.** No SDKs, no analytics vendors, no ad networks. The only external services that touch user data are:
- Supabase (hosted PostgreSQL + Auth) — processor, under DPA, sa-east-1 region
- Resend (transactional email for account verification / password reset) — processor
- frankfurter.app (public exchange rates, no user data sent)

These are processors, not recipients. All user data stays within Zeta's infrastructure.

## Security practices

| Practice | Applies | Notes |
|---|---|---|
| Data encrypted in transit | Yes | HTTPS/TLS 1.2+ for all client↔server communication |
| Data encrypted at rest | Yes | Envelope encryption on 9 PII tables (`profiles`, `accounts`, `transactions`, `recipients`, `recurring_templates`, `categories` user-owned rows, `tags`, `pdf_passwords`, `email_ingest_addresses`) — per-user keys, unreadable without the user's session |
| Users can request data deletion | Yes | In-app deletion path in Settings + email `privacy@zeta.app` |
| Independent security review | No | — |
| Follows Play Families Policy | N/A | App is 18+, not directed at children |

## Additional declarations required for finance apps

- **Financial Services category** — selected at app setup
- **Countries of operation** — Colombia (initial launch); expand list before adding markets
- **Licensing** — Zeta is not a regulated financial institution; no bank license required (app is a personal expense-tracker, not payment processor)
- **In-app disclosure** — "Zeta no es un asesor financiero" surfaced in Settings footer + Terms of Service

## Privacy Policy URL

**Current:** `https://pfm.sanson1911.cloud/privacy`
**Target:** will move to rebrand domain before production submission. Update Play Console at that time (non-breaking, just re-review of listing).

## Changelog

- 2026-04-20 — Initial draft based on `PrivacyInfo.xcprivacy` + BACKLOG.md compliance audit.
