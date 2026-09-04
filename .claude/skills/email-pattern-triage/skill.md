---
name: email-pattern-triage
description: Review pending rows in `unrecognized_emails`, decide whether each alert family is a parser gap, an already-supported pattern (user should retry), or an informational alert, and open one GitHub issue per new parser gap. Runs on a schedule (Claude Code Routine) and can be run by hand.
---

## Why this exists

Bancolombia changes its alert templates without notice (e.g. Aug 2026: the plain
transfer alert switched to a 2-digit year; USD purchases started arriving as
`Compraste USD1,00`). When the regex parser in
`webapp/src/lib/parsers/bancolombia-email.ts` misses, the webhook stores the
email in `unrecognized_emails` (status `pending`) and nothing else happens. This
skill turns that table into a feed of actionable issues so the parser gets fixed
close to when the template changes, not months later.

## Inputs

- Supabase project `tgkhaxipfgskxydotdtu`, table `unrecognized_emails`
  (`id, user_id, email_ingest_id, from_address, subject, text_body, html_body, status, created_at`).
  Only `status = 'pending'` rows matter; `dismissed`/`imported` are done.
- GitHub repo `cristian1911/personal_finance_manager_claude`, label `email-pattern`.
- The repo's parser and tests: `webapp/src/lib/parsers/bancolombia-email.ts`,
  `webapp/src/lib/parsers/__tests__/bancolombia-email.test.ts`.

## Procedure

### 1. Group pending emails by alert family

Run this SQL (Supabase MCP `execute_sql`). It strips HTML, isolates the alert
sentence and replaces amounts/dates/times/masks so that the same template
collapses into one signature:

```sql
with bodies as (
  select id, created_at, subject,
    regexp_replace(
      regexp_replace(
        coalesce(nullif(trim(text_body), ''), regexp_replace(coalesce(html_body, ''), '<[^>]+>', ' ', 'g')),
        '&[a-z]+;|&#\d+;', ' ', 'g'),
      '\s+', ' ', 'g') as body
  from unrecognized_emails
  where status = 'pending'
),
alerts as (
  select id, created_at, subject,
    substring(body from '(Bancolombia(?::| (?:le )?informa)[^.]*(?:\.[^.]*){0,2})') as alert
  from bodies
)
select
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(alert, '(sin marcador Bancolombia)'), '\*+ ?\d+', '*MASK', 'g'),
        '(\$|COP|USD)\s?[0-9][0-9.,]*', '$#', 'g'),
      '\d{1,2}/\d{1,2}/\d{2,4}', 'DATE', 'g'),
    '\d{1,2}:\d{2}(:\d{2})?', 'TIME', 'g') as signature,
  count(*) as n,
  min(created_at) as first_seen,
  max(created_at) as last_seen,
  (array_agg(id order by created_at desc))[1] as sample_id
from alerts
group by 1
order by last_seen desc;
```

Names of people/merchants stay in the signature; treat two signatures that
differ only in a name as the same family.

### 2. Classify each family

| Class | How to tell | Action |
|---|---|---|
| **Informational** | No money moved: `no fue exitosa`, `Apagaste/Encendiste tu tarjeta`, `Bloqueamos tu Clave Dinamica`, marketing, security footer only. | No issue. Mention in the run summary as "dismissable". |
| **Already supported** | The current parser on the default branch parses the sample body (see step 3). Happens when a fix merged after the email arrived. | No issue. Summary says "retry from Ajustes → Correos no reconocidos". |
| **Parser gap** | Real movement (compra, transferencia, pago, retiro, recibiste…) and the parser returns `null`. | Open an issue (step 4) unless one already exists. |

### 3. Probe the parser against the real bodies

Fetch the sample body for each non-informational family:

```sql
select id, text_body, html_body from unrecognized_emails where id in ('<sample_id>', ...);
```

In the repo (`pnpm install --frozen-lockfile` from the root first), write a
throwaway vitest file under `webapp/src/lib/parsers/__tests__/` that feeds each
body to `parseBancolombiaEmail`. When only `html_body` exists, strip tags the
way `stripHtml()` in `webapp/src/actions/email-ingest.ts` does (`<[^>]+>` → space,
decode `&nbsp;`/`&amp;`/`&#…;`, collapse whitespace). Run
`npx vitest run <file>` from `webapp/`, then delete the file. Never commit it.

### 4. Open one issue per new parser gap

Before creating, search open and closed issues with label `email-pattern` (or
title prefix `[email-pattern]`) for the same family. If one exists, add a
comment with the new count/last-seen instead of a new issue.

Title: `[email-pattern] <verb + shape>` — e.g. `[email-pattern] Compraste USD… en … con tu T.Cred` .

Body (Spanish, matches the repo's issue style):

```
## Qué llegó
Familia de alerta que el parser de `bancolombia-email.ts` no reconoce.

**Muestra (redactada):**
> Bancolombia: Compraste USD#,## en LOUNGEKEY con tu T.Cred *MASK, el DATE a las TIME.

- Correos afectados: N (primero: YYYY-MM-DD, último: YYYY-MM-DD)
- `unrecognized_emails.id` de muestra: `<uuid>`

## Por qué falla
<one or two sentences: which existing pattern is closest and what differs — new
prefix, 2-digit year, different verb, missing "el"/"a las", etc.>

## Qué hacer
- Añadir/ajustar el patrón en `webapp/src/lib/parsers/bancolombia-email.ts`
- Test con el cuerpo real en `webapp/src/lib/parsers/__tests__/bancolombia-email.test.ts`
- Si es un `pattern_type` nuevo: `EMAIL_PATTERN_LABELS` en `webapp/src/lib/email-ingest/pattern-labels.ts` y `EMAIL_PATTERN_TO_FLOW` en `@zeta/shared` (el test `pattern-flow-coverage` falla si falta)
- Tras desplegar, reintentar los correos desde Ajustes → Correos no reconocidos
```

Redact before posting: replace full account/phone numbers with `*MASK`, keep
only the last 4 digits of cards, and drop any personal name that is not a
merchant. Never paste the whole email.

Labels: `email-pattern`. If the label does not exist and the API rejects it,
create the issue without labels and say so in the summary.

### 5. Summary

End the run with a short summary: families found, issues opened/updated (with
links), families already supported (retry), informational families
(dismissable). If nothing is pending, say so in one line and stop. Do not edit
the parser or push code from the routine: the issue is the deliverable.
