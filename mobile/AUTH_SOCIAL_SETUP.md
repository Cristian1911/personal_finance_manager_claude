# Social sign-in (Google + Apple) — setup & troubleshooting

The Google and Apple buttons in the mobile app are wired correctly in code
(`lib/auth-social.ts`, `components/auth/SocialAuthButtons.tsx`). When they fail,
the cause is **almost always OAuth provider configuration** in Google Cloud,
Apple Developer, or the Supabase dashboard — not the app code. This file is the
checklist to resolve the two failures currently seen on the Android build:

- **Google:** _"No se pudo iniciar sesión con Google"_
- **Apple:** Apple's own page shows `invalid_request — Invalid client id or web redirect url`

Reference values for this project:

| Thing | Value |
|---|---|
| Supabase project ref | `tgkhaxipfgskxydotdtu` |
| Supabase auth callback | `https://tgkhaxipfgskxydotdtu.supabase.co/auth/v1/callback` |
| App bundle id / package | `com.venti5.zeta` |
| App deep-link scheme | `zeta://` (return url `zeta://auth-callback`) |
| Google web client id | `1027538281655-dveo3pn7m1s9es0lsjkmuat4u536lpgh.apps.googleusercontent.com` |
| Google iOS client id | `1027538281655-dh3so5rl229inv5djocenpdh546pij7o.apps.googleusercontent.com` |

---

## Google — `DEVELOPER_ERROR` on Android

The native Android Google SDK matches your app to an **Android OAuth client** by
`package name + signing certificate SHA-1`. If that client doesn't exist (or the
SHA-1 doesn't match the keystore that signed the installed APK/AAB), the native
call throws `DEVELOPER_ERROR` (code 10), which the app surfaces as the generic
Spanish error. Steps:

1. **Get the signing SHA-1 fingerprints** for every keystore that ships a build:
   - EAS-managed keystore: `eas credentials` → Android → *Keystore* →
     copy the **SHA-1**.
   - Google Play App Signing (if enrolled): Play Console → *Test and release →
     App integrity → App signing key certificate* → copy that **SHA-1** too.
   - Add **both** — the upload key and the Play-signed key differ.
2. In **Google Cloud Console → APIs & Services → Credentials**, create an
   **OAuth client ID → Android** for each SHA-1:
   - Package name: `com.venti5.zeta`
   - SHA-1: the fingerprint(s) from step 1
   - Use the **same Google Cloud project** that owns the web client id above.
3. Keep using the **web client id** as `webClientId` in `configureGoogle()`
   (already the case) — on Android the ID token audience is the web client, and
   the Android client just authorizes the caller. Do **not** switch to an
   Android client id in code.
4. In **Supabase → Authentication → Providers → Google**, enable the provider
   and add the **web client id** to *Authorized Client IDs* so Supabase accepts
   the ID token audience.
5. Rebuild with a profile that injects the env vars (`preview` / `production` in
   `eas.json` already do). Verify in the running build — a missing
   `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` logs a `[google-signin]` warning.

> Tip: reproduce with a dev/preview build over ADB and watch `adb logcat | grep
> google-signin` — the app logs the native `code` on failure (10 =
> DEVELOPER_ERROR → SHA-1/client mismatch).

---

## Apple — `invalid_request: Invalid client id or web redirect url`

On Android there is no native Apple SDK, so the app uses the **web OAuth flow**
(`signInWithAppleWeb`): it opens Apple's `id.apple.com` authorize page via
Supabase. Apple returns this error when the **Services ID (client_id)** or the
**Return URL** it receives don't match what's registered in Apple Developer.
The redirect Apple validates is the **Supabase callback**, not the app deep
link. Steps:

1. In **Apple Developer → Certificates, Identifiers & Profiles → Identifiers**:
   - Ensure a **Services ID** exists (e.g. `com.venti5.zeta.web`) with *Sign In
     with Apple* enabled. This string is the `client_id`.
   - Under the Services ID → *Sign In with Apple → Configure*:
     - **Domains:** `tgkhaxipfgskxydotdtu.supabase.co`
     - **Return URLs:** `https://tgkhaxipfgskxydotdtu.supabase.co/auth/v1/callback`
       (exact match — no trailing slash, `https`).
   - Create a **Sign in with Apple key** (.p8) and note the **Key ID** and your
     **Team ID** (`F5GQBU5JPS`).
2. In **Supabase → Authentication → Providers → Apple**, enable it and fill:
   - **Client IDs:** the App bundle id `com.venti5.zeta` **and** the Services ID
     (comma-separated) — the App id validates native iOS tokens, the Services ID
     validates the Android web flow.
   - **Secret Key / Team ID / Key ID:** from the .p8 in step 1.
3. In **Supabase → Authentication → URL Configuration → Redirect URLs**, add the
   app deep link `zeta://auth-callback` so Supabase is allowed to hand the
   session back to the app after the callback.
4. Retry from the Android build. If Apple still shows the error, the Services ID
   or its Return URL is the mismatch — re-check step 1 character-for-character.

> iOS uses the **native** Apple sheet (`signInWithAppleNative`) and only needs
> the App id `com.venti5.zeta` in Supabase's Apple *Client IDs* — it does not go
> through the Services ID / Return URL path above.

---

## Quick sanity checklist

- [ ] Google **Android** OAuth client(s) exist for `com.venti5.zeta` with the
      correct release **and** Play-signing SHA-1s.
- [ ] Supabase Google provider lists the **web client id** as an authorized id.
- [ ] Apple **Services ID** exists with Return URL = Supabase callback.
- [ ] Supabase Apple provider lists **both** the App id and the Services ID.
- [ ] `zeta://auth-callback` is in Supabase's Redirect URLs allowlist.
- [ ] Build profile injects `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (and iOS id for
      iOS builds).
