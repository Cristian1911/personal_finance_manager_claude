/**
 * Auto-categorization engine for Bancolombia transaction descriptions.
 * Maps keywords to seed category UUIDs. Returns category_id + confidence.
 */

export interface CategorizationResult {
  category_id: string;
  categorization_source: "SYSTEM_DEFAULT";
  categorization_confidence: number;
}

// Seed category UUIDs (from seed migration)
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
} as const;

// Keyword → category mapping. Order matters: first match wins.
// Keywords are matched case-insensitively against the raw description.
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
 * Attempt to auto-categorize a transaction based on its description.
 * Returns null if no keyword match is found.
 */
export function autoCategorize(description: string): CategorizationResult | null {
  const lower = description.toLowerCase();

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
};

export function getCategoryName(categoryId: string): string {
  return CATEGORY_NAMES[categoryId] ?? "Sin categoría";
}
