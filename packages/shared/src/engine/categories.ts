/**
 * The 25 v2 categories (docs/mlp/07-category-eval-baselines.md, "compact list";
 * build plan §7). Built into the app; seeded on the v2 server with these ids
 * (supabase/v2/seed-categories.sql). Pago de tarjeta, préstamos entre personas
 * and own-account moves are flow types in Disponible, kept for labels.
 */
export interface V2Category {
  id: string;
  name: string;
  group: string;
  direction: "OUTFLOW" | "INFLOW";
  /** Shown in the picker (flow types aren't picked by hand). */
  pickable: boolean;
}

const c = (n: number, name: string, group: string, direction: "OUTFLOW" | "INFLOW" = "OUTFLOW", pickable = true): V2Category => ({
  id: `c2000000-0000-4000-8000-${String(n).padStart(12, "0")}`, name, group, direction, pickable,
});

export const V2_CATEGORIES: readonly V2Category[] = [
  c(1, "Mercado", "Comida"), c(2, "Restaurantes y café", "Comida"), c(3, "Domicilios", "Comida"),
  c(4, "Apps y taxis", "Transporte"), c(5, "Transporte público", "Transporte"), c(6, "Carro y moto", "Transporte"),
  c(7, "Vivienda", "Hogar"), c(8, "Servicios", "Hogar"), c(9, "Casa y mantenimiento", "Hogar"),
  c(10, "Salud", "Salud"), c(11, "Mascotas", "Mascotas"), c(12, "Suscripciones", "Suscripciones"), c(13, "Compras", "Compras"),
  c(14, "Entretenimiento y hobbies", "Ocio"), c(15, "Viajes", "Ocio"),
  c(16, "Regalos", "Personas"), c(17, "Cuidado personal y deporte", "Personal"), c(18, "Educación", "Educación"),
  c(19, "Pago de tarjeta o crédito", "Finanzas", "OUTFLOW", false), c(20, "Intereses, comisiones e impuestos", "Finanzas"),
  c(21, "Préstamos entre personas", "Finanzas", "OUTFLOW", false), c(22, "Ahorro e inversión", "Finanzas"),
  c(23, "Salario", "Ingresos", "INFLOW"), c(24, "Otros ingresos", "Ingresos", "INFLOW"),
  c(25, "Efectivo y otros", "Otros"),
];

const BY_ID = new Map(V2_CATEGORIES.map((x) => [x.id, x]));
export const categoryById = (id: string | null | undefined): V2Category | null => (id ? BY_ID.get(id) ?? null : null);
export const isV2Category = (id: string): boolean => BY_ID.has(id);
