/**
 * Seed category UUIDs — single source of truth.
 * Import from "@zeta/shared" in all packages.
 *
 * Two levels:
 *  - `CATEGORY_*` — the 8 top-level zones (b0000001-…). Display/grouping only.
 *  - `SUB_*`      — the 59 seeded subcategories (c0000001-…), `user_id IS NULL`,
 *                   `is_system = true`, identical ids for every user.
 *
 * Auto-categorization must always target a **subcategory**. The UI groups by
 * parent, so assigning a parent id leaves a transaction that looks categorized
 * but renders under no leaf. That mismatch is why every system rule used to be
 * skipped — see the note on `SUBCATEGORY_IDS` below.
 */

// ── Top-level zones (b0000001-…) ────────────────────────────────────
export const CATEGORY_HOGAR = "b0000001-0001-4000-8000-000000000001";
/** Renamed Alimentación → "Comer Fuera" in migration 20260329121902. Groceries moved to Hogar › Mercado. */
export const CATEGORY_COMER_FUERA = "b0000001-0001-4000-8000-000000000002";
export const CATEGORY_TRANSPORTE = "b0000001-0001-4000-8000-000000000003";
export const CATEGORY_SALUD = "b0000001-0001-4000-8000-000000000004";
export const CATEGORY_ESTILO_DE_VIDA = "b0000001-0001-4000-8000-000000000005";
export const CATEGORY_OBLIGACIONES = "b0000001-0001-4000-8000-000000000006";
export const CATEGORY_INGRESOS = "b0000001-0001-4000-8000-000000000007";
export const CATEGORY_OTROS_INGRESOS = "b0000001-0001-4000-8000-000000000008";

/** @deprecated Renamed to `CATEGORY_COMER_FUERA`. Kept so existing imports keep resolving. */
export const CATEGORY_ALIMENTACION = CATEGORY_COMER_FUERA;

// ── Hogar ───────────────────────────────────────────────────────────
export const SUB_ARRIENDO = "c0000001-0001-4000-8000-000000000001";
export const SUB_ADMINISTRACION = "c0000001-0001-4000-8000-000000000002";
export const SUB_MERCADO = "c0000001-0001-4000-8000-000000000003";
export const SUB_SERVICIOS_PUBLICOS = "c0000001-0001-4000-8000-000000000004";
export const SUB_INTERNET = "c0000001-0001-4000-8000-000000000005";
export const SUB_CELULAR = "c0000001-0001-4000-8000-000000000006";
export const SUB_MANTENIMIENTO_HOGAR = "c0000001-0001-4000-8000-000000000007";
export const SUB_ARTICULOS_HOGAR = "c0000001-0001-4000-8000-000000000008";

// ── Comer Fuera ─────────────────────────────────────────────────────
export const SUB_RESTAURANTES = "c0000001-0002-4000-8000-000000000001";
export const SUB_DOMICILIOS = "c0000001-0002-4000-8000-000000000002";
export const SUB_CAFE_SNACKS = "c0000001-0002-4000-8000-000000000003";

// ── Transporte ──────────────────────────────────────────────────────
export const SUB_TRANSPORTE_PUBLICO = "c0000001-0003-4000-8000-000000000001";
export const SUB_GASOLINA = "c0000001-0003-4000-8000-000000000002";
export const SUB_PEAJES = "c0000001-0003-4000-8000-000000000003";
export const SUB_PARQUEADERO = "c0000001-0003-4000-8000-000000000004";

// ── Salud ───────────────────────────────────────────────────────────
export const SUB_EPS = "c0000001-0004-4000-8000-000000000001";
export const SUB_MEDICINA_PREPAGADA = "c0000001-0004-4000-8000-000000000002";
export const SUB_COPAGOS = "c0000001-0004-4000-8000-000000000003";
export const SUB_MEDICAMENTOS = "c0000001-0004-4000-8000-000000000004";
export const SUB_ODONTOLOGIA = "c0000001-0004-4000-8000-000000000005";

// ── Estilo de vida ──────────────────────────────────────────────────
export const SUB_ROPA = "c0000001-0005-4000-8000-000000000001";
export const SUB_CUIDADO_PERSONAL = "c0000001-0005-4000-8000-000000000002";
export const SUB_GYM_DEPORTE = "c0000001-0005-4000-8000-000000000003";
export const SUB_REGALOS = "c0000001-0005-4000-8000-000000000004";
export const SUB_MASCOTAS = "c0000001-0005-4000-8000-000000000005";

// ── Obligaciones ────────────────────────────────────────────────────
export const SUB_CUOTA_CREDITO = "c0000001-0006-4000-8000-000000000001";
export const SUB_PAGO_TARJETA = "c0000001-0006-4000-8000-000000000002";
export const SUB_PENSION_ALIMENTARIA = "c0000001-0006-4000-8000-000000000003";
export const SUB_IMPUESTOS = "c0000001-0006-4000-8000-000000000004";
export const SUB_PREDIAL = "c0000001-0006-4000-8000-000000000005";
export const SUB_SOAT = "c0000001-0006-4000-8000-000000000006";
export const SUB_TECNICOMECANICA = "c0000001-0006-4000-8000-000000000007";
export const SUB_VEHICULAR = "c0000001-0006-4000-8000-000000000008";

// ── Ingresos ────────────────────────────────────────────────────────
export const SUB_SALARIO = "c0000001-0007-4000-8000-000000000001";
export const SUB_FREELANCE = "c0000001-0007-4000-8000-000000000002";
export const SUB_PRIMA = "c0000001-0007-4000-8000-000000000003";
export const SUB_BONIFICACION = "c0000001-0007-4000-8000-000000000004";

// ── Otros ingresos ──────────────────────────────────────────────────
export const SUB_ARRIENDO_RECIBIDO = "c0000001-0008-4000-8000-000000000001";
export const SUB_DIVIDENDOS = "c0000001-0008-4000-8000-000000000002";
export const SUB_DEVOLUCION_IMPUESTOS = "c0000001-0008-4000-8000-000000000003";
export const SUB_VENTA_BIENES = "c0000001-0008-4000-8000-000000000004";
export const SUB_DEVOLUCION_PRESTAMOS = "c0000001-0008-4000-8000-000000000005";

// ── Seguros ─────────────────────────────────────────────────────────
export const SUB_SEGURO_VIDA = "c0000001-0009-4000-8000-000000000001";
export const SUB_SEGURO_VEHICULO = "c0000001-0009-4000-8000-000000000002";
export const SUB_SEGURO_HOGAR = "c0000001-0009-4000-8000-000000000003";
export const SUB_ARL = "c0000001-0009-4000-8000-000000000004";

// ── Ahorro e Inversión ──────────────────────────────────────────────
export const SUB_FONDO_EMERGENCIA = "c0000001-0010-4000-8000-000000000001";
export const SUB_CESANTIAS = "c0000001-0010-4000-8000-000000000002";
export const SUB_PENSION_VOLUNTARIA = "c0000001-0010-4000-8000-000000000003";
export const SUB_CDT_INVERSIONES = "c0000001-0010-4000-8000-000000000004";
export const SUB_AHORRO_PROGRAMADO = "c0000001-0010-4000-8000-000000000005";

// ── Educación ───────────────────────────────────────────────────────
export const SUB_MATRICULA = "c0000001-0011-4000-8000-000000000001";
export const SUB_UTILES = "c0000001-0011-4000-8000-000000000002";
export const SUB_CURSOS = "c0000001-0011-4000-8000-000000000003";
export const SUB_LIBROS = "c0000001-0011-4000-8000-000000000004";

// ── Entretenimiento ─────────────────────────────────────────────────
// NOTE: the parent id is `a0000001-0000-0000-0000-000000000006`, which is NOT a
// valid RFC 9562 UUID. Zod 4's `.uuid()` rejects it. Never run `.uuid()` over a
// parent chain that can reach it — use the permissive regex per CLAUDE.md.
// These four children are valid.
export const SUB_STREAMING = "c0000001-0012-4000-8000-000000000001";
export const SUB_CINE_EVENTOS = "c0000001-0012-4000-8000-000000000002";
export const SUB_HOBBIES = "c0000001-0012-4000-8000-000000000003";
export const SUB_SUSCRIPCIONES = "c0000001-0012-4000-8000-000000000004";

// ── Debt payment helpers ────────────────────────────────────────────
/**
 * Parent-zone fallback for a debt payment whose account type is unknown.
 * Prefer `getDebtPaymentCategoryId(accountType)`, which resolves to a leaf.
 */
export const DEBT_PAYMENT_CATEGORY_ID = CATEGORY_OBLIGACIONES;

/**
 * Category assigned to the source leg of a transfer.
 *
 * There is deliberately no "Transferencias" subcategory: a transfer is not a
 * kind of spending, it is a *flow class*. This constant is a placeholder until
 * `flow_class` lands (plan phase 2), at which point transfer legs carry
 * `flow_class = SELF_TRANSFER` and stop needing a category at all.
 */
export const TRANSFER_CATEGORY_ID = CATEGORY_OBLIGACIONES;

/** @deprecated Subscriptions are Entretenimiento › Suscripciones. Use `SUB_SUSCRIPCIONES`. */
export const SUBSCRIPTIONS_CATEGORY_ID = SUB_SUSCRIPCIONES;

/** @deprecated Renamed to `SUB_CUOTA_CREDITO`. */
export const SUBCATEGORY_CUOTA_CREDITO = SUB_CUOTA_CREDITO;
/** @deprecated Renamed to `SUB_PAGO_TARJETA`. */
export const SUBCATEGORY_PAGO_TARJETA = SUB_PAGO_TARJETA;

/**
 * Returns the debt payment subcategory for an account type.
 * CREDIT_CARD → "Tarjeta de crédito", LOAN → "Cuota crédito", else the parent zone.
 */
export function getDebtPaymentCategoryId(accountType: string): string {
  if (accountType === "CREDIT_CARD") return SUB_PAGO_TARJETA;
  if (accountType === "LOAN") return SUB_CUOTA_CREDITO;
  return DEBT_PAYMENT_CATEGORY_ID;
}

/**
 * Targets for the auto-categorization engine. **Every value must be a leaf.**
 *
 * Previously this map pointed at the 8 parent zones, and `autoCategorize`
 * guarded against parent ids — so every system rule was skipped and the engine
 * could only ever return a user-learned match. In production that left 915 of
 * 1198 `SYSTEM_DEFAULT` rows with no category at all.
 *
 * Two former keys are intentionally absent: `PAGOS_DEUDA` and `TRANSFERENCIAS`.
 * Those are flow classes wearing category costumes, which is why they had no
 * valid subcategory to point at. They live in `utils/flow-class.ts`.
 */
export const SUBCATEGORY_IDS = {
  // Hogar
  ARRIENDO: SUB_ARRIENDO,
  ADMINISTRACION: SUB_ADMINISTRACION,
  MERCADO: SUB_MERCADO,
  SERVICIOS_PUBLICOS: SUB_SERVICIOS_PUBLICOS,
  INTERNET: SUB_INTERNET,
  CELULAR: SUB_CELULAR,
  ARTICULOS_HOGAR: SUB_ARTICULOS_HOGAR,
  // Comer fuera
  RESTAURANTES: SUB_RESTAURANTES,
  DOMICILIOS: SUB_DOMICILIOS,
  CAFE_SNACKS: SUB_CAFE_SNACKS,
  // Transporte
  TRANSPORTE_PUBLICO: SUB_TRANSPORTE_PUBLICO,
  GASOLINA: SUB_GASOLINA,
  PEAJES: SUB_PEAJES,
  PARQUEADERO: SUB_PARQUEADERO,
  // Salud
  EPS: SUB_EPS,
  MEDICINA_PREPAGADA: SUB_MEDICINA_PREPAGADA,
  COPAGOS: SUB_COPAGOS,
  MEDICAMENTOS: SUB_MEDICAMENTOS,
  ODONTOLOGIA: SUB_ODONTOLOGIA,
  // Estilo de vida
  ROPA: SUB_ROPA,
  CUIDADO_PERSONAL: SUB_CUIDADO_PERSONAL,
  GYM_DEPORTE: SUB_GYM_DEPORTE,
  MASCOTAS: SUB_MASCOTAS,
  // Obligaciones
  IMPUESTOS: SUB_IMPUESTOS,
  PREDIAL: SUB_PREDIAL,
  SOAT: SUB_SOAT,
  TECNICOMECANICA: SUB_TECNICOMECANICA,
  // Seguros
  SEGURO_VIDA: SUB_SEGURO_VIDA,
  SEGURO_VEHICULO: SUB_SEGURO_VEHICULO,
  SEGURO_HOGAR: SUB_SEGURO_HOGAR,
  ARL: SUB_ARL,
  // Educación
  MATRICULA: SUB_MATRICULA,
  UTILES: SUB_UTILES,
  CURSOS: SUB_CURSOS,
  LIBROS: SUB_LIBROS,
  // Entretenimiento
  STREAMING: SUB_STREAMING,
  CINE_EVENTOS: SUB_CINE_EVENTOS,
  HOBBIES: SUB_HOBBIES,
  SUSCRIPCIONES: SUB_SUSCRIPCIONES,
  // Ingresos
  SALARIO: SUB_SALARIO,
  DIVIDENDOS: SUB_DIVIDENDOS,
} as const;
