# Data Safety — Respuestas para Play Console

Guía paso a paso del formulario **Seguridad de los datos**. Abre Play Console →
App content → Data safety → Start.

## 1. Data collection and security (encabezado)

| Pregunta | Respuesta |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (TLS 1.2+) |
| Do you provide a way for users to request that their data is deleted? | **Yes** — desde Ajustes → Eliminar cuenta; también por email a giraldo.0302@gmail.com |

## 2. Data types collected

Marca cada tipo como **Collected** (no Shared — Zeta no comparte con terceros).

Para cada uno indica:
- **Collection is optional / required**: `Required` (excepto las opcionales marcadas)
- **Purpose(s)**: `App functionality` (y `Account management` para identificadores)
- **Is this data processed ephemerally?**: No
- **Is the data encrypted in transit?**: Yes
- **Can the user request that the data be deleted?**: Yes

### Personal info

| Data type | Collected | Purpose | Notas |
|---|---|---|---|
| Name | Optional | Account management | Nombre de perfil (opcional) |
| Email address | Required | Account management, App functionality | Requerido para login |
| User IDs | Required | Account management, App functionality | UUID de Supabase Auth |

### Financial info

| Data type | Collected | Purpose | Notas |
|---|---|---|---|
| User payment info | **No** | — | Zeta NO guarda tarjetas ni credenciales de pago. (Cuando se active Zeta Premium, Google Play manejará la facturación; Zeta solo recibirá receipt tokens.) |
| Purchase history | Yes | App functionality | Transacciones importadas del usuario |
| Other financial info | Yes | App functionality | Saldos, cuentas, extractos, contraseñas de PDF |

### App info and performance

| Data type | Collected | Purpose | Notas |
|---|---|---|---|
| Crash logs | **No** | — | No recolectamos crashlytics por ahora |
| Diagnostics | **No** | — | — |
| Other app performance data | **No** | — | — |

### Device or other IDs

| Data type | Collected | Purpose | Notas |
|---|---|---|---|
| Device or other IDs | **No** | — | No trackeamos advertising ID ni similares |

### Todo lo demás

**No recolectamos**: Location (aprox/precise), Web browsing, Messages, Photos & videos,
Audio files, Files and docs (excepto los PDF que el usuario sube conscientemente —
declarar como "Other financial info"), Calendar, Contacts, Health & fitness, Web
history, Sensitive info, Ads data.

## 3. Data sharing

**Zeta NO comparte datos con terceros.** Los extractos PDF se procesan en nuestro
propio microservicio (pdf_parser) y no se envían a servicios externos.

Única excepción técnica: el webapp consulta `frankfurter.app` para tipos de cambio
— solo envía pares de monedas (COP/USD), no envía datos del usuario.

## 4. Security practices

| Pregunta | Respuesta |
|---|---|
| Is your data encrypted in transit? | **Yes** (TLS 1.2+ entre app, webapp y Supabase) |
| Do you provide a way for users to request that their data is deleted? | **Yes** (Ajustes → Eliminar cuenta) |
| Has your app been independently validated against a global security standard? | **No** (opcional — no tenemos certificación SOC/ISO) |

## 5. Privacy policy URL

```
https://pfm.sanson1911.cloud/privacy
```

## 6. Proceso de eliminación de cuenta (Google Play Data Deletion)

Google Play ahora requiere que el usuario pueda **solicitar borrado sin
reinstalar la app**. Necesitas publicar una URL dedicada a instrucciones:

- Recomendado: crear `/privacidad/eliminar-cuenta` en webapp con instrucciones
  paso a paso + formulario o email de contacto.
- En Play Console → App content → Data deletion → pegar esa URL.

**Pendiente de crear** esa ruta antes de enviar a revisión.

---

## Resumen ejecutivo para el formulario

Copia-pega en el cuestionario principal:

> Zeta recolecta: email, nombre opcional, UUID del usuario, y datos financieros
> (transacciones, cuentas, saldos, extractos PDF, contraseñas de PDF) introducidos
> o importados por el propio usuario. Toda la información se cifra en tránsito
> (TLS) y en reposo (cifrado de columna tipo envelope para campos sensibles).
> No compartimos datos con anunciantes ni terceros. El usuario puede solicitar
> la eliminación completa de su cuenta desde Ajustes o por email.
