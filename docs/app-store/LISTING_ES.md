# App Store — Listing en español (es-MX como primary)

Copia lista para pegar en App Store Connect → My Apps → Zeta → App Store tab.
Todos los textos respetan los límites de Apple.

App Store Connect identifiers:
- ASC App ID: `6763683831`
- Apple Team ID: `F5GQBU5JPS`
- Bundle ID: `com.venti5.zeta`
- Primary Language: Spanish (Mexico)

---

## Name (30 char)

```
Zeta: Finanzas Personales
```
_25 caracteres._ — ya creado.

---

## Subtitle (30 char)

```
Presupuesto, deudas y bancos
```
_28 caracteres._

Alternativas:
- `Tu plata, organizada y clara` (28)
- `Extractos, presupuesto, deudas` (30)
- `Finanzas sin ruido` (18)

---

## Promotional Text (170 char) — editable sin re-review

```
Importa tus extractos de Bancolombia, Davivienda, Nu y más. Presupuesta con la regla 50/30/20. Visualiza tus deudas. Todo en español, sin asesores ni anuncios.
```
_165 caracteres._

---

## Keywords (100 char, separados por coma, sin espacios extra)

```
finanzas,presupuesto,deudas,extracto,bancolombia,davivienda,nu,colombia,gastos,ahorro,dinero,plata
```
_99 caracteres._

Reglas Apple:
- No repetir palabras ya en el Name/Subtitle (cuentan automáticamente).
- Singular > plural cuando ambos buscan al mismo target.
- Marcas competidoras prohibidas excepto bancos (que son productos referenciables).
- Sin "app", "the", "best" — Apple los bloquea o ignora.

---

## Description (4000 char)

⚠ App Store Connect rechaza los caracteres `──` (U+2500) y `•` (U+2022) con "This field contains one or more invalid characters." Versión limpia abajo.

```
Zeta es una app de finanzas personales para quienes odian las apps de finanzas personales. Silenciosa, honesta, hecha para saber si vas bien, no para convencerte de que sí.


QUÉ PUEDES HACER CON ZETA

- Importar extractos PDF de tus bancos colombianos: Bancolombia, Banco de Bogotá, Davivienda, Nu, Falabella, Nequi y más. Zeta lee el extracto, detecta cuotas de tarjeta de crédito y arma tu historial de transacciones en segundos.

- Organizar con categorías claras: 13 categorías principales y subcategorías personalizables. Auto-categorización por reglas para que sepas qué entró y qué salió sin clasificar una por una.

- Presupuestar con la regla 50/30/20: esenciales, deseos y ahorro, con alertas cuando te acercas al límite.

- Visualizar tus deudas: tarjetas, créditos, plazos. Ve cuánto debes, cuánto pagas en intereses y qué pasa si adelantas cuotas.

- Planear con múltiples monedas: COP, USD, EUR y más, con tasas de cambio actualizadas diariamente.

- Captura rápida: añade un gasto en segundos por voz, foto del recibo o entrada manual.

- Recurrentes automáticas: suscripciones, arriendo, salarios. Zeta detecta los patrones y te avisa antes de que venzan.


CÓMO PROTEGEMOS TUS DATOS

- Cifrado en tránsito (HTTPS/TLS 1.2+) y en reposo (sobre-cifrado por usuario).
- No compartimos tus datos con nadie. Cero anunciantes, cero rastreo cruzado.
- Tú decides: borra tu cuenta cuando quieras y tus datos se eliminan en 30 días.
- Tus contraseñas bancarias nunca se guardan en Zeta. Solo lees extractos que tú cargas manualmente.


DISEÑADO EN COLOMBIA

Zeta se construye pensando en cómo funciona la plata en Colombia: cuotas de tarjeta de crédito, extractos bancarios locales, soporte para COP como moneda principal, formatos de fecha y hora en es-CO.


IMPORTANTE

Zeta no es un asesor financiero. La información mostrada es solo para organizar tus finanzas personales. No reemplaza asesoría profesional.

Zeta no es un banco. No ejecutamos pagos ni gestionamos inversiones. Somos una herramienta de visualización y organización, nada más.


QUIÉNES SOMOS

Zeta es un proyecto independiente. No tenemos inversionistas presionando por anuncios ni métricas vanity. Construimos lo que nos gustaría usar.
```
_~2.500 caracteres._

---

## What's New (4000 char) — primera versión

```
Primera versión pública de Zeta.

• Importa extractos PDF de Bancolombia, Davivienda, Nu, Banco de Bogotá, Falabella, Nequi y más.
• Presupuesto 50/30/20 con alertas suaves.
• Vista de deudas con simulador de pagos adelantados.
• Multi-moneda con tasas actualizadas a diario.
• Captura rápida por voz, foto o entrada manual.
• Modo demo para probar sin crear cuenta.

Gracias por probar. Cualquier bug o idea: escríbenos desde Ajustes → Reportar bug.
```

---

## URLs

- **Marketing URL** (opcional): `https://pfm.sanson1911.cloud`
- **Support URL** (obligatoria): `https://pfm.sanson1911.cloud` (placeholder hasta tener `/support`)
- **Privacy Policy URL** (obligatoria): `https://pfm.sanson1911.cloud/privacy`

⚠ El dominio `pfm.sanson1911.cloud` está pendiente de rebrand. **No envíes a review hasta confirmar que la URL es estable** — cambiarla después dispara re-review.

---

## App Privacy questionnaire (App Store Connect)

Mapear desde `PrivacyInfo.xcprivacy` ya declarado en `mobile/app.json`:

| Data Type | Linked to user | Used to track | Purpose |
|---|---|---|---|
| Email Address | Yes | No | App Functionality |
| User ID | Yes | No | App Functionality |
| Other Financial Info | Yes | No | App Functionality |
| Other User Content | Yes | No | App Functionality |

- "Do you or your third-party partners use data to track users?" → **No**.
- Encryption: declarado vía `ITSAppUsesNonExemptEncryption: false` (skips export compliance).

---

## App Information

- **Category — Primary:** Finance
- **Category — Secondary:** Productivity (opcional)
- **Content Rights:** Does not contain third-party content
- **Age Rating:** 4+ (responder "no" a todas las preguntas del questionnaire)
- **License Agreement:** standard EULA de Apple (a menos que tengas uno propio)

### Copyright (200 char)

Formato Apple: `© YYYY <Owner>`. Mostrado al usuario en la página del store.

```
© 2026 Cristian Giraldo
```

Alternativas:
- `© 2026 Venti5 Labs` (si registras una marca/empresa)
- `© 2026 Zeta` (informal, válido)

---

## Pricing & Availability

- **Price:** Free
- **Availability:** Colombia (only). Para expandir a Latam más tarde, declarar disclosures financieros adicionales por mercado.

---

## App Review Information

**Sign-In required:** **No** — la app expone un modo demo local en la pantalla de bienvenida ("Ver demo" / "Probar sin cuenta") que carga datos de muestra sin pedir credenciales. El reviewer puede experimentar el core de la app sin sign-up.

**Demo Account:** _no aplica_ (sign-in not required).

**Contact Information:**
- First Name: Cristian
- Last Name: Giraldo
- Phone: +573016626574
- Email: venti5.labs@gmail.com

**Notes for Reviewer:**
```
Zeta is a personal finance tracker for users in Colombia.

- It does NOT move money, execute payments, or provide financial advice.
- Users manually upload bank PDF statements; Zeta parses and categorizes transactions locally.
- No banking credentials are stored. No third-party financial APIs.
- Bank logos in screenshots reference parsed PDF formats only — no partnership claimed.
- Spanish (Mexico) is the primary language. UI is Spanish-only at launch.

How to test without an account:
On the welcome screen, tap "Ver demo" (or "Probar sin cuenta"). This loads a
pre-seeded local demo with sample transactions, budgets, debts, and recurring
obligations. No sign-up required, no network call to the backend.

Account-bound features (sign-up, sync, account deletion) are available too:
tap "Crear cuenta" from the welcome screen or from the demo banner.
Account deletion is in Settings → Borrar cuenta and wipes all user data via
a SECURITY DEFINER RPC plus Supabase auth.admin.deleteUser.

Privacy disclaimer "Zeta no es un asesor financiero" is shown in Settings.
```

---

## Screenshots

`supportsTablet` ya está en `false` → solo se requieren screenshots de iPhone.

| Display | Resolución | Min | Recomendado |
|---|---|---|---|
| 6.9" iPhone (16/17 Pro Max) | 1320×2868 | 3 | 6-8 |
| 6.5" iPhone (older XS Max etc.) | 1242×2688 | opcional | opcional |

**Set sugerido (orden de impacto):**
1. Hero del Dashboard (datos de demo).
2. Importar PDF — wizard step de revisión.
3. Presupuesto 50/30/20 con anillos.
4. Vista de Deudas con simulador.
5. Detalle de transacción categorizada.
6. Captura rápida — voz/foto/manual.

Capturar con la app en modo demo para que los datos sean realistas.

---

## Sequencing — primera submission

1. Confirmar dominio webapp final (Privacy URL estable).
2. ✓ `supportsTablet: false` aplicado.
3. **Validar cobertura del modo demo** (ver sección "Demo mode coverage" abajo).
4. Capturar screenshots (script en `docs/app-store/capture-ios-screenshots.sh`).
5. Pegar todo este copy en App Store Connect.
6. Llenar App Privacy + Age Rating + App Information + Copyright.
7. `eas build --profile production-ios --platform ios`.
7. TestFlight smoke test (Face ID, importar PDF, demo, borrar cuenta).
8. `eas submit --profile production --platform ios`.
9. Submit for Review.

---

## Demo mode coverage — validation checklist

Antes de submission, verificar manualmente que el modo demo permite al reviewer probar el core sin cuenta. Toca "Ver demo" en el welcome y confirma:

- [ ] Dashboard carga con transacciones, presupuesto, deudas, recurrentes seedeados.
- [ ] Lista de transacciones navegable (puede expandir, ver detalle).
- [ ] Crear transacción manual funciona (sin sync, queda local).
- [ ] Vista de Presupuestos abre con anillos 50/30/20.
- [ ] Vista de Deudas abre con simulador.
- [ ] Vista de Plan/Periodo muestra checklist de obligaciones.
- [ ] Captura rápida (voz/foto/manual) abre y permite registrar.
- [ ] Settings carga; muestra "Crear cuenta" en lugar de "Cerrar sesión".
- [ ] No se rompe al hacer scroll, expandir, navegar entre tabs.

⚠ Demo mode es **local-only**. Features que requieren backend (importar PDF real, sync, account deletion) no funcionan en demo. Eso está bien — Apple Review acepta limitaciones de modo demo siempre que se documenten en las "Notes for Reviewer".

Si alguna de estas falla, un fix es prerequisito. El reviewer va a tocar todas las pantallas; cualquier crash en demo = rejection.

---

## Changelog

- 2026-04-24 — Borrador iOS basado en `docs/play-store/LISTING_ES.md`.
- 2026-04-24 — `supportsTablet: false`, sign-in not required, copyright, demo mode validation checklist.
