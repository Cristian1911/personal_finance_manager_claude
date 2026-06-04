# App Privacy — Nutrition Labels (App Store Connect)

Fill these out at: **App Store Connect → Zeta → App Privacy → Get Started / Edit**.

The questionnaire has 4 sections. Answer them in order.

---

## 1. Privacy Policy URL

Required before anything else. Must be publicly reachable.

- **URL:** `https://pfm.sanson1911.cloud/privacy` (or wherever the live policy lives — verify before submitting)

---

## 2. Data Collection — "Do you or your third-party partners collect data from this app?"

**Answer: Yes**

Reason: we collect email, financial data, and user-generated content. Supabase (our backend) is a third-party processor.

---

## 3. Data Types Collected

For each type below, ASC asks 3 sub-questions:
1. **Linked to user?** (yes — all data is tied to the Supabase `user_id`)
2. **Used for tracking?** (no — we never share data with third parties for advertising or cross-app tracking)
3. **Purpose** (pick from: App Functionality, Analytics, Product Personalization, Developer's Advertising/Marketing, Third-Party Advertising, Other)

For Zeta, the answer is uniformly: **Linked = Yes, Tracking = No, Purpose = App Functionality**.

### Contact Info
- [x] **Email Address** — used for authentication (Supabase Auth)
  - Linked: Yes · Tracking: No · Purpose: App Functionality

### Financial Info
- [x] **Other Financial Info** — transaction amounts, account balances, debt, budgets
  - Linked: Yes · Tracking: No · Purpose: App Functionality
- [ ] Payment Info — **NO** (we don't process payments)
- [ ] Credit Info — **NO** (we don't run credit checks)

> Note: Apple considers bank account numbers / card last-4 sensitive. Zeta stores card last-4 from PDFs as account metadata. This still falls under "Other Financial Info" — we never store full PANs.

### Identifiers
- [x] **User ID** — Supabase auth UUID
  - Linked: Yes · Tracking: No · Purpose: App Functionality
- [ ] Device ID — **NO** (no IDFA, no device fingerprint)

### User Content
- [x] **Photos or Videos** — receipt/statement photos uploaded for OCR import
  - Linked: Yes · Tracking: No · Purpose: App Functionality
  - **Confirmed transmitted off-device:** the capture flow uploads the image via
    `FileSystem.uploadAsync(\`${API_URL}/api/parse-image\`, …)` (`mobile/app/capture-screenshot.tsx:151-162`).
- [ ] **Audio Data** — **NO** (do NOT declare — over-declaration)
  - Voice quick-capture transcribes **on-device** (`requiresOnDeviceRecognition: true`,
    `mobile/app/capture-voice.tsx:214-222`) and persists only the transcribed text
    (`capture_input_text`, `capture-voice.tsx:270`). Raw audio never leaves the device, so under
    Apple's definition Audio Data is **not collected**. (The mic permission is still requested for
    the local recognizer — that is a permission, not a collected data type.)
  - **✅ Resolved (2026-06-04):** the `AudioData` entry was removed from `mobile/app.json`'s iOS
    `privacyManifests.NSPrivacyCollectedDataTypes`; the manifest now lists Precise/Coarse Location
    instead. No further app.json action needed for audio.
- [x] **Other User Content** — transaction notes, custom categories, destinatario tags, manual entries
  - Linked: Yes · Tracking: No · Purpose: App Functionality

### Location
- [x] **Coarse Location** — opt-in location tagging of transactions (off by default)
  - Linked: Yes · Tracking: No · Purpose: App Functionality
- [x] **Precise Location** — one-shot precise fix taken right before saving a transaction
  - Linked: Yes · Tracking: No · Purpose: App Functionality
  - **Opt-in / off by default:** toggled in Settings (`mobile/app/settings.tsx:834-844`);
    background task uses `Accuracy.Balanced` significant-change monitoring (`tracker.ts:17-35`),
    with a one-shot `getCurrentPositionAsync` sample before each save (`tracker.ts:52-63`).
    iOS background mode is declared (`UIBackgroundModes: ["location"]`).

### Usage Data
- [x] **Product Interaction** — first-party funnel analytics (`product_events` table)
  - Linked: Yes · Tracking: No · Purpose: Analytics
  - Mobile logs anonymous-in-content interaction events (e.g. `app_opened`, `import_completed`,
    onboarding/capture/categorize steps) via `trackProductEvent`
    (`mobile/lib/analytics/product-events.ts`), inserted into the user-scoped, RLS-gated
    `product_events` Supabase table. No third-party analytics SDK, no IDFA, no cross-app/site
    tracking — data stays in the user's own backend, so **Tracking: No**.

### Diagnostics
- [ ] **Crash Data** — **NO** (no Sentry/Crashlytics)
- [ ] **Performance Data** — **NO**
- [ ] **Other Diagnostic Data** — **NO**

### Everything else: NOT collected
- [ ] Health & Fitness — NO
- [ ] Audio Data — NO (on-device transcription only — see User Content above)
- [ ] Sensitive Info (race, religion, sexual orientation, etc.) — NO
- [ ] Contacts — NO
- [ ] Browsing History — NO
- [ ] Search History — NO
- [x] Usage Data — **YES** (Product Interaction — first-party analytics; see "Usage Data" above)
- [ ] Purchases — NO
- [ ] Surroundings — NO
- [ ] Body Data — NO

---

## 4. Tracking — "Do you use data for tracking purposes?"

**Answer: No**

Apple's definition of "tracking": linking user/device data with data from other companies' apps/websites for advertising, or sharing with data brokers. Zeta does neither.

This means the **App Tracking Transparency (ATT) prompt is NOT required**. Do not add `NSUserTrackingUsageDescription` to `Info.plist` or call `requestTrackingAuthorizationAsync`.

---

## Quick reference table for the ASC form

| Data Type | Collected | Linked to User | Used for Tracking | Purpose |
|---|---|---|---|---|
| Email Address | ✓ | Yes | No | App Functionality |
| Other Financial Info | ✓ | Yes | No | App Functionality |
| User ID | ✓ | Yes | No | App Functionality |
| Photos or Videos | ✓ | Yes | No | App Functionality |
| Coarse Location | ✓ | Yes | No | App Functionality |
| Precise Location | ✓ | Yes | No | App Functionality |
| Other User Content | ✓ | Yes | No | App Functionality |
| Audio Data | — (on-device only) | — | — | — |
| (everything else) | — | — | — | — |

---

## ⚠️ Divergence vs. `mobile/app.json` iOS privacy manifest (reconcile before submit)

The `ios.privacyManifests.NSPrivacyCollectedDataTypes` array in `mobile/app.json` must match
this doc. Two fixes are required there (app.json edits are out of scope for this doc task —
listed here + in Action items):

1. **MISSING — add Location.** The manifest currently lists EmailAddress, UserID,
   OtherFinancialInfo, OtherUserContent, PhotosOrVideos, AudioData — but **no Location entry**.
   Add a `NSPrivacyCollectedDataType` for location
   (`NSPrivacyCollectedDataTypeLocation` / coarse + precise) with `Linked=true`, `Tracking=false`,
   purpose `AppFunctionality`, to match the declared `NSLocation*UsageDescription` strings,
   `UIBackgroundModes: ["location"]`, and the collected-types declared above.
2. **OVER-DECLARED — remove AudioData.** `AudioData` is listed in the manifest but audio is
   transcribed on-device and never transmitted (see User Content). Recommend **removing** it so
   the manifest, this ASC label set, and the actual data flow stay consistent.

---

## Info.plist permission strings (verify present)

These must exist in the iOS build for the runtime permission prompts. They live in two places in `mobile/app.json`:

**Direct in `ios.infoPlist`:**
- `NSCameraUsageDescription` — "Zeta usa la cámara para capturar recibos y extractos."
- `NSPhotoLibraryUsageDescription` — "Zeta accede a tus fotos para importar recibos y extractos."
- `NSFaceIDUsageDescription` — "Zeta usa Face ID para proteger el acceso a tus finanzas."

**Auto-injected by Expo plugins (under `plugins`):**
- `expo-image-picker` — supplies `NSCameraUsageDescription` + `NSPhotoLibraryUsageDescription` if not set elsewhere.
- `expo-speech-recognition` → `microphonePermission` + `speechRecognitionPermission` props. The plugin generates `NSMicrophoneUsageDescription` and `NSSpeechRecognitionUsageDescription` at prebuild time — do **not** duplicate them in `ios.infoPlist`.
- `expo-local-authentication` → `faceIDPermission` prop generates `NSFaceIDUsageDescription`.

Reviewer rejects builds whose permission strings are missing or generic ("This app needs camera access"). Make them specific to Zeta's use case in Spanish.

---

## After saving in ASC

The privacy labels become part of every future version automatically. You only need to revisit if:
- A new SDK is added (Sentry, analytics, etc.) → re-audit
- A new data type is collected (contacts, health, etc.) → update before submit
- Tracking starts being used (you'd need ATT prompt + SKAdNetwork) → big policy change

**✅ Resolved (2026-06-04):** `mobile/app.json`'s iOS privacy manifest is reconciled — Precise +
Coarse Location added, AudioData removed. Remember to also declare **Usage Data → Product
Interaction** (Analytics, Linked, no Tracking) in ASC for the first-party `product_events` funnel.
