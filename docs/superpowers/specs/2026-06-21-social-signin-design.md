# Social Sign-In (Google + Apple) — Design

**Date:** 2026-06-21
**Scope:** Add Google + Apple sign-in to mobile (native) and webapp (OAuth). Full parity.
**Related:** password-recovery fix (config-only, folded in). Credentials in memory `reference_oauth_credentials`.

## Goal

Let users sign in / sign up with Google and Apple on all platforms, alongside
existing email/password. Apple is mandatory on iOS once Google is offered
(App Store Guideline 4.8 / 5.1.1(v)).

## Mechanisms

| Platform | Apple | Google |
|---|---|---|
| iOS | native (`expo-apple-authentication`) → `signInWithIdToken` | native (`@react-native-google-signin`) → `signInWithIdToken` |
| Android | web OAuth (`signInWithOAuth` + `expo-web-browser`, deep-link back) | native → `signInWithIdToken` |
| Web | `signInWithOAuth({provider:'apple'})` → `/auth/callback` | `signInWithOAuth({provider:'google'})` → `/auth/callback` |

No backend changes. `handle_new_user()` trigger creates the encrypted profile for
any new `auth.users` row (incl. OAuth) → user lands in onboarding via existing
routing. Session pickup via existing `onAuthStateChange` (mobile) / callback route (web).

## Mobile

- **`lib/auth-social.ts`** (new): `signInWithApple()`, `signInWithGoogle()`.
  - Apple (iOS): random nonce → SHA256 (`expo-crypto`) → `AppleAuthentication.signInAsync({nonce: hashed})` → `signInWithIdToken({provider:'apple', token, nonce: raw})`. Capture full name on first sign-in.
  - Apple (Android): `signInWithOAuth({provider:'apple', redirectTo:'zeta://auth-callback', skipBrowserRedirect:true})` + `WebBrowser.openAuthSessionAsync` → parse session from returned URL.
  - Google (both): `GoogleSignin.configure({webClientId, iosClientId})` → `signIn()` → `signInWithIdToken({provider:'google', token: idToken})`.
- **`app/(auth)/login.tsx` + `signup.tsx`**: render buttons. Apple button only when `Platform.OS==='ios' && isAvailableAsync()` (else show OAuth-fallback Apple button on Android).
- **`app.json`**: add plugins `expo-apple-authentication`, `@react-native-google-signin/google-signin` (with `iosUrlScheme` = reversed iOS client ID). Native rebuild required.
- **deps**: `expo-apple-authentication`, `@react-native-google-signin/google-signin`.
- **env**: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.

## Web

- **`components/auth/oauth-buttons.tsx`** (new, client): Google + Apple buttons calling
  `supabase.auth.signInWithOAuth({provider, options:{redirectTo: `${location.origin}/auth/callback?next=/dashboard`}})`.
- Drop into `login-form.tsx` + `signup-form.tsx`. Callback route already exchanges the code.

## Password recovery fix

Root cause: `zeta://reset-password` missing from Supabase redirect allowlist → email
fell back to Site URL (webapp). **Fixed** by adding `zeta://**` to the allowlist.
Mobile `reset-password.tsx` fragment-parse is already correct. No code change; verify on a build.

## External config (done, operator-side)

- Google Cloud: Web + iOS + Android OAuth clients (consent screen External).
- Apple: Sign In capability on App ID; Services ID `com.venti5.zeta.web`; .p8 key `Y39H4A8255`.
- Supabase: Google + Apple providers enabled with client IDs/secrets; `zeta://**` allowlisted.
- ⚠️ Apple client secret JWT expires 2026-12-18 — regen per memory note.

## Account linking

Supabase default: identities with the same verified email link automatically when
"link identities" is on; otherwise distinct users. Keep default. Out of scope.

## Testing

Physical iPhone (Apple native + Google), Android device (Google native + Apple browser),
web (both round-trips), mobile recovery-email round-trip.
