# Google Play — Data Safety Declaration

Pre-filled answers to copy into the Play Console Data Safety form for Zeta.
Review before submission. Values reflect actual data practices as of 2026-05-30,
verified against the live mobile code (`mobile/app/*`, `mobile/lib/services/location/*`).

> **Reminder:** In Google's Data Safety form, "collected" means **transmitted off the device**.
> Data processed only on-device (e.g. voice transcription) is **not** "collected".

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

### Photos and videos

| Data type | Collected | Required/Optional | Shared | Purpose |
|---|---|---|---|---|
| Photos and videos | Yes | Optional | No | App functionality (receipt/statement photos sent to OCR parser for transaction extraction) |

> **Why collected (transmitted off-device):** The screenshot/photo capture flow uploads
> the chosen image to the backend OCR endpoint via multipart POST —
> `FileSystem.uploadAsync(\`${API_URL}/api/parse-image\`, imageUri, …)`
> (`mobile/app/capture-screenshot.tsx:151-162`). Because the image leaves the device,
> Photos/videos **is** collected. Camera + photo-library access are the *capture sources*
> for this upload (`pickFromCamera`/`pickFromGallery`, `mobile/app/capture-screenshot.tsx:93-131`).
> The bug-report annotation canvas (`mobile/app/annotate-screenshot.tsx`) writes only to the
> local cache dir and does not itself upload, so it does not add a separate collected type.

### Location

| Data type | Collected | Required/Optional | Shared | Purpose |
|---|---|---|---|---|
| Approximate location | Yes | Optional | No | App functionality (tag transactions with where they happened) |
| Precise location | Yes | Optional | No | App functionality (one-shot precise fix taken right before saving a transaction) |

> **OPT-IN / OFF BY DEFAULT.** Location collection is fully opt-in via the
> "Guardar ubicación con cada movimiento" toggle in Settings → Privacidad y soporte
> (`mobile/app/settings.tsx:834-844`), which is **off by default**
> (`location_tracking_enabled` defaults to 0). When enabled, the app requests foreground
> then background permission (`requestLocationPermissions()`,
> `mobile/lib/services/location/permissions.ts:15-23`) and starts a background task using
> `Accuracy.Balanced` significant-change monitoring (~100 m, cell/wifi triangulation, not GPS)
> (`mobile/lib/services/location/tracker.ts:17-35`). A one-shot `getCurrentPositionAsync`
> sample is captured right before a transaction is saved (`tracker.ts:52-63`) — this can be
> precise, hence both Approximate and Precise are declared. Background access requires the
> separate **prominent-disclosure dialog + Play Console background-location declaration form + demo video**
> (see "Action items" below).

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
- Audio / Audio files / Voice or sound recordings — **NOT collected.** Voice quick-capture
  uses `expo-speech-recognition` with `requiresOnDeviceRecognition: true`
  (`mobile/app/capture-voice.tsx:214-222`), which forces iOS to transcribe locally and never
  routes raw audio to Apple servers. Only the transcribed **text** is persisted
  (`capture_input_text: finalTranscript`, `mobile/app/capture-voice.tsx:270`). No raw audio
  leaves the device, so per Google's definition Audio is **not collected**. (Mic permission is
  still requested for the on-device recognizer, but a requested permission ≠ a collected data type.)
- Calendar
- Contacts
- Web browsing history
- Device or other IDs (no advertising ID, no cross-app tracking)

> Photos/videos and Location moved OUT of "not collected" on 2026-05-30 — see their
> dedicated collected sections above (image upload to OCR; opt-in location tagging).

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
| Users can request data deletion | Yes | In-app deletion path in Settings + email `giraldo.0302@gmail.com` |
| Independent security review | No | — |
| Follows Play Families Policy | N/A | App is 18+, not directed at children |

## Additional declarations required for finance apps

- **Financial Services category** — selected at app setup
- **Countries of operation** — Colombia (initial launch); expand list before adding markets
- **Licensing** — Zeta is not a regulated financial institution; no bank license required (app is a personal expense-tracker, not payment processor)
- **In-app disclosure** — "Zeta no es un asesor financiero" surfaced in Settings footer + Terms of Service

## Privacy Policy URL

**Current (v1):** `https://pfm.sanson1911.cloud/privacy` — kept for v1 closed test. No domain change planned before this submission.

## Action items (NOT doc work — required before/at submission)

These are gated by code and Play Console operator tasks, not by this file:

1. **Background-location prominent disclosure (CODE — blocking for Play approval).**
   Google requires an explicit in-app disclosure dialog — shown *before* the OS permission
   prompt — that states background collection happens and links to the privacy policy, with the
   user affirmatively accepting. Today `handleToggleLocation` calls `requestLocationPermissions()`
   directly (`mobile/app/settings.tsx:427`), which immediately invokes
   `requestBackgroundPermissionsAsync()` (`mobile/lib/services/location/permissions.ts:19`). The
   settings toggle label + helper text (`settings.tsx:836,840-844`) describe the behavior but do
   **not** satisfy the requirement (a label is not a disclosure the user accepts). **Add a modal/Alert
   before `requestLocationPermissions()` is called** that explains background collection and links
   to `https://pfm.sanson1911.cloud/privacy`; only proceed to the OS prompt on explicit "Aceptar".
2. **Play Console background-location declaration form (OPERATOR).** Submit the in-console
   "Permissions declaration" for `ACCESS_BACKGROUND_LOCATION`, justifying the foreground-feature
   tie (tagging transactions with location) and core-functionality rationale.
3. **Background-location demo video (OPERATOR).** Record a short video showing the prominent
   disclosure → permission grant → feature use, and attach it to the declaration. Required for
   review of any app requesting background location.

## Changelog

- 2026-05-30 — Reconciled to live mobile code: moved Photos/videos + Location (approximate +
  precise) into collected sections (image OCR upload to `/api/parse-image`; opt-in location
  tagging, off by default); kept Audio as NOT collected (on-device transcription only, text-only
  persistence); fixed deletion-contact email to `giraldo.0302@gmail.com`; locked v1 privacy-policy
  domain; added background-location action items (prominent disclosure, declaration form, demo video).
- 2026-04-20 — Initial draft based on `PrivacyInfo.xcprivacy` + BACKLOG.md compliance audit.
