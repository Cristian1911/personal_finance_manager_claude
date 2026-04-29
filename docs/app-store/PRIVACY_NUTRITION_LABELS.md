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
3. **Purpose** (pick from: App Functionality, Analytics, Product Personalization, App Functionality, Developer's Advertising/Marketing, Third-Party Advertising, Other)

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
- [x] **Photos or Videos** — receipt screenshots / PDFs uploaded for OCR import
  - Linked: Yes · Tracking: No · Purpose: App Functionality
- [x] **Audio Data** — voice transcription for quick-capture (`expo-speech-recognition`)
  - Linked: Yes · Tracking: No · Purpose: App Functionality
  - **Important:** voice is transcribed on-device by iOS Speech framework. Only the transcribed text is sent to our backend — never raw audio.
- [x] **Other User Content** — transaction notes, custom categories, destinatario tags, manual entries
  - Linked: Yes · Tracking: No · Purpose: App Functionality

### Diagnostics
- [ ] **Crash Data** — **NO** (no Sentry/Crashlytics)
- [ ] **Performance Data** — **NO**
- [ ] **Other Diagnostic Data** — **NO**

### Everything else: NOT collected
- [ ] Health & Fitness — NO
- [ ] Location — NO
- [ ] Sensitive Info (race, religion, sexual orientation, etc.) — NO
- [ ] Contacts — NO
- [ ] Browsing History — NO
- [ ] Search History — NO
- [ ] Usage Data — NO (no analytics SDK)
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
| Audio Data | ✓ | Yes | No | App Functionality |
| Other User Content | ✓ | Yes | No | App Functionality |
| (everything else) | — | — | — | — |

---

## Info.plist permission strings (verify present)

These must exist in the iOS build for the runtime permission prompts. Check `mobile/app.json` → `ios.infoPlist`:

- `NSCameraUsageDescription` — "Zeta usa la cámara para capturar recibos y extractos."
- `NSPhotoLibraryUsageDescription` — "Zeta accede a tus fotos para importar recibos y extractos."
- `NSMicrophoneUsageDescription` — "Zeta usa el micrófono para capturar transacciones por voz."
- `NSSpeechRecognitionUsageDescription` — "Zeta transcribe tu voz en el dispositivo para registrar transacciones rápidamente."
- `NSFaceIDUsageDescription` — "Zeta usa Face ID para proteger el acceso a tus finanzas." (if `expo-local-authentication` is wired up)

Reviewer rejects builds whose permission strings are missing or generic ("This app needs camera access"). Make them specific to Zeta's use case in Spanish.

---

## After saving in ASC

The privacy labels become part of every future version automatically. You only need to revisit if:
- A new SDK is added (Sentry, analytics, etc.) → re-audit
- A new data type is collected (location, contacts, health) → update before submit
- Tracking starts being used (you'd need ATT prompt + SKAdNetwork) → big policy change
