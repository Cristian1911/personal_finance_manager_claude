import { describe, it, expect } from "vitest";
import { autoCategorize } from "../auto-categorize";
import { SUBCATEGORY_IDS as CAT } from "../../constants/categories";

// System (regex + keyword) rules used to be skipped wholesale: every
// SEED_CATEGORY_IDS target aliased a parent zone id and the PARENT_ZONE_IDS
// guard dropped those, so the engine could only ever return a user-learned
// match. In production that left 915 of 1198 SYSTEM_DEFAULT rows uncategorized.
// The rules now target leaf subcategories and the guard is gone, so every suite
// below runs for real.

// ─────────────────────────────────────────────────────────────────
// CAT-01: Normalization — accent removal, noise token stripping
// ─────────────────────────────────────────────────────────────────
describe("CAT-01: Normalization", () => {
  it("matches 'COMPRA EN EXITO BOGOTA 12345' -> Mercado (noise strip)", () => {
    const result = autoCategorize("COMPRA EN EXITO BOGOTA 12345");
    expect(result?.category_id).toBe(CAT.MERCADO);
  });

  it("matches 'COMPRA EN ÉXITO' after accent removal", () => {
    expect(autoCategorize("COMPRA EN ÉXITO")?.category_id).toBe(CAT.MERCADO);
  });

  it("matches 'PAGO EN CLARO*MOVIL NIT:123456' -> Celular via the qualifier", () => {
    expect(autoCategorize("PAGO EN CLARO*MOVIL NIT:123456")?.category_id).toBe(CAT.CELULAR);
  });

  it("matches 'Transferencia a RAPPI*McDonald' -> Domicilios", () => {
    expect(autoCategorize("Transferencia a RAPPI*McDonald")?.category_id).toBe(CAT.DOMICILIOS);
  });

  it("matches 'PAGO DE NETFLIX SUSCRIPCION' -> Streaming (before the generic bucket)", () => {
    expect(autoCategorize("PAGO DE NETFLIX SUSCRIPCION")?.category_id).toBe(CAT.STREAMING);
  });

  it("strips NIT references before matching", () => {
    expect(autoCategorize("CODENSA NIT:860007738")?.category_id).toBe(CAT.SERVICIOS_PUBLICOS);
  });

  it("strips auth codes (4+ digit sequences) before matching", () => {
    expect(autoCategorize("UBER 9876543 VIAJE BOGOTA")?.category_id).toBe(CAT.TRANSPORTE_PUBLICO);
  });
});

// ─────────────────────────────────────────────────────────────────
// CAT-02: Word Boundary Matching
// ─────────────────────────────────────────────────────────────────
describe("CAT-02: Word Boundary Matching", () => {
  it("'supermercado ara kennedy' matches 'ara' -> Mercado", () => {
    expect(autoCategorize("supermercado ara kennedy")?.category_id).toBe(CAT.MERCADO);
  });

  it("'compra tarjeta' does NOT match 'ara' (substring of 'tarjeta')", () => {
    const result = autoCategorize("compra tarjeta");
    if (result !== null) expect(result.category_id).not.toBe(CAT.MERCADO);
  });

  it("'d1 kennedy' matches 'd1' at start -> Mercado", () => {
    expect(autoCategorize("d1 kennedy")?.category_id).toBe(CAT.MERCADO);
  });

  it("'tienda d1' matches 'd1' at end -> Mercado", () => {
    expect(autoCategorize("tienda d1")?.category_id).toBe(CAT.MERCADO);
  });

  it("'metro medellin' matches 'metro' -> Transporte público", () => {
    expect(autoCategorize("metro medellin")?.category_id).toBe(CAT.TRANSPORTE_PUBLICO);
  });

  it("'metropolitano cable' does NOT match 'metro' (substring)", () => {
    const result = autoCategorize("metropolitano cable");
    if (result !== null) expect(result.category_id).not.toBe(CAT.TRANSPORTE_PUBLICO);
  });

  it("'mio cali transmilenio' matches 'mio' -> Transporte público", () => {
    expect(autoCategorize("mio cali transmilenio")?.category_id).toBe(CAT.TRANSPORTE_PUBLICO);
  });

  it("'embarque aereo' matches nothing (no 'bar' substring hit)", () => {
    expect(autoCategorize("embarque aereo")).toBeNull();
  });

  it("'pet store mascotas' matches 'pet' -> Mascotas", () => {
    expect(autoCategorize("pet store mascotas")?.category_id).toBe(CAT.MASCOTAS);
  });
});

// ─────────────────────────────────────────────────────────────────
// CAT-03: Regex Rules (fire at confidence 0.8)
// ─────────────────────────────────────────────────────────────────
describe("CAT-03: Regex Rules", () => {
  it("'pago nomina enero' -> Salario at 0.8", () => {
    const result = autoCategorize("pago nomina enero");
    expect(result?.category_id).toBe(CAT.SALARIO);
    expect(result?.categorization_confidence).toBe(0.8);
    expect(result?.categorization_source).toBe("SYSTEM_DEFAULT");
  });

  it("'pago salario mensual' -> Salario at 0.8", () => {
    expect(autoCategorize("pago salario mensual")?.category_id).toBe(CAT.SALARIO);
  });

  it("'rendimientos financieros abonados' -> Dividendos at 0.8", () => {
    const result = autoCategorize("rendimientos financieros abonados");
    expect(result?.category_id).toBe(CAT.DIVIDENDOS);
    expect(result?.categorization_confidence).toBe(0.8);
  });

  it("'gas natural domiciliario' -> Servicios públicos at 0.8", () => {
    expect(autoCategorize("gas natural domiciliario")?.category_id).toBe(CAT.SERVICIOS_PUBLICOS);
  });

  it("'seguro de vida sura' -> Seguro de vida (product qualifier wins over bare insurer)", () => {
    expect(autoCategorize("seguro de vida sura")?.category_id).toBe(CAT.SEGURO_VIDA);
  });

  it("'seguro vehiculo bolivar' -> Seguro vehículo", () => {
    expect(autoCategorize("seguro vehiculo bolivar")?.category_id).toBe(CAT.SEGURO_VEHICULO);
  });

  it("user-learned rules outrank regex rules", () => {
    const userRules = [{ pattern: "pago nomina", category_id: CAT.MERCADO }];
    const result = autoCategorize("pago nomina enero", userRules);
    expect(result?.category_id).toBe(CAT.MERCADO);
    expect(result?.categorization_confidence).toBe(0.9);
  });
});

// ─────────────────────────────────────────────────────────────────
// Flow-class descriptions must NOT be categorized
// ─────────────────────────────────────────────────────────────────
// Paying a card, transferring between own accounts and taking a cash advance
// are flow classes, not categories. They used to point at the Obligaciones
// parent zone, which is exactly what forced the engine-wide guard. They belong
// to utils/flow-class.ts and must return null here.
describe("Flow-class movements return null", () => {
  it.each([
    "PAGO SUC VIRT TC VISA",
    "PAGO SUC VIRT TC AMEX PESOS",
    "pago tc visa",
    "cuota credito hipotecario",
    "abono capital prestamo",
    "TRANSFERENCIA CTA SUC VIRTUAL",
    "TRANSFERENCIAS A NEQUI",
    "AVANCE SUCURSAL VIRTUAL",
    "PAGO PSE NU Compania de Fina",
    "AMPLIACION DE PLAZO",
    "IMPTO GOBIERNO 4X1000",
    "COMISION AVANCE SUCURSA",
    "Ajuste manual de saldo",
    "TRASLADO SALDOS MENORES",
  ])("%s -> null", (desc) => {
    expect(autoCategorize(desc)).toBeNull();
  });

  // These are the leaks measured against the real backlog before the guard
  // existed: an ATM sited at a gas station or inside a supermarket was being
  // filed as a fuel or grocery purchase.
  it.each([
    "RETIRO CAJERO ATM EDS TEXACO",
    "RETIRO CAJERO EDS TEXACO HATO",
    "RETIRO CAJERO ATM EXITO PUERT",
  ])("%s -> null (the ATM's location is not a purchase)", (desc) => {
    expect(autoCategorize(desc)).toBeNull();
  });

  it("a user rule still wins over the guard", () => {
    const userRules = [{ pattern: "retiro cajero", category_id: CAT.MERCADO }];
    expect(autoCategorize("RETIRO CAJERO ATM EDS TEXACO", userRules)?.category_id).toBe(CAT.MERCADO);
  });
});

// ─────────────────────────────────────────────────────────────────
// Real production descriptions (from the 915 uncategorized rows)
// ─────────────────────────────────────────────────────────────────
describe("Production descriptions", () => {
  it.each([
    ["Pago nómina Bancolombia", CAT.SALARIO],
    ["COMPRA EN PRICESMART", CAT.MERCADO],
    ["Tienda D1 Med Dark Sto", CAT.MERCADO],
    ["PAGO APP EPM SERVICIOS PUBLIC", CAT.SERVICIOS_PUBLICOS],
    ["COMPRA EN SAPIENCIA", CAT.MATRICULA],
    ["Apple.Com/Bill", CAT.SUSCRIPCIONES],
    ["Hostinger", CAT.SUSCRIPCIONES],
    ["Pago Tigo Hogar", CAT.INTERNET],
    ["Movistar Hogar", CAT.INTERNET],
    ["COMPRA EN MANGO EL T", CAT.ROPA],
    ["COMPRA EN ALKOMPRAR", CAT.ARTICULOS_HOGAR],
    ["COMPRA EN EDS BONANZ", CAT.GASOLINA],
    ["PAGO QR supermercado", CAT.MERCADO],
    ["SEGUROS DE VIDA SURAME", CAT.SEGURO_VIDA],
    ["PAYPAL *MICROSOFT", CAT.SUSCRIPCIONES],
    ["COMPRA EN UNIV PONTI", CAT.MATRICULA],
    // Medellín's prepaid transit card, not a phone top-up.
    ["Recarga de Tarjeta Civica", CAT.TRANSPORTE_PUBLICO],
  ])("%s -> %s", (desc, expected) => {
    expect(autoCategorize(desc)?.category_id).toBe(expected);
  });

  it("ambiguous merchants stay unmatched rather than guessing", () => {
    // Marketplaces and bare insurer/telecom brands sell across many categories.
    // An unmatched row surfaces in the Categorizar inbox; a wrong one silently
    // skews a budget.
    for (const desc of ["mercadolibre compra", "sura", "allianz", "linio pedido"]) {
      expect(autoCategorize(desc)).toBeNull();
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// CAT-04: Keyword Expansion — Colombian merchants
// ─────────────────────────────────────────────────────────────────
describe("CAT-04: Keyword Expansion", () => {
  it.each([
    ["olimpica supertiendas", CAT.MERCADO],
    ["surtimax frutas", CAT.MERCADO],
    ["carulla poblado", CAT.MERCADO],
    ["rappi pedido", CAT.DOMICILIOS],
    ["ifood entrega", CAT.DOMICILIOS],
    ["epm energia medellin", CAT.SERVICIOS_PUBLICOS],
    ["codensa factura energia", CAT.SERVICIOS_PUBLICOS],
    ["wom colombia movil", CAT.CELULAR],
    ["didi viaje bogota", CAT.TRANSPORTE_PUBLICO],
    ["indriver trayecto medellin", CAT.TRANSPORTE_PUBLICO],
    ["indrive viaje", CAT.TRANSPORTE_PUBLICO],
    ["terpel estacion", CAT.GASOLINA],
    ["peaje via bogota", CAT.PEAJES],
    ["drogueria cruz verde", CAT.MEDICAMENTOS],
    ["clinica del country", CAT.COPAGOS],
    ["udemy curso react", CAT.CURSOS],
    ["cine colombia", CAT.CINE_EVENTOS],
    ["steam games", CAT.HOBBIES],
    ["veterinaria mascotas", CAT.MASCOTAS],
    ["soat vehiculo", CAT.SOAT],
    ["predial medellin", CAT.PREDIAL],
    ["dian declaracion renta", CAT.IMPUESTOS],
    ["barberia el poblado", CAT.CUIDADO_PERSONAL],
    ["arriendo apartamento", CAT.ARRIENDO],
  ])("%s -> %s", (desc, expected) => {
    expect(autoCategorize(desc)?.category_id).toBe(expected);
  });
});

// ─────────────────────────────────────────────────────────────────
// Ordering: the more specific bucket must win
// ─────────────────────────────────────────────────────────────────
describe("Rule ordering", () => {
  it("'amazon prime video' -> Streaming, not the generic subscriptions bucket", () => {
    expect(autoCategorize("amazon prime video")?.category_id).toBe(CAT.STREAMING);
  });

  it("'sura eps aporte' -> EPS, not medicina prepagada", () => {
    expect(autoCategorize("sura eps aporte")?.category_id).toBe(CAT.EPS);
  });

  it("'didi food pedido' -> Domicilios, not transporte", () => {
    expect(autoCategorize("didi food pedido")?.category_id).toBe(CAT.DOMICILIOS);
  });
});

// ─────────────────────────────────────────────────────────────────
// Priority chain + API surface
// ─────────────────────────────────────────────────────────────────
describe("Priority chain: user-learned (0.9) > regex (0.8) > keyword (0.7)", () => {
  it("user-learned rule fires before everything else", () => {
    const userRules = [{ pattern: "netflix", category_id: CAT.MERCADO }];
    const result = autoCategorize("netflix mensual", userRules);
    expect(result?.category_id).toBe(CAT.MERCADO);
    expect(result?.categorization_confidence).toBe(0.9);
    expect(result?.categorization_source).toBe("USER_LEARNED");
  });

  it("keyword rules fire at 0.7 when no regex or user rule matches", () => {
    const result = autoCategorize("netflix mensual");
    expect(result?.category_id).toBe(CAT.STREAMING);
    expect(result?.categorization_confidence).toBe(0.7);
    expect(result?.categorization_source).toBe("SYSTEM_DEFAULT");
  });

  it("returns null when nothing matches", () => {
    expect(autoCategorize("xyzunknownmerchant999")).toBeNull();
  });

  it("works with no userRules and with empty userRules", () => {
    expect(autoCategorize("uber viaje")?.category_id).toBe(CAT.TRANSPORTE_PUBLICO);
    expect(autoCategorize("uber viaje", [])?.category_id).toBe(CAT.TRANSPORTE_PUBLICO);
  });

  it("result carries category_id, source and confidence", () => {
    const result = autoCategorize("netflix");
    expect(result).toHaveProperty("category_id");
    expect(result).toHaveProperty("categorization_source");
    expect(result).toHaveProperty("categorization_confidence");
  });
});

// ─────────────────────────────────────────────────────────────────
// Every rule target must be a leaf subcategory (c0000001-…)
// ─────────────────────────────────────────────────────────────────
describe("Rule targets are leaf subcategories", () => {
  it("no SUBCATEGORY_IDS value points at a parent zone", () => {
    for (const [key, id] of Object.entries(CAT)) {
      expect(id, `${key} must be a c0000001-… leaf id`).toMatch(/^c0000001-/);
    }
  });
});
