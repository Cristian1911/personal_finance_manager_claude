# Play Store — Checklist de envío

Todos los apartados de **"Termina de configurar tu app"** con respuestas
listas-para-pegar.

## 1. Configura la política de privacidad

- **URL**: `https://pfm.sanson1911.cloud/privacy`
- Idioma: español (hay versión en inglés en `/privacy/en` para mercados EN si
  se necesita).

## 2. Acceso a apps

**Respuesta**: **Toda la funcionalidad está disponible sin credenciales.**

Marca en Play Console: `All or some functionality in my app is restricted` →
selecciona **No, todas las funciones están disponibles sin restricciones
especiales**, PORQUE la app ofrece un modo demo sin cuenta.

### Instrucciones para el revisor (pegar en el campo "Instrucciones")

```
Al abrir la app, en la pantalla de login presiona el botón "Probar demo sin
cuenta". La app sembrará datos ficticios (cuentas, transacciones, categorías,
destinatarios, deudas) y te dará acceso a la totalidad de la experiencia sin
necesidad de registro ni credenciales.

Desde ahí puedes navegar: Inicio, Transacciones, Presupuesto, Plan (deudas,
recurrentes), Destinatarios, Ajustes. Todas las features están disponibles en
el modo demo salvo la sincronización con backend, que no aplica sin cuenta.

Para salir del modo demo: Ajustes → "Salir del modo demo". Esto limpia los
datos locales sembrados.
```

### Por qué esto satisface a Google

Play Console acepta tres escenarios en "Acceso a apps":
1. App sin login (todas las features accesibles) — **nuestro caso**, vía demo
2. Login requerido + credenciales de prueba entregadas
3. Login requerido + razón justificada para no entregar credenciales

El demo mode nos ubica en (1) aunque haya login opcional — el revisor no
necesita cuenta.

### Verificar antes de enviar

- [ ] Demo mode funciona en un build de producción (no solo dev) — hacer
      smoke test con AAB interno.
- [ ] `seedDemoData()` ejecuta sin errores en dispositivo limpio.
- [ ] El botón "Probar demo sin cuenta" es visible en primera pantalla tras
      el splash (no detrás de un onboarding forzado).

## 3. Anuncios

- **¿Contiene anuncios?** → **No**

## 4. Clasificación de contenido

Responde al cuestionario con estos valores:

| Pregunta | Respuesta |
|---|---|
| Categoría | Utilidad / Productividad / Comunicación |
| ¿Violencia? | No |
| ¿Sexualidad? | No |
| ¿Lenguaje ofensivo? | No |
| ¿Drogas, alcohol, tabaco? | No |
| ¿Apuestas o juegos de azar reales? | No |
| ¿Contenido generado por usuarios compartido públicamente? | No |
| ¿Compartes ubicación del usuario? | No |
| ¿Funciones financieras? | Sí — ver sección 9 |
| ¿Compras digitales? | **No** (planeado post-v1 — ver `BACKLOG.md` → "Zeta Premium") |

**Resultado esperado**: PEGI 3 / Everyone / USK 0 / Clasificación para todo
público.

## 5. Público objetivo

- **Edad objetivo**: **18+**
  - Razón: app financiera, los usuarios gestionan su propio dinero.
- **¿Tu app atrae a menores?** → No
- **Declaración de seguridad infantil**: No aplica (no target infantil).

## 6. Seguridad de los datos

Ver `data-safety.md` para el formulario completo.

## 7. Apps gubernamentales

- **¿Tu app representa o es desarrollada por un gobierno?** → **No**

## 8. Funciones financieras

**Sí** — marca las siguientes:

- [x] Gestión de presupuesto y seguimiento de gastos
- [x] Consolidación de datos de cuentas bancarias (importación manual de
      extractos, NO agregador por API)
- [ ] Préstamos personales (no aplicable)
- [ ] Transferencias de dinero (no aplicable)
- [ ] Criptomonedas (no aplicable)
- [ ] Corretaje / inversión (no aplicable)

**Declaraciones adicionales** (Google exige esto):

- La app es **solo informativa**, no procesa pagos ni mueve dinero.
- El usuario importa extractos **manualmente** desde archivos que descarga de
  su banco.
- **No somos una institución financiera** ni requerimos licencia bancaria.
- País operativo: **Colombia** (también disponible globalmente pero con énfasis
  en bancos colombianos).

## 8.1. Paywall — diferido al backlog

v1 se publica **sin compras digitales**. Cuando se implemente Zeta Premium,
flipear las respuestas a **Sí** tanto aquí como en Clasificación de contenido.
Detalle técnico en `BACKLOG.md` → sección *Features* → "Zeta Premium — paywall
+ Google Play Billing / StoreKit".

## 9. Salud

- **¿App de salud o bienestar?** → **No**

## 10. Seleccionar categoría y contacto

- **Categoría**: **Finanzas**
- **Etiquetas**: Gestión financiera, Presupuesto
- **Email de contacto**: `giraldo.0302@gmail.com`
- **Teléfono**: opcional — dejar en blanco si no quieres exponer.
- **Sitio web**: `https://pfm.sanson1911.cloud`
- **Dirección**: opcional para apps personales; requerida en algunos países.

## 11. Configura la ficha de Play Store

Ver `listing.md` para título, descripciones y assets.

---

## Orden recomendado (2–4 horas)

1. **Política de privacidad** — ya existe, solo pegar URL (5 min)
2. **Acceso a apps** — crear cuenta de prueba + pegar credenciales (15 min)
3. **Anuncios** — clic "No" (1 min)
4. **Clasificación de contenido** — cuestionario (15 min)
5. **Público objetivo** — 18+ (5 min)
6. **Funciones financieras** — marcar "Sí" + declaraciones (10 min)
7. **Apps gubernamentales / Salud** — "No" (2 min)
8. **Seguridad de los datos** — seguir `data-safety.md` (30–45 min)
9. **Categoría y contacto** — Finanzas + email (5 min)
10. **Ficha de Play Store** — pegar copy de `listing.md` + subir assets
    (15–30 min)
11. **Subir AAB** a **pruebas internas** primero (no producción directo)

## Antes de pulsar "Enviar a revisión"

- [ ] Bump `version` a `1.1.0` y `versionCode` a `3` en `app.json`
      (últimamente construido: 1.0.0 / versionCode 2)
- [ ] Construir AAB: `cd mobile && eas build -p android --profile production-android`
- [ ] Descargar AAB de EAS dashboard
- [ ] Subirlo a Play Console → Pruebas internas
- [ ] Agregar tu propia cuenta como tester y validar flujo completo
- [ ] Promover de "Pruebas internas" → "Producción" cuando esté validado

## Plazos estimados

- Revisión de Google Play: **1–7 días** la primera vez, usualmente 24–72h.
- Pruebas internas: disponibles en **~15 min** tras subir.
