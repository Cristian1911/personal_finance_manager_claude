/**
 * Auto-categorization engine for transaction descriptions.
 * Priority: user-learned rules (0.9) > system keywords (0.7).
 */

import type { CategorizationSource } from "../types/domain";

export interface CategorizationResult {
  category_id: string;
  categorization_source: CategorizationSource;
  categorization_confidence: number;
}

export interface UserRule {
  pattern: string;
  category_id: string;
}

// Seed category UUIDs (from seed migrations)
const CAT = {
  VIVIENDA: "a0000001-0001-4000-8000-000000000001",
  ALIMENTACION: "a0000001-0001-4000-8000-000000000002",
  TRANSPORTE: "a0000001-0001-4000-8000-000000000003",
  SERVICIOS: "a0000001-0001-4000-8000-000000000004",
  SALUD: "a0000001-0001-4000-8000-000000000005",
  EDUCACION: "a0000001-0001-4000-8000-000000000006",
  ENTRETENIMIENTO: "a0000001-0001-4000-8000-000000000007",
  COMPRAS: "a0000001-0001-4000-8000-000000000008",
  SUSCRIPCIONES: "a0000001-0001-4000-8000-000000000009",
  SEGUROS: "a0000001-0001-4000-8000-000000000010",
  IMPUESTOS: "a0000001-0001-4000-8000-000000000011",
  OTROS_GASTOS: "a0000001-0001-4000-8000-000000000012",
  SALARIO: "a0000001-0001-4000-8000-000000000013",
  FREELANCE: "a0000001-0001-4000-8000-000000000014",
  INVERSIONES: "a0000001-0001-4000-8000-000000000015",
  REGALOS: "a0000001-0001-4000-8000-000000000016",
  OTROS_INGRESOS: "a0000001-0001-4000-8000-000000000017",
  CUIDADO_PERSONAL: "a0000001-0001-4000-8000-000000000018",
  PAGOS_DEUDA: "a0000001-0001-4000-8000-000000000019",
  TRANSFERENCIAS: "a0000001-0001-4000-8000-000000000020",
  MASCOTAS: "a0000001-0001-4000-8000-000000000021",
} as const;

// Keyword → category mapping. Order matters: first match wins.
const KEYWORD_RULES: { keywords: string[]; categoryId: string }[] = [
  // Alimentación
  {
    keywords: [
      "exito", "carulla", "jumbo", "d1 ", "ara ", "olimpica", "surtimax",
      "mercado", "fruver", "panaderia", "restaurante", "comida",
      "rappi", "ifood", "domicilios", "mcdonalds", "burger",
      "subway", "crepes", "pollo", "pizza", "sushi", "cafe",
      "starbucks", "juan valdez", "tostao", "panadero",
    ],
    categoryId: CAT.ALIMENTACION,
  },
  // Transporte
  {
    keywords: [
      "uber", "didi", "beat", "indriver", "cabify", "taxi",
      "gasolina", "terpel", "primax", "texaco", "biomax",
      "peaje", "parqueadero", "estacionamiento", "soat",
      "metro ", "transmilenio", "sitp", "mio ",
    ],
    categoryId: CAT.TRANSPORTE,
  },
  // Servicios (utilities)
  {
    keywords: [
      "epm", "codensa", "vanti", "acueducto", "energia",
      "gas natural", "claro", "movistar", "tigo", "wom",
      "etb", "internet", "celular", "telefon",
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
      "concierto", "boleta", "parque", "museo", "bar ",
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
  // Pagos de Deuda
  {
    keywords: [
      "pago tarjeta", "pago credito", "cuota credito", "abono capital",
      "pago obligacion", "pago prestamo",
    ],
    categoryId: CAT.PAGOS_DEUDA,
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
      "veterinar", "mascota", "pet ", "laika", "gabrica",
      "concentrado", "perro", "gato",
    ],
    categoryId: CAT.MASCOTAS,
  },
  // Ingresos
  {
    keywords: ["nomina", "salario", "sueldo", "pago mensual"],
    categoryId: CAT.SALARIO,
  },
  {
    keywords: ["rendimiento", "dividendo", "interes ganado", "cdts"],
    categoryId: CAT.INVERSIONES,
  },
];

/**
 * Auto-categorize using user-learned rules first, then system keywords.
 * Pass userRules from the DB for personalized matching.
 */
export function autoCategorize(
  description: string,
  userRules?: UserRule[]
): CategorizationResult | null {
  const lower = description.toLowerCase();

  // 1. Check user-learned rules first (higher confidence)
  if (userRules && userRules.length > 0) {
    for (const rule of userRules) {
      if (lower.includes(rule.pattern)) {
        return {
          category_id: rule.category_id,
          categorization_source: "USER_LEARNED",
          categorization_confidence: 0.9,
        };
      }
    }
  }

  // 2. Fall back to system keyword rules
  for (const rule of KEYWORD_RULES) {
    for (const keyword of rule.keywords) {
      if (lower.includes(keyword)) {
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
