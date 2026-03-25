/**
 * Auto-categorization engine for transaction descriptions.
 * Priority: user-learned rules (0.9) > regex rules (0.8) > system keywords (0.7).
 *
 * Improvements (CAT-01 to CAT-04):
 * - CAT-01: normalizeForMatching() strips accents, noise tokens, auth codes, NIT refs
 * - CAT-02: matchesWordBoundary() prevents false positives (e.g., "ara" in "compra"/"tarjeta")
 * - CAT-03: REGEX_RULES for multi-word patterns (nomina, pago tc, cuota credito, etc.)
 * - CAT-04: Expanded Colombian merchant keywords, trailing-space cleanup
 */

import type { CategorizationSource } from "../types/domain";
import { SEED_CATEGORY_IDS as CAT } from "../constants/categories";

export interface CategorizationResult {
  category_id: string;
  categorization_source: CategorizationSource;
  categorization_confidence: number;
}

export interface UserRule {
  pattern: string;
  category_id: string;
}

// ─────────────────────────────────────────────────────────────────
// CAT-01: Normalization
// ─────────────────────────────────────────────────────────────────

/**
 * Normalize a raw bank description for matching:
 * 1. Lowercase
 * 2. Remove accents (NFD decomposition)
 * 3. Strip noise tokens (bank prefixes, NIT refs, auth codes, separators)
 * 4. Collapse whitespace
 */
export function normalizeForMatching(raw: string): string {
  let s = raw.toLowerCase();

  // Step 2: Remove accents
  s = s.normalize("NFD").replace(/\p{Diacritic}/gu, "");

  // Step 3: Strip noise tokens

  // Bank transaction prefixes (order matters — longer patterns first)
  s = s.replace(/debito\s+automatico\s+/gi, " ");
  s = s.replace(/transferencia\s+(a|de|en)\s+/gi, " ");
  s = s.replace(/compra\s+(en|de)\s+/gi, " ");
  s = s.replace(/pago\s+(en|a|de)\s+/gi, " ");
  s = s.replace(/retiro\s+(en|de)\s+/gi, " ");
  s = s.replace(/abono\s+(de|a|en)\s+/gi, " ");

  // NIT/ID references
  s = s.replace(/\b(nit|cc|ce)\s*:?\s*\d+/gi, " ");

  // Auth codes (standalone 4+ digit sequences)
  s = s.replace(/\b\d{4,}\b/g, " ");

  // Dates like 12/03/2024 or 12-03-24
  s = s.replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, " ");

  // Separators
  s = s.replace(/[*/\\|#@]/g, " ");

  // City names that add noise (Colombia-specific)
  s = s.replace(
    /\b(bogota|medellin|cali|barranquilla|cartagena|bucaramanga)\b/gi,
    " "
  );
  s = s.replace(/\b(col|co|colombia)\b/gi, " ");

  // Step 4: Collapse whitespace
  s = s.replace(/\s{2,}/g, " ").trim();

  return s;
}

// ─────────────────────────────────────────────────────────────────
// CAT-02: Word Boundary Matching
// ─────────────────────────────────────────────────────────────────

/**
 * Check if `keyword` appears at a word boundary in `normalized`.
 * Pads both sides with spaces so start/end of string is handled correctly.
 * Prevents false positives like "ara" matching "compra" or "tarjeta".
 */
export function matchesWordBoundary(
  normalized: string,
  keyword: string
): boolean {
  const padded = " " + normalized + " ";
  return padded.includes(" " + keyword + " ");
}

// ─────────────────────────────────────────────────────────────────
// CAT-03: Regex Rules (pre-compiled, run against normalized description)
// ─────────────────────────────────────────────────────────────────

/**
 * Regex rules for multi-word patterns that keyword matching cannot handle.
 * Patterns run against the normalized description (already lowercased).
 * NOTE: No /i flag needed — input is already lowercase after normalizeForMatching.
 */
const REGEX_RULES: { pattern: RegExp; categoryId: string }[] = [
  // Pagos de Deuda
  { pattern: /pago\s+(tc|tarjeta|credito|cred|obligacion|prestamo)/, categoryId: CAT.PAGOS_DEUDA },
  { pattern: /cuota\s+(credito|prestamo)/, categoryId: CAT.PAGOS_DEUDA },
  { pattern: /abono\s+capital/, categoryId: CAT.PAGOS_DEUDA },

  // Salario / Ingresos laborales
  { pattern: /nomina|salario|sueldo/, categoryId: CAT.SALARIO },

  // Inversiones
  { pattern: /rendimientos?\s+(financiero|abonado)/, categoryId: CAT.INVERSIONES },
  { pattern: /pago\s+intereses?\s+cdt/, categoryId: CAT.INVERSIONES },

  // Servicios — gas natural (two words, needs regex)
  { pattern: /gas\s+natural/, categoryId: CAT.SERVICIOS },
];

// ─────────────────────────────────────────────────────────────────
// CAT-04: Keyword Rules (expanded + cleaned — no trailing spaces)
// ─────────────────────────────────────────────────────────────────

// Keyword → category mapping. Order matters: first match wins.
// All keywords are trimmed (no leading/trailing whitespace — see D-05).
const KEYWORD_RULES: { keywords: string[]; categoryId: string }[] = [
  // Alimentación
  {
    keywords: [
      // Supermarkets
      "exito", "carulla", "jumbo", "d1", "ara", "olimpica", "surtimax",
      // General grocery
      "mercado", "fruver", "panaderia", "restaurante", "comida",
      // Food delivery
      "rappi", "ifood", "domicilios",
      // Fast food chains
      "mcdonalds", "burger", "subway", "crepes", "pollo", "pizza", "sushi",
      // Coffee shops
      "cafe", "starbucks", "juan valdez", "tostao", "panadero",
    ],
    categoryId: CAT.ALIMENTACION,
  },
  // Transporte
  {
    keywords: [
      // Ride-sharing
      "uber", "didi", "beat", "indriver", "indrive", "cabify", "taxi",
      // Fuel
      "gasolina", "terpel", "primax", "texaco", "biomax",
      // Parking and tolls
      "peaje", "parqueadero", "estacionamiento", "soat",
      // Mass transit
      "metro", "transmilenio", "sitp", "mio",
    ],
    categoryId: CAT.TRANSPORTE,
  },
  // Servicios (utilities + telecom)
  {
    keywords: [
      // Utilities
      "epm", "codensa", "vanti", "acueducto", "energia",
      // Telecom
      "claro", "movistar", "tigo", "wom", "etb",
      // Generic
      "internet", "celular", "telefon",
    ],
    categoryId: CAT.SERVICIOS,
  },
  // Salud
  {
    keywords: [
      "drogueria", "farmacia", "eps", "medic", "clinica", "hospital",
      "laboratorio", "optica", "dental", "salud", "cruz verde",
      "farmatodo", "locatel", "colmedica", "sura eps",
    ],
    categoryId: CAT.SALUD,
  },
  // Educación
  {
    keywords: [
      "universidad", "colegio", "escuela", "curso", "udemy",
      "coursera", "platzi", "educacion", "matricula", "semestre",
      "libreria", "papeleria",
    ],
    categoryId: CAT.EDUCACION,
  },
  // Suscripciones
  {
    keywords: [
      "netflix", "spotify", "disney", "hbo", "amazon prime",
      "youtube", "apple", "google storage", "icloud", "chatgpt",
      "notion", "figma", "github", "suscripcion",
    ],
    categoryId: CAT.SUSCRIPCIONES,
  },
  // Entretenimiento
  {
    keywords: [
      "cine", "cinecolombia", "procinal", "teatro",
      "concierto", "boleta", "parque", "museo", "bar",
      "discoteca", "juego", "steam", "playstation", "xbox",
    ],
    categoryId: CAT.ENTRETENIMIENTO,
  },
  // Seguros
  {
    keywords: [
      "seguro", "poliza", "sura", "bolivar", "allianz",
      "liberty", "mapfre", "axa",
    ],
    categoryId: CAT.SEGUROS,
  },
  // Vivienda
  {
    keywords: [
      "arriendo", "alquiler", "hipoteca", "administracion",
      "inmobiliaria", "propiedad", "conjunto",
    ],
    categoryId: CAT.VIVIENDA,
  },
  // Impuestos
  {
    keywords: [
      "impuesto", "dian", "predial", "retencion",
      "iva", "declaracion",
    ],
    categoryId: CAT.IMPUESTOS,
  },
  // Compras
  {
    keywords: [
      "falabella", "homecenter", "alkosto", "ktronix",
      "zara", "h&m", "nike", "adidas", "tienda",
      "mercadolibre", "amazon", "linio", "dafiti",
    ],
    categoryId: CAT.COMPRAS,
  },
  // Cuidado Personal
  {
    keywords: [
      "peluqueria", "barberia", "salon", "spa", "manicure",
      "pedicure", "estetica", "cosmetico", "perfumeria",
    ],
    categoryId: CAT.CUIDADO_PERSONAL,
  },
  // Transferencias
  {
    keywords: [
      "transferencia", "envio dinero", "nequi", "daviplata", "pse",
    ],
    categoryId: CAT.TRANSFERENCIAS,
  },
  // Mascotas
  {
    keywords: [
      "veterinar", "mascota", "pet", "laika", "gabrica",
      "concentrado", "perro", "gato",
    ],
    categoryId: CAT.MASCOTAS,
  },
  // Ingresos keyword fallbacks (regex rules at 0.8 handle these first)
  {
    keywords: ["rendimiento", "dividendo", "interes ganado", "cdts"],
    categoryId: CAT.INVERSIONES,
  },
];

/**
 * Auto-categorize using user-learned rules first, then regex rules, then system keywords.
 * Pass userRules from the DB for personalized matching.
 *
 * Priority:
 * 1. User-learned rules at 0.9
 * 2. REGEX_RULES at 0.8 (NEW — multi-word patterns)
 * 3. KEYWORD_RULES at 0.7 (word-boundary matched)
 */
export function autoCategorize(
  description: string,
  userRules?: UserRule[]
): CategorizationResult | null {
  const normalized = normalizeForMatching(description);

  // 1. Check user-learned rules first (highest confidence)
  if (userRules && userRules.length > 0) {
    for (const rule of userRules) {
      if (normalized.includes(rule.pattern)) {
        return {
          category_id: rule.category_id,
          categorization_source: "USER_LEARNED",
          categorization_confidence: 0.9,
        };
      }
    }
  }

  // 2. Check regex rules (new — fires before keyword rules)
  for (const rule of REGEX_RULES) {
    if (rule.pattern.test(normalized)) {
      return {
        category_id: rule.categoryId,
        categorization_source: "SYSTEM_DEFAULT",
        categorization_confidence: 0.8,
      };
    }
  }

  // 3. Fall back to system keyword rules (word-boundary matched)
  for (const rule of KEYWORD_RULES) {
    for (const keyword of rule.keywords) {
      if (matchesWordBoundary(normalized, keyword)) {
        return {
          category_id: rule.categoryId,
          categorization_source: "SYSTEM_DEFAULT",
          categorization_confidence: 0.7,
        };
      }
    }
  }

  return null;
}

/**
 * Get a human-readable category name for a seed category UUID.
 */
const CATEGORY_NAMES: Record<string, string> = {
  [CAT.VIVIENDA]: "Vivienda",
  [CAT.ALIMENTACION]: "Alimentación",
  [CAT.TRANSPORTE]: "Transporte",
  [CAT.SERVICIOS]: "Servicios",
  [CAT.SALUD]: "Salud",
  [CAT.EDUCACION]: "Educación",
  [CAT.ENTRETENIMIENTO]: "Entretenimiento",
  [CAT.COMPRAS]: "Compras",
  [CAT.SUSCRIPCIONES]: "Suscripciones",
  [CAT.SEGUROS]: "Seguros",
  [CAT.IMPUESTOS]: "Impuestos",
  [CAT.OTROS_GASTOS]: "Otros Gastos",
  [CAT.SALARIO]: "Salario",
  [CAT.FREELANCE]: "Freelance",
  [CAT.INVERSIONES]: "Inversiones",
  [CAT.REGALOS]: "Regalos",
  [CAT.OTROS_INGRESOS]: "Otros Ingresos",
  [CAT.CUIDADO_PERSONAL]: "Cuidado Personal",
  [CAT.PAGOS_DEUDA]: "Pagos de Deuda",
  [CAT.TRANSFERENCIAS]: "Transferencias",
  [CAT.MASCOTAS]: "Mascotas",
};

export function getCategoryName(categoryId: string): string {
  return CATEGORY_NAMES[categoryId] ?? "Sin categoría";
}
