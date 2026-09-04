# Detección y triage de correos bancarios no reconocidos — Plan

**Date:** 2026-09-04
**Status:** Draft (fase 1 en rama `claude/email-transactions-undetected-6tekgh`)
**Effort:** fase 1 hecha · fase 2 ~1 día · fase 3 ~2-3 días

---

## 1. Problema

Bancolombia cambia las plantillas de sus alertas sin aviso. Cuando el parser regex
(`webapp/src/lib/parsers/bancolombia-email.ts`) deja de coincidir, el webhook guarda el
correo en `unrecognized_emails` con `status = 'pending'` y ahí se queda: nadie se entera
hasta que el usuario nota que faltan movimientos.

Casos reales que motivaron esto (agosto 2026):

| Cambio de plantilla | Efecto | Estado |
|---|---|---|
| Transferencia simple con año de 2 dígitos (`el 22/08/26 a las 10:53`) | 3 transferencias sin importar | Corregido (patrón `transferencia` acepta `\d{2,4}`) |
| Compras en dólares (`Compraste USD1,00 en LOUNGEKEY con tu T.Cred *7706`) | 2 compras sin importar | Corregido (patrones de compra capturan `USD`; la transacción se guarda en USD) |
| Bre-B con llave alfanumérica, recarga Cívica, factura programada (mayo) | Patrones añadidos después de que llegaron los correos; siguen `pending` | Reintentar desde Ajustes |

La tabla ya guarda todo lo necesario (`text_body`, `html_body`, `subject`, `from_address`,
`created_at`). Lo que falta es **quién la mira y cuándo**.

## 2. Objetivo

Que un cambio de plantilla se convierta en un issue de GitHub accionable en menos de
24 horas, con muestra redactada, conteo de correos afectados y diagnóstico de qué patrón
existente es el más cercano. Y que el usuario sepa cuándo un `pending` ya se puede
reintentar porque el parser desplegado lo entiende.

## 3. Fases

### Fase 1 — Procedimiento y rutina (hecho)

- Skill del repo `.claude/skills/email-pattern-triage/skill.md`: SQL que agrupa los
  `pending` por firma de plantilla (montos, fechas, horas y máscaras reemplazados),
  clasificación en *informativo* / *ya soportado* / *brecha*, prueba del cuerpo real contra
  `parseBancolombiaEmail`, plantilla del issue y reglas de redacción, dedupe por label
  `email-pattern`.
- Claude Code Routine "Zeta · Triage de correos no reconocidos", diaria 12:00 UTC,
  sesión nueva sobre el repo. **Creada deshabilitada**: las rutinas creadas desde una
  sesión no heredan conectores, así que no puede leer Supabase. Para activarla hay que
  editarla desde la UI de Rutinas de claude.ai y adjuntarle el conector de Supabase (o
  recrearla desde ahí con el mismo prompt).

### Fase 2 — Señal dentro de la app (siguiente)

Sin depender de Claude ni de GitHub:

- Endpoint cron `GET /api/cron/unrecognized-emails` (protegido con `CRON_SECRET`) que:
  1. lee los `pending`, los agrupa por firma (misma normalización que el SQL de la skill),
  2. vuelve a pasar cada muestra por el parser **desplegado**; si ahora parsea, marca la
     familia como *reintentable* y opcionalmente llama a la misma lógica de
     `retryUnrecognizedEmail` para importarlos solos,
  3. filtra las familias informativas por lista de frases (`no fue exitosa`, `Apagaste`,
     `Encendiste`, `Clave Dinamica`),
  4. deja el resto como *brecha* con conteo y primera/última fecha.
- Persistir el resultado en una tabla pequeña `unrecognized_email_families`
  (`signature`, `sample_id`, `count`, `first_seen`, `last_seen`, `classification`,
  `issue_url`) para que la tarjeta de Ajustes muestre "3 correos de una plantilla nueva
  desde el 22/08" en vez de una lista plana, y un botón "Reintentar todos" cuando la
  familia ya es soportada.
- Disparador: workflow de GitHub Actions con `schedule` que hace `curl` al endpoint, o
  `pg_cron` + `pg_net` desde Supabase. GitHub Actions es más simple porque el repo ya
  tiene los secretos de despliegue.

### Fase 3 — Issues automáticos desde la app (opcional)

- Con `GITHUB_TOKEN` (fine-grained, solo `issues:write`) en producción, el endpoint de la
  fase 2 abre el issue `[email-pattern] …` para cada familia *brecha* nueva y guarda
  `issue_url` en `unrecognized_email_families`; en corridas siguientes comenta el conteo
  en vez de duplicar.
- La rutina de Claude pasa a ser el "segundo nivel": lee el issue, propone el patrón y
  abre el PR con el test del cuerpo real. La skill ya describe ese flujo.

## 4. Decisiones y reglas

- **La tabla `unrecognized_emails` es la fuente**; no se crea otra cola. Fase 2 añade una
  vista agregada, no un duplicado de los cuerpos.
- **Redacción obligatoria** antes de sacar un cuerpo del entorno de Supabase: montos como
  `$#,##`, cuentas como `*MASK`, solo últimos 4 dígitos de tarjetas, sin nombres de
  personas que no sean comercios. Nunca el correo completo.
- **Un patrón nuevo siempre trae**: test con el cuerpo real en
  `bancolombia-email.test.ts`, entrada en `EMAIL_PATTERN_LABELS`
  (`webapp/src/lib/email-ingest/pattern-labels.ts`) y en `EMAIL_PATTERN_TO_FLOW`
  (`@zeta/shared`) si el `pattern_type` es nuevo. `pattern-flow-coverage.test.ts` falla si
  falta.
- **Moneda**: `resolveEmailTransactionCurrency()` (`webapp/src/lib/email-ingest/currency.ts`)
  es el único punto que decide la moneda de una transacción de correo. Para pesos gana la
  cuenta; una alerta en USD se guarda en USD, igual que las secciones USD del extracto PDF.

## 5. Preguntas abiertas

- ¿Vale la pena `pg_cron` para no depender de GitHub Actions en el cron de fase 2?
- ¿La tarjeta de Ajustes debe permitir "descartar toda la familia" para los informativos?
- ¿Bancolombia envía alertas en otras monedas (EUR)? El parser hoy solo distingue COP/USD;
  ampliar `parseCurrencyPrefix()` es trivial cuando aparezca un caso real.
