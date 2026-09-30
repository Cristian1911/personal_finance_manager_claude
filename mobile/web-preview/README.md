# Web preview of the mobile app

The React Native app (`mobile/`) running in a browser through Expo web — the same code, no second copy. Use it to look at screens, copy and flows, and to screenshot them from a cloud session. It does **not** replace device testing.

## Commands (from `mobile/`)

| Command | What it does |
|---|---|
| `pnpm preview:web` | Dev server with hot reload. Open the URL it prints (`http://localhost:8090`). |
| `pnpm preview:web:shots [route[@Tap\|Tap] ...]` | Web build + headless Chromium screenshots in `web-preview/out/shots/` (git-ignored). Enters demo mode first. |

Screenshot examples:

```bash
pnpm preview:web:shots / /transactions /plan
WIDTH=360 pnpm preview:web:shots /                    # gallery widths: 360, 390, 430
HEIGHT=1500 pnpm preview:web:shots "/v2-debug@Crear cuenta de prueba (100.000)|Anotar gasto de 25.000|Autoprueba"
pnpm preview:web:shots "/inicio@El 15 y el 30|fill:Ingreso de cada pago=2100000|fill:Saldo de hoy=1500000|Ver mi número"  # fill:<accessibilityLabel>=<text>
DEMO=0 pnpm preview:web:shots /                       # stay on the login screen
```

Outside a Claude Code cloud container, install Playwright's Chromium once: `npx playwright install chromium` (or set `CHROMIUM_PATH`).

## Data: never production

`preview.mjs` sets the Supabase variables itself, so a local `mobile/.env` is ignored:
- `SUPABASE_DEV_URL` + `SUPABASE_DEV_PUBLISHABLE_KEY` set → the app talks to **zeta-dev**;
- otherwise → no Supabase at all; tap **Probar demo sin cuenta** (local seed data).

A production URL is refused. `EXPO_PUBLIC_ZETA_V2=1` is always on, so `/v2-debug` is reachable.

## How it works

- `metro.config.js` swaps native-only modules for stand-ins in `shims/` when the platform is `web` (today: `expo-secure-store` → `localStorage`). Native builds never load them. Add a shim here, not `Platform.OS` checks across the app.
- expo-sqlite runs in the browser (wa-sqlite on OPFS). It needs `SharedArrayBuffer`, so the page must be cross-origin isolated: `preview.mjs` puts a small header proxy in front of Expo's dev server, and `shoot.mjs` serves the build with the same headers.
- Two web-only fixes live in `patches/` (applied by pnpm): expo-sqlite's OPFS pool grows from 6 to 24 files and initialises once (v1's `zeta.db` and v2's `zeta-v2.db` opening together used to fail), and NativeWind no longer throws its dark-mode `media` error in dev.
- `app.json` web `output` is `single` (a plain SPA): static rendering ran app code in Node, where SecureStore and SQLite don't exist.

## Limits (web is not the phone)

- No SQLCipher: `zeta-v2.db` is not encrypted in the browser; the Autoprueba reports that line as "No aplica".
- One tab at a time: a second tab can't open the same OPFS files.
- Not available: biometrics, notifications, voice, camera/image picker, Google/Apple native sign-in, the Android notification listener, native gestures and haptics. Fonts and layout are close but not identical.
- Device acceptance for each milestone stays on a real phone.
