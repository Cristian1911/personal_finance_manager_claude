# Category Kits & Tag System Design

**Date:** 2026-03-29
**Status:** Draft
**Phases:** 2 (layered — categories first, tags second)

## Summary

Expand Zeta's category tree from 8 to 13 Colombian-optimized parent groups with ~43 pre-seeded subcategories, then add a universal tag system on categories, destinatarios, and transactions. Tags enable a YNAB-style "rhythm view" of the budget (Bills/Frequent/Non-Monthly/Goals/Quality of Life) as a display-layer toggle alongside the default domain-based view.

## Motivation

Research across Reddit (r/ynab, r/personalfinance), X, and budgeting app documentation (YNAB, Quicken, Monarch Money) surfaced two dominant category models:

1. **Domain-based (Quicken):** ~10 spending domains (Housing, Transport, Food, etc.) — answers "what did I spend on?"
2. **Rhythm-based (YNAB):** ~5 payment rhythm groups (Bills, Frequent, Non-Monthly, Goals, Quality of Life) — answers "when/how do I budget for this?"

Both are valuable. Instead of forcing a choice, this design keeps the domain tree as the primary structure and layers the rhythm view via tags.

Current Zeta gaps:
- Only 8 parent categories — missing Insurance, Savings/Investment, Education, Entertainment as dedicated parents
- No subcategories seeded — Colombian-specific items (EPS, SOAT, Mercado vs. Domicilios) not represented
- No tag system — can't cross-cut transactions by trip, person, or event
- Alimentación conflates needs (Mercado) with wants (Restaurantes)

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Category tree stays domain-based; YNAB rhythm is a tag-based display view | Avoids forking seed data or restructuring the tree |
| 2 | Full tag system on categories + destinatarios + transactions | Tags on transactions are critical for trip/event/person grouping |
| 3 | Tags belong to one tag group or are ungrouped | Simpler than many-to-many; cross-cutting comes from applying multiple tags |
| 4 | Hybrid tag model: system groups are structured, user tags are freeform with slug normalization | YNAB rhythm needs reliability; user tags need zero friction |
| 5 | Colombian subcategories as proper seed subcategories, not tags | They're real spending categories, not cross-cutting labels |
| 6 | Expand to 13 parents (11 outflow + 2 inflow) | Closes Quicken gaps: +Seguros, +Ahorro e Inversión, +Educación, +Entretenimiento, +Comer Fuera |
| 7 | Alimentación → renamed to Comer Fuera (wants); Mercado moves to Hogar (need) | Colombian "hacer mercado" is household provisioning |
| 8 | Servicios públicos (agua+luz+gas) = single subcategory under Hogar | They're one bill in Colombia; Internet and Celular are separate siblings |
| 9 | SOAT + Tecnicomecánica → Obligaciones | Legal requirements, not discretionary transport |
| 10 | Layered delivery: Phase 1 (categories) then Phase 2 (tags) | Phase 1 ships fast with immediate value; tag UX benefits from living with new categories first |

---

## Phase 1: Category Tree Expansion

### New Parent Categories (13 total)

#### Necesidades (expense_type = 'fixed')

**Hogar** (existing, enriched)
- Arriendo/Hipoteca
- Administración
- Mercado _(moved from Alimentación)_
- Servicios públicos _(agua+luz+gas as one)_
- Internet
- Celular
- Mantenimiento
- Artículos hogar

**Transporte** (existing, trimmed)
- Transporte público
- Gasolina
- Peajes
- Parqueadero

**Salud** (existing, enriched)
- EPS
- Medicina prepagada
- Copagos
- Medicamentos
- Odontología

**Seguros** (NEW)
- Seguro de vida
- Seguro vehículo
- Seguro hogar
- ARL

**Obligaciones** (existing, enriched)
- Cuota crédito
- Tarjeta de crédito
- Pensión alimentaria
- Impuestos
- Predial
- SOAT _(moved from Transporte)_
- Tecnicomecánica _(moved from Transporte)_
- Vehicular

#### Deseos (expense_type = 'variable')

**Comer Fuera** (NEW — replaces Alimentación)
- Restaurantes
- Domicilios
- Café/Snacks

**Entretenimiento** (NEW — split from Estilo de Vida)
- Streaming
- Cine/Eventos
- Hobbies
- Suscripciones

**Estilo de Vida** (existing, focused)
- Ropa
- Cuidado personal
- Gym/Deporte
- Regalos
- Mascotas

**Educación** (NEW)
- Matrícula/Pensión
- Útiles/Materiales
- Cursos/Capacitación
- Libros

#### Ahorro

**Ahorro e Inversión** (NEW)
- Fondo de emergencia
- Cesantías
- Pensión voluntaria
- CDT/Inversiones
- Ahorro programado

#### Ingresos (direction = 'INFLOW')

**Ingresos** (existing, enriched)
- Salario
- Freelance
- Prima
- Bonificación

**Otros Ingresos** (existing, enriched)
- Arriendo recibido
- Dividendos
- Devolución impuestos
- Venta de bienes

### Migration Strategy

**Step 1: Rename Alimentación → Comer Fuera**
```sql
UPDATE categories
SET name = 'Comer Fuera', name_es = 'Comer Fuera',
    slug = 'comer-fuera', icon = 'utensils',
    expense_type = 'variable'
WHERE id = 'b0000001-0001-4000-8000-000000000002';
```

**Step 2: Insert 4 new parent categories**
- Seguros, Ahorro e Inversión, Educación, Entretenimiento (Comer Fuera already exists via rename in Step 1)

**Step 3: Insert ~43 subcategories** with appropriate parent_id, expense_type, direction, icon, display_order

**Step 4: Reparent Mercado**
- Insert "Mercado" as a new subcategory under Hogar
- If users had subcategories under the old Alimentación, check by name heuristic (contains "mercado", "supermercado", "tienda") and reparent to Hogar. Leave the rest under Comer Fuera.

**Safety guarantees:**
- Existing transactions untouched (FKs reference category_id UUIDs, not names)
- Existing budgets untouched (same reason)
- Existing destinatario rules untouched (reference default_category_id)
- User-created categories untouched (parent_id preserved; new parents are additive)

**Rollback:** Reverse rename, delete new parents + subcategories. No existing data modified.

### UI Changes (Phase 1)

Minimal — the CategoryZoneManager already renders parents with their children. New parents and subcategories appear automatically. May need:
- Icons for new parents
- Colors for new parents
- Update allocation.ts if Ahorro e Inversión needs special zone handling (currently savings = income - needs - wants; a dedicated savings parent may need explicit zone logic)

---

## Phase 2: Tag System

### Schema

**tag_groups**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID \| NULL | NULL = system group |
| name | TEXT | Display name |
| color | TEXT \| NULL | Group color |
| is_system | BOOLEAN | System groups can't be deleted |
| display_order | INT | Sort order |
| created_at | TIMESTAMPTZ | |

RLS: `user_id = (select auth.uid()) OR user_id IS NULL`

**tags**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID \| NULL | NULL = system tag |
| group_id | UUID \| NULL | FK → tag_groups (NULL = ungrouped) |
| name | TEXT | Display name |
| slug | TEXT | Normalized (lowercase, trimmed, hyphenated) |
| color | TEXT \| NULL | Inherits group color if NULL |
| is_system | BOOLEAN | System tags can't be deleted |
| display_order | INT | Sort order within group |
| created_at | TIMESTAMPTZ | |

UNIQUE constraint: `(COALESCE(user_id, '00000000-0000-0000-0000-000000000000'), slug)` — prevents "viaje" vs "Viaje" duplicates (COALESCE handles NULL user_id for system tags)
RLS: `user_id = (select auth.uid()) OR user_id IS NULL`

**category_tags**
| Column | Type | Notes |
|--------|------|-------|
| category_id | UUID | FK → categories (ON DELETE CASCADE) |
| tag_id | UUID | FK → tags (ON DELETE CASCADE) |

PK: `(category_id, tag_id)`

**destinatario_tags**
| Column | Type | Notes |
|--------|------|-------|
| destinatario_id | UUID | FK → destinatarios (ON DELETE CASCADE) |
| tag_id | UUID | FK → tags (ON DELETE CASCADE) |

PK: `(destinatario_id, tag_id)`

**transaction_tags**
| Column | Type | Notes |
|--------|------|-------|
| transaction_id | UUID | FK → transactions (ON DELETE CASCADE) |
| tag_id | UUID | FK → tags (ON DELETE CASCADE) |

PK: `(transaction_id, tag_id)`

Junction table RLS: inherited from parent entity's existing policies.

### Seed Data: Ritmo YNAB

System tag group "Ritmo YNAB" with 5 system tags:

| Tag | Color | Auto-assigned to categories |
|-----|-------|-----------------------------|
| Fijos | #ef4444 | Arriendo, Administración, Servicios públicos, Internet, Celular, EPS, Prepagada, Cuota crédito, Tarjeta de crédito |
| Frecuentes | #3b82f6 | Mercado, Transporte público, Gasolina, Restaurantes, Domicilios, Café/Snacks |
| No Mensuales | #a855f7 | SOAT, Tecnicomecánica, Predial, Seguros (all), Impuestos, Matrícula/Pensión, Vehicular |
| Metas | #22c55e | Fondo emergencia, Cesantías, Pensión voluntaria, CDT/Inversiones, Ahorro programado |
| Calidad de Vida | #eab308 | Streaming, Cine/Eventos, Hobbies, Gym/Deporte, Ropa, Regalos, Cursos/Capacitación |

### UI Components

#### 1. Tag Picker (shared component)

Reusable autocomplete component used on transaction edit, destinatario form, and category settings.

- Input with autocomplete dropdown
- Groups as section headers in the dropdown
- Type to filter existing tags or create new ones
- Freeform tag creation with slug normalization (lowercase, trim, hyphenate)
- "Crear: `nueva-etiqueta` ↵" prompt at bottom when no match
- Applied tags shown as chips with ✕ remove button

#### 2. Budget View Toggle (Dominio / Ritmo)

Pill toggle in the budget/plan page header:
- **Dominio** (default): categories grouped by parent_id (current behavior)
- **Ritmo**: categories grouped by their "Ritmo YNAB" tag via category_tags join

Implementation: query categories + their Ritmo tag → group by tag name instead of parent_id. Same underlying data.

Store preference in `profiles.dashboard_config` JSONB (existing pattern).

#### 3. Transaction List Filter

New "Etiqueta" filter chip in the transaction list filter bar, alongside existing date/account/category filters. When active:
- Shows tag name as colored chip
- Filters to transactions with matching tag via transaction_tags join
- Shows filtered count and total amount

#### 4. Tag Management Page

New section under Gestionar → Etiquetas:
- System groups shown (not deletable), tags visible
- User groups with full CRUD (create, rename, recolor, delete)
- Tags within groups: add, remove, reorder
- Ungrouped tags section at bottom
- Transaction count shown per group
- "Nuevo grupo de etiquetas" button

### Server Actions (Phase 2)

```
tags.ts:
  getTagGroups()           — all groups + tags for current user (+ system)
  getTagsForEntity(type, id)  — tags on a specific category/destinatario/transaction
  createTagGroup(formData) — name, color
  updateTagGroup(id, formData)
  deleteTagGroup(id)       — cascade deletes tags in group
  createTag(formData)      — name, group_id (optional)
  updateTag(id, formData)
  deleteTag(id)
  addTagToEntity(tagId, entityType, entityId)
  removeTagFromEntity(tagId, entityType, entityId)
  bulkTagTransactions(tagId, transactionIds)
```

### Migration Strategy (Phase 2)

1. Create 5 new tables (tag_groups, tags, category_tags, destinatario_tags, transaction_tags)
2. Enable RLS on all tables
3. Seed "Ritmo YNAB" system group + 5 system tags
4. Auto-assign Ritmo tags to Phase 1 system subcategories via category_tags inserts
5. No existing data changes — purely additive

**Rollback:** Drop tag tables. Zero impact on categories, transactions, or destinatarios.

---

## Out of Scope

- Tag-based budgets (budgets remain per-category)
- Auto-tagging rules (e.g., "if destinatario has tag X, auto-tag transaction with X") — future enhancement
- Tag analytics/reports (e.g., "spending by tag over time") — future enhancement
- Onboarding category picker — users get all 13 parents; they can deactivate unwanted ones via existing toggle
- Destinatario tag inheritance to transactions — future Phase 3 candidate

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Should Alimentación be split across zones? | Yes — Mercado → Hogar (need), Restaurantes/Domicilios → Comer Fuera (want) |
| Should Servicios Públicos be its own parent? | No — single subcategory under Hogar (agua+luz+gas is one bill in Colombia) |
| Where do SOAT/Tecnicomecánica go? | Obligaciones (legal requirements, not transport) |
| Should tags be freeform or structured? | Hybrid — system groups structured, user tags freeform with slug normalization |
| Should transaction tags exist? | Yes — critical for trip/event/person cross-cutting |
