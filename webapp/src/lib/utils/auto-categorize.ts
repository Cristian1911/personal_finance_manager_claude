/**
 * Auto-categorization engine for transaction descriptions.
 * Priority: user-learned rules (0.9) > system keywords (0.7).
 */

import type { Enums } from "@/types/database";

export type CategorizationSource = Enums<"categorization_source">;

export interface CategorizationResult {
  category_id: string;
  categorization_source: CategorizationSource;
  categorization_confidence: number;
}

export interface UserRule {
  pattern: string;
  category_id: string;
}

// Parent category UUIDs (from seed migrations)
const CAT = {
  HOGAR: "b0000001-0001-4000-8000-000000000001",
  ALIMENTACION: "b0000001-0001-4000-8000-000000000002",
  TRANSPORTE: "b0000001-0001-4000-8000-000000000003",
  SALUD: "b0000001-0001-4000-8000-000000000004",
  ESTILO_DE_VIDA: "b0000001-0001-4000-8000-000000000005",
  OBLIGACIONES: "b0000001-0001-4000-8000-000000000006",
  INGRESOS: "b0000001-0001-4000-8000-000000000007",
  OTROS_INGRESOS: "b0000001-0001-4000-8000-000000000008",
} as const;

// Keyword → category mapping. Order matters: first match wins.
const KEYWORD_RULES: { keywords: string[]; categoryId: string }[] = [
  // Hogar (Vivienda + Servicios)
  {
    keywords: [
      "arriendo", "alquiler", "hipoteca", "administracion",
      "inmobiliaria", "propiedad", "conjunto",
      "epm", "codensa", "vanti", "acueducto", "energia",
      "gas natural", "claro", "movistar", "tigo", "wom",
      "etb", "internet", "celular", "telefon",
    ],
    categoryId: CAT.HOGAR,
  },
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
  // Salud (Salud + Cuidado Personal)
  {
    keywords: [
      "drogueria", "farmacia", "eps", "medic", "clinica", "hospital",
      "laboratorio", "optica", "dental", "salud", "cruz verde",
      "farmatodo", "locatel", "colmedica", "sura eps",
      "peluqueria", "barberia", "salon", "spa", "manicure",
      "pedicure", "estetica", "cosmetico", "perfumeria",
    ],
    categoryId: CAT.SALUD,
  },
  // Estilo de vida (Educación + Entretenimiento + Compras + Suscripciones + Mascotas)
  {
    keywords: [
      "universidad", "colegio", "escuela", "curso", "udemy",
      "coursera", "platzi", "educacion", "matricula", "semestre",
      "libreria", "papeleria",
      "cine", "cinecolombia", "procinal", "teatro",
      "concierto", "boleta", "parque", "museo", "bar ",
      "discoteca", "juego", "steam", "playstation", "xbox",
      "falabella", "homecenter", "alkosto", "ktronix",
      "zara", "h&m", "nike", "adidas", "tienda",
      "mercadolibre", "amazon", "linio", "dafiti",
      "netflix", "spotify", "disney", "hbo", "amazon prime",
      "youtube", "apple", "google storage", "icloud", "chatgpt",
      "notion", "figma", "github", "suscripcion",
      "veterinar", "mascota", "pet ", "laika", "gabrica",
      "concentrado", "perro", "gato",
    ],
    categoryId: CAT.ESTILO_DE_VIDA,
  },
  // Obligaciones (Seguros + Impuestos + Pagos de Deuda)
  {
    keywords: [
      "seguro", "poliza", "sura", "bolivar", "allianz",
      "liberty", "mapfre", "axa",
      "impuesto", "dian", "predial", "retencion",
      "iva", "declaracion",
      "pago tarjeta", "pago credito", "cuota credito", "abono capital",
      "pago obligacion", "pago prestamo",
    ],
    categoryId: CAT.OBLIGACIONES,
  },
  // Ingresos (salario)
  {
    keywords: ["nomina", "salario", "sueldo", "pago mensual"],
    categoryId: CAT.INGRESOS,
  },
  // Otros ingresos (inversiones)
  {
    keywords: ["rendimiento", "dividendo", "interes ganado", "cdts"],
    categoryId: CAT.OTROS_INGRESOS,
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
  [CAT.HOGAR]: "Hogar",
  [CAT.ALIMENTACION]: "Alimentación",
  [CAT.TRANSPORTE]: "Transporte",
  [CAT.SALUD]: "Salud",
  [CAT.ESTILO_DE_VIDA]: "Estilo de vida",
  [CAT.OBLIGACIONES]: "Obligaciones",
  [CAT.INGRESOS]: "Ingresos",
  [CAT.OTROS_INGRESOS]: "Otros ingresos",
};

export function getCategoryName(categoryId: string): string {
  return CATEGORY_NAMES[categoryId] ?? "Sin categoría";
}
