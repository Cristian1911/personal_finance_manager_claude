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
import {
  SUBCATEGORY_IDS as CAT,
  SUBCATEGORY_IDS as SUB,
  CATEGORY_HOGAR,
  CATEGORY_COMER_FUERA,
  CATEGORY_TRANSPORTE,
  CATEGORY_SALUD,
  CATEGORY_ESTILO_DE_VIDA,
  CATEGORY_OBLIGACIONES,
  CATEGORY_INGRESOS,
  CATEGORY_OTROS_INGRESOS,
} from "../constants/categories";

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

  // Separators. The dot matters for card descriptors like "Apple.Com/Bill" and
  // "Amazon.Com" — without it the whole thing stays one token and never matches.
  // Dates were already consumed above, so splitting on "." is safe here.
  s = s.replace(/[*/\\|#@.]/g, " ");

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
 * Check if `keyword` appears as a whole token in `normalized`.
 * Pads both sides with spaces so start/end of string is handled correctly.
 * Prevents false positives like "ara" matching "compra" or "tarjeta".
 *
 * Spanish plurals are matched too, in both directions: a singular keyword hits
 * its plural ("mascota" → "mascotas", "restaurante" → "restaurantes") and a
 * plural keyword hits its singular ("domicilios" → "domicilio"). Requiring an
 * exact token meant merchants written in the plural — the common case on a bank
 * statement — silently fell through.
 */
export function matchesWordBoundary(
  normalized: string,
  keyword: string
): boolean {
  const padded = " " + normalized + " ";
  if (padded.includes(" " + keyword + " ")) return true;
  if (padded.includes(" " + keyword + "s ")) return true;
  if (padded.includes(" " + keyword + "es ")) return true;
  if (keyword.endsWith("s") && padded.includes(" " + keyword.slice(0, -1) + " ")) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────
// Non-categorizable movements
// ─────────────────────────────────────────────────────────────────

/**
 * Movements that must never receive a category, whatever else the description
 * happens to contain. These are flow classes — debt payments, transfers between
 * the user's own accounts, cash withdrawals, bank charges — not consumption.
 *
 * Without this guard the merchant matcher latches onto incidental words in the
 * description. Measured against production: "RETIRO CAJERO ATM EDS TEXACO" was
 * being filed as Gasolina and "RETIRO CAJERO ATM EXITO PUERT" as Mercado — the
 * ATM's location, not a purchase.
 *
 * This mirrors `zeta_mcp_flow_class` in SQL. When `flow_class` is persisted
 * (plan phase 2) this list is replaced by a lookup on the stored class.
 */
const NON_CATEGORIZABLE: RegExp[] = [
  // Debt payments and credit operations
  /pago\s+(suc\s+virt\s+)?tc\b/,
  /pago\s+(tarjeta|alternativo\s+tarj)/,
  /abono\s+(a\s+)?capital/,
  /abono\s+mora/,
  /mora\s+tarjeta/,
  /ampliacion\s+de\s+plazo/,
  /renegociado/,
  // Cash
  /retiro\s+(cajero|atm|corresponsal)/,
  /avance\s+(sucursal|cajero)/,
  // Transfers between own accounts
  /^transferencia(s)?\s+(cta|a\s+nequi)/,
  /traslado\s+saldos/,
  // Bank charges and taxes on charges
  /impto\s+gobierno|4x1000/,
  /cobro\s+transf/,
  /comision\s+avance/,
  // `de?` required a literal "d", so the bare "cuota manejo" form never matched.
  /cuota\s+(de\s+)?manejo/,
  /ajuste\s+(manual|interes)/,
  /intereses?\s+mora/,
];

function isNonCategorizable(normalized: string): boolean {
  return NON_CATEGORIZABLE.some((re) => re.test(normalized));
}

// ─────────────────────────────────────────────────────────────────
// CAT-03: Regex Rules (pre-compiled, run against normalized description)
// ─────────────────────────────────────────────────────────────────

/**
 * Regex rules for multi-word patterns that keyword matching cannot handle.
 * Patterns run against the normalized description (already lowercased).
 * NOTE: No /i flag needed — input is already lowercase after normalizeForMatching.
 *
 * The former "Pagos de Deuda" rules (`pago tc`, `cuota credito`, `abono capital`)
 * are gone on purpose. Paying a card is not a category of spending, it is a flow
 * class — see `utils/flow-class.ts`. Keeping them here forced them to point at a
 * parent zone, which is what disabled the whole engine.
 */
const REGEX_RULES: { pattern: RegExp; categoryId: string }[] = [
  // Salario / Ingresos laborales
  { pattern: /nomina|salario|sueldo/, categoryId: CAT.SALARIO },

  // Rendimientos de inversión
  { pattern: /rendimientos?\s+(financiero|abonado)/, categoryId: CAT.DIVIDENDOS },
  { pattern: /pago\s+intereses?\s+cdt/, categoryId: CAT.DIVIDENDOS },

  // Servicios — gas natural (two words, needs regex)
  { pattern: /gas\s+natural/, categoryId: CAT.SERVICIOS_PUBLICOS },

  // Telecom. The Colombian carriers all sell mobile, home internet and TV under
  // one brand, so a bare "claro"/"movistar"/"tigo" cannot be placed — but the
  // qualifier that usually follows it can. Bare brands stay unmatched on purpose.
  { pattern: /(claro|movistar|tigo|etb)\s+(hogar|fijo|internet)/, categoryId: CAT.INTERNET },
  { pattern: /(claro|movistar|tigo)\s+(movil|celular)/, categoryId: CAT.CELULAR },

  // Seguros con producto explícito. Bare insurer names (sura, bolivar, allianz…)
  // are deliberately unmatched: the product is ambiguous and a wrong guess is
  // worse than none. User rules learn them on first manual categorization.
  { pattern: /seguros?\s+de\s+vida|plan\s+vida/, categoryId: CAT.SEGURO_VIDA },
  { pattern: /seguros?\s+(de\s+)?(vehiculo|auto|carro|moto)/, categoryId: CAT.SEGURO_VEHICULO },
  { pattern: /seguros?\s+(de\s+)?hogar/, categoryId: CAT.SEGURO_HOGAR },
];

// ─────────────────────────────────────────────────────────────────
// CAT-04: Keyword Rules (expanded + cleaned — no trailing spaces)
// ─────────────────────────────────────────────────────────────────

// Keyword → subcategory mapping. Order matters: first match wins, so the more
// specific bucket must come before the broader one that could also match
// ("amazon prime" before any generic streaming term, "sura eps" before "eps").
//
// Every target is a leaf. Keywords whose destination is genuinely ambiguous are
// left out rather than guessed at — an unmatched transaction shows up in the
// Categorizar inbox, a wrongly matched one silently skews a budget. Dropped for
// that reason: bare insurer names (sura, bolivar, allianz, liberty, mapfre, axa),
// bare telecom brands (claro, movistar, tigo, wom, etb — home internet vs mobile
// vs TV), marketplaces (mercadolibre, amazon, linio, tienda), and loose terms
// (optica, bar, discoteca, medic, salud, parque).
const KEYWORD_RULES: { keywords: string[]; categoryId: string }[] = [
  // ── Hogar › Mercado ─────────────────────────────────────────────
  // Supermarkets are groceries, not eating out. Migration 20260329121902
  // renamed Alimentación → Comer Fuera and moved these to Hogar.
  {
    keywords: [
      "exito", "carulla", "jumbo", "d1", "ara", "olimpica", "surtimax",
      "mercado", "supermercado", "minimercado", "autoservicio", "surtitodo",
      "fruver", "makro", "pricesmart", "dollarcity",
    ],
    categoryId: CAT.MERCADO,
  },
  // ── Comer Fuera › Domicilios ────────────────────────────────────
  {
    keywords: ["rappi", "ifood", "domicilios", "didi food"],
    categoryId: CAT.DOMICILIOS,
  },
  // ── Comer Fuera › Café/Snacks ───────────────────────────────────
  {
    keywords: [
      "cafe", "starbucks", "juan valdez", "tostao", "dunkin",
      "panaderia", "panadero", "reposteria", "pasteleria", "heladeria", "oma",
    ],
    categoryId: CAT.CAFE_SNACKS,
  },
  // ── Comer Fuera › Restaurantes ──────────────────────────────────
  {
    keywords: [
      "restaurante", "comida", "mcdonalds", "burger", "subway",
      "crepes", "pollo", "pizza", "sushi", "wok", "sandwich",
      "empanadas", "parrilla", "asadero", "fastfood", "hamburguesa", "arepas",
    ],
    categoryId: CAT.RESTAURANTES,
  },
  // ── Transporte › Gasolina ───────────────────────────────────────
  {
    keywords: ["gasolina", "terpel", "primax", "texaco", "biomax", "mobil", "eds"],
    categoryId: CAT.GASOLINA,
  },
  // ── Transporte › Peajes ─────────────────────────────────────────
  { keywords: ["peaje"], categoryId: CAT.PEAJES },
  // ── Transporte › Parqueadero ────────────────────────────────────
  { keywords: ["parqueadero", "estacionamiento"], categoryId: CAT.PARQUEADERO },
  // ── Transporte › Transporte público ─────────────────────────────
  {
    keywords: [
      "uber", "didi", "beat", "indriver", "indrive", "cabify", "taxi",
      "metro", "transmilenio", "sitp", "mio",
      // Prepaid transit cards. "civica" (Medellín) must be listed here and this
      // bucket must stay ahead of Celular, or "Recarga de Tarjeta Civica" is
      // filed as a phone top-up.
      "civica", "tullave", "tarjeta civica",
    ],
    categoryId: CAT.TRANSPORTE_PUBLICO,
  },
  // ── Hogar › Servicios públicos ──────────────────────────────────
  {
    keywords: ["epm", "codensa", "vanti", "acueducto", "energia", "afinia", "air-e"],
    categoryId: CAT.SERVICIOS_PUBLICOS,
  },
  // ── Hogar › Internet ────────────────────────────────────────────
  { keywords: ["internet", "banda ancha", "fibra optica"], categoryId: CAT.INTERNET },
  // ── Hogar › Celular ─────────────────────────────────────────────
  // "wom" is safe here: it is a mobile-only operator. Claro/Movistar/Tigo/ETB
  // are handled by the qualifier regexes above, not by bare brand name.
  { keywords: ["celular", "telefon", "plan movil", "recarga celular", "wom"], categoryId: CAT.CELULAR },
  // ── Hogar › Arriendo ────────────────────────────────────────────
  {
    keywords: ["arriendo", "alquiler", "hipoteca", "inmobiliaria"],
    categoryId: CAT.ARRIENDO,
  },
  // ── Hogar › Administración ──────────────────────────────────────
  { keywords: ["administracion", "conjunto residencial"], categoryId: CAT.ADMINISTRACION },
  // ── Hogar › Artículos hogar ─────────────────────────────────────
  {
    keywords: ["homecenter", "alkosto", "alkomprar", "ktronix", "falabella", "corona", "easy"],
    categoryId: CAT.ARTICULOS_HOGAR,
  },
  // ── Salud › EPS (before "prepagada", both can say "sura") ───────
  { keywords: ["sura eps", "eps", "sanitas", "nueva eps"], categoryId: CAT.EPS },
  // ── Salud › Medicina prepagada ──────────────────────────────────
  { keywords: ["colmedica", "medicina prepagada", "prepagada"], categoryId: CAT.MEDICINA_PREPAGADA },
  // ── Salud › Medicamentos ────────────────────────────────────────
  {
    keywords: ["drogueria", "farmacia", "cruz verde", "farmatodo", "locatel", "copidrogas"],
    categoryId: CAT.MEDICAMENTOS,
  },
  // ── Salud › Odontología ─────────────────────────────────────────
  { keywords: ["dental", "odontolog", "ortodoncia"], categoryId: CAT.ODONTOLOGIA },
  // ── Salud › Copagos ─────────────────────────────────────────────
  { keywords: ["clinica", "hospital", "hosp", "laboratorio", "copago", "ips"], categoryId: CAT.COPAGOS },
  // ── Educación › Cursos ──────────────────────────────────────────
  {
    keywords: ["curso", "udemy", "coursera", "platzi", "capacitacion"],
    categoryId: CAT.CURSOS,
  },
  // ── Educación › Matrícula ───────────────────────────────────────
  {
    keywords: ["universidad", "univ", "colegio", "escuela", "educacion", "matricula",
      "semestre", "sapiencia", "pension escolar"],
    categoryId: CAT.MATRICULA,
  },
  // ── Educación › Libros ──────────────────────────────────────────
  { keywords: ["libreria", "libro"], categoryId: CAT.LIBROS },
  // ── Educación › Útiles ──────────────────────────────────────────
  { keywords: ["papeleria", "utiles escolares"], categoryId: CAT.UTILES },
  // ── Entretenimiento › Streaming ─────────────────────────────────
  {
    keywords: [
      "netflix", "spotify", "disney", "hbo", "max", "amazon prime",
      "youtube", "crunchyroll", "paramount", "hbomax",
    ],
    categoryId: CAT.STREAMING,
  },
  // ── Entretenimiento › Suscripciones ─────────────────────────────
  {
    keywords: [
      "apple", "google storage", "google one", "icloud", "chatgpt", "openai",
      "anthropic", "claude", "notion", "figma", "github", "supabase",
      "hostinger", "microsoft", "patreon", "suscripcion",
    ],
    categoryId: CAT.SUSCRIPCIONES,
  },
  // ── Entretenimiento › Cine/Eventos ──────────────────────────────
  {
    keywords: ["cine", "cinecolombia", "procinal", "teatro", "concierto", "boleta", "museo"],
    categoryId: CAT.CINE_EVENTOS,
  },
  // ── Entretenimiento › Hobbies ───────────────────────────────────
  { keywords: ["steam", "steamgames", "epic games", "playstation", "xbox", "nintendo"], categoryId: CAT.HOBBIES },
  // ── Obligaciones › SOAT / Tecnicomecánica / Predial ─────────────
  { keywords: ["soat"], categoryId: CAT.SOAT },
  { keywords: ["tecnicomecanica", "revision tecnico"], categoryId: CAT.TECNICOMECANICA },
  { keywords: ["predial"], categoryId: CAT.PREDIAL },
  // ── Obligaciones › Impuestos ────────────────────────────────────
  {
    keywords: ["impuesto", "dian", "retencion", "iva", "declaracion"],
    categoryId: CAT.IMPUESTOS,
  },
  // ── Estilo de vida › Ropa ───────────────────────────────────────
  {
    keywords: ["zara", "h&m", "nike", "adidas", "dafiti", "koaj", "arturo calle", "mango"],
    categoryId: CAT.ROPA,
  },
  // ── Estilo de vida › Cuidado personal ───────────────────────────
  {
    keywords: [
      "peluqueria", "barberia", "salon", "spa", "manicure",
      "pedicure", "estetica", "cosmetico", "perfumeria",
    ],
    categoryId: CAT.CUIDADO_PERSONAL,
  },
  // ── Estilo de vida › Gym/Deporte ────────────────────────────────
  { keywords: ["gimnasio", "smartfit", "bodytech", "crossfit"], categoryId: CAT.GYM_DEPORTE },
  // ── Estilo de vida › Mascotas ───────────────────────────────────
  {
    keywords: [
      "veterinaria", "veterinario", "mascota", "pet", "laika", "gabrica",
      "concentrado", "perro", "gato",
    ],
    categoryId: CAT.MASCOTAS,
  },
  // ── Otros ingresos › Dividendos (regex rules at 0.8 run first) ──
  {
    keywords: ["rendimiento", "dividendo", "interes ganado", "cdts"],
    categoryId: CAT.DIVIDENDOS,
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

  // Flow-class movements never get a category, even if a merchant token appears
  // in the description (an ATM sited at a gas station is not a fuel purchase).
  // Runs after user rules so an explicit user decision still wins.
  if (isNonCategorizable(normalized)) return null;

  // 2. Regex rules — multi-word patterns, 0.8
  for (const rule of REGEX_RULES) {
    if (rule.pattern.test(normalized)) {
      return {
        category_id: rule.categoryId,
        categorization_source: "SYSTEM_DEFAULT",
        categorization_confidence: 0.8,
      };
    }
  }

  // 3. Keyword rules — single merchant tokens, 0.7
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
 * Human-readable name for a seed category UUID — parent zones and leaves alike.
 *
 * The Categorizar inbox renders suggestion labels through this map
 * (`inbox-transaction-row.tsx:353`), and every suggestion now targets a leaf, so
 * leaving the leaves out would show "Sin categoría" on every single suggestion.
 * Names mirror `name_es` in the seeded `categories` rows.
 */
const CATEGORY_NAMES: Record<string, string> = {
  // Parent zones
  [CATEGORY_HOGAR]: "Hogar",
  [CATEGORY_COMER_FUERA]: "Comer Fuera",
  [CATEGORY_TRANSPORTE]: "Transporte",
  [CATEGORY_SALUD]: "Salud",
  [CATEGORY_ESTILO_DE_VIDA]: "Estilo de vida",
  [CATEGORY_OBLIGACIONES]: "Obligaciones",
  [CATEGORY_INGRESOS]: "Ingresos",
  [CATEGORY_OTROS_INGRESOS]: "Otros ingresos",
  // Hogar
  [SUB.ARRIENDO]: "Arriendo/Hipoteca",
  [SUB.ADMINISTRACION]: "Administración",
  [SUB.MERCADO]: "Mercado",
  [SUB.SERVICIOS_PUBLICOS]: "Servicios públicos",
  [SUB.INTERNET]: "Internet",
  [SUB.CELULAR]: "Celular",
  [SUB.ARTICULOS_HOGAR]: "Artículos hogar",
  // Comer Fuera
  [SUB.RESTAURANTES]: "Restaurantes",
  [SUB.DOMICILIOS]: "Domicilios",
  [SUB.CAFE_SNACKS]: "Café/Snacks",
  // Transporte
  [SUB.TRANSPORTE_PUBLICO]: "Transporte público",
  [SUB.GASOLINA]: "Gasolina",
  [SUB.PEAJES]: "Peajes",
  [SUB.PARQUEADERO]: "Parqueadero",
  // Salud
  [SUB.EPS]: "EPS",
  [SUB.MEDICINA_PREPAGADA]: "Medicina prepagada",
  [SUB.COPAGOS]: "Copagos",
  [SUB.MEDICAMENTOS]: "Medicamentos",
  [SUB.ODONTOLOGIA]: "Odontología",
  // Estilo de vida
  [SUB.ROPA]: "Ropa",
  [SUB.CUIDADO_PERSONAL]: "Cuidado personal",
  [SUB.GYM_DEPORTE]: "Gym/Deporte",
  [SUB.MASCOTAS]: "Mascotas",
  // Obligaciones
  [SUB.IMPUESTOS]: "Impuestos",
  [SUB.PREDIAL]: "Predial",
  [SUB.SOAT]: "SOAT",
  [SUB.TECNICOMECANICA]: "Tecnicomecánica",
  // Seguros
  [SUB.SEGURO_VIDA]: "Seguro de vida",
  [SUB.SEGURO_VEHICULO]: "Seguro vehículo",
  [SUB.SEGURO_HOGAR]: "Seguro hogar",
  [SUB.ARL]: "ARL",
  // Educación
  [SUB.MATRICULA]: "Matrícula/Pensión",
  [SUB.UTILES]: "Útiles/Materiales",
  [SUB.CURSOS]: "Cursos/Capacitación",
  [SUB.LIBROS]: "Libros",
  // Entretenimiento
  [SUB.STREAMING]: "Streaming",
  [SUB.CINE_EVENTOS]: "Cine/Eventos",
  [SUB.HOBBIES]: "Hobbies",
  [SUB.SUSCRIPCIONES]: "Suscripciones",
  // Ingresos
  [SUB.SALARIO]: "Salario",
  [SUB.DIVIDENDOS]: "Dividendos",
};

export function getCategoryName(categoryId: string): string {
  return CATEGORY_NAMES[categoryId] ?? "Sin categoría";
}
