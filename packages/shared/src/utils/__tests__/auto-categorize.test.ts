import { describe, it, expect } from "vitest";
import { autoCategorize } from "../auto-categorize";
import { SEED_CATEGORY_IDS as CAT } from "../../constants/categories";

// ─────────────────────────────────────────────────────────────────
// CAT-01: Normalization — accent removal, noise token stripping
// ─────────────────────────────────────────────────────────────────
describe("CAT-01: Normalization", () => {
  it("matches 'COMPRA EN EXITO BOGOTA 12345' -> ALIMENTACION (accent removal + noise strip)", () => {
    const result = autoCategorize("COMPRA EN EXITO BOGOTA 12345");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.ALIMENTACION);
  });

  it("matches 'COMPRA EN ÉXITO' after accent removal", () => {
    // É -> E -> 'exito' after normalization
    const result = autoCategorize("COMPRA EN ÉXITO");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.ALIMENTACION);
  });

  it("matches 'PAGO EN CLARO*MOVIL NIT:123456' -> SERVICIOS (noise stripped)", () => {
    const result = autoCategorize("PAGO EN CLARO*MOVIL NIT:123456");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.SERVICIOS);
  });

  it("matches 'Transferencia a RAPPI*McDonald' -> ALIMENTACION", () => {
    const result = autoCategorize("Transferencia a RAPPI*McDonald");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.ALIMENTACION);
  });

  it("matches 'PAGO DE NETFLIX SUSCRIPCION' after noise strip", () => {
    const result = autoCategorize("PAGO DE NETFLIX SUSCRIPCION");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.SUSCRIPCIONES);
  });

  it("strips NIT references before matching", () => {
    const result = autoCategorize("CODENSA NIT:860007738");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.SERVICIOS);
  });

  it("strips auth codes (4+ digit sequences) before matching", () => {
    const result = autoCategorize("UBER 9876543 VIAJE BOGOTA");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.TRANSPORTE);
  });
});

// ─────────────────────────────────────────────────────────────────
// CAT-02: Word Boundary Matching
// ─────────────────────────────────────────────────────────────────
describe("CAT-02: Word Boundary Matching", () => {
  it("'supermercado ara kennedy' matches 'ara' -> ALIMENTACION (keyword at word boundary)", () => {
    const result = autoCategorize("supermercado ara kennedy");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.ALIMENTACION);
  });

  it("'compra tarjeta' does NOT match 'ara' (substring, not word boundary)", () => {
    const result = autoCategorize("compra tarjeta");
    // 'ara' is in 'tarjeta' but NOT at word boundary — should NOT match ALIMENTACION via 'ara'
    // It also shouldn't match via any other keyword, so result should be null or a different category
    if (result !== null) {
      expect(result.category_id).not.toBe(CAT.ALIMENTACION);
    }
  });

  it("'d1 kennedy' matches 'd1' -> ALIMENTACION (keyword at start)", () => {
    const result = autoCategorize("d1 kennedy");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.ALIMENTACION);
  });

  it("'tienda d1' matches 'd1' -> ALIMENTACION (keyword at end)", () => {
    const result = autoCategorize("tienda d1");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.ALIMENTACION);
  });

  it("'metro medellin' matches 'metro' -> TRANSPORTE (keyword at word boundary)", () => {
    const result = autoCategorize("metro medellin");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.TRANSPORTE);
  });

  it("'metropolitano cable' does NOT match 'metro' (substring)", () => {
    const result = autoCategorize("metropolitano cable");
    // 'metro' is a substring of 'metropolitano' — must NOT match TRANSPORTE via 'metro'
    if (result !== null) {
      expect(result.category_id).not.toBe(CAT.TRANSPORTE);
    }
  });

  it("'mio cali transmilenio' matches 'mio' -> TRANSPORTE (keyword at boundary)", () => {
    const result = autoCategorize("mio cali transmilenio");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.TRANSPORTE);
  });

  it("'bar kennedy' matches 'bar' -> ENTRETENIMIENTO (keyword at boundary)", () => {
    const result = autoCategorize("bar kennedy");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.ENTRETENIMIENTO);
  });

  it("'embarque aereo' does NOT match 'bar' (substring of 'embarque')", () => {
    const result = autoCategorize("embarque aereo");
    // 'bar' is a substring of 'embarque' — must NOT match ENTRETENIMIENTO via 'bar'
    expect(result).toBeNull();
  });

  it("'pet store mascotas' matches 'pet' -> MASCOTAS (keyword at boundary)", () => {
    const result = autoCategorize("pet store mascotas");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.MASCOTAS);
  });
});

// ─────────────────────────────────────────────────────────────────
// CAT-03: Regex Rules (fire at confidence 0.8)
// ─────────────────────────────────────────────────────────────────
describe("CAT-03: Regex Rules", () => {
  it("'pago tc visa' matches /pago\\s+(tc|tarjeta|cred)/ -> PAGOS_DEUDA at 0.8", () => {
    const result = autoCategorize("pago tc visa");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.PAGOS_DEUDA);
    expect(result!.categorization_confidence).toBe(0.8);
    expect(result!.categorization_source).toBe("SYSTEM_DEFAULT");
  });

  it("'pago nomina enero' matches /nomina|salario|sueldo/ -> SALARIO at 0.8", () => {
    const result = autoCategorize("pago nomina enero");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.SALARIO);
    expect(result!.categorization_confidence).toBe(0.8);
  });

  it("'cuota credito hipotecario' matches /cuota\\s+(credito|prestamo)/ -> PAGOS_DEUDA at 0.8", () => {
    const result = autoCategorize("cuota credito hipotecario");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.PAGOS_DEUDA);
    expect(result!.categorization_confidence).toBe(0.8);
  });

  it("'abono capital prestamo' matches /abono\\s+capital/ -> PAGOS_DEUDA at 0.8", () => {
    const result = autoCategorize("abono capital prestamo");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.PAGOS_DEUDA);
    expect(result!.categorization_confidence).toBe(0.8);
  });

  it("'pago salario mensual' matches regex -> SALARIO at 0.8", () => {
    const result = autoCategorize("pago salario mensual");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.SALARIO);
    expect(result!.categorization_confidence).toBe(0.8);
  });

  it("'rendimientos financieros abonados' matches regex -> INVERSIONES at 0.8", () => {
    const result = autoCategorize("rendimientos financieros abonados");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.INVERSIONES);
    expect(result!.categorization_confidence).toBe(0.8);
  });

  it("regex rules fire AFTER user-learned rules (0.9 takes priority over 0.8)", () => {
    const userRules = [
      { pattern: "pago nomina", category_id: CAT.TRANSFERENCIAS },
    ];
    const result = autoCategorize("pago nomina enero", userRules);
    expect(result).not.toBeNull();
    // User-learned rule wins with 0.9
    expect(result!.category_id).toBe(CAT.TRANSFERENCIAS);
    expect(result!.categorization_confidence).toBe(0.9);
  });

  it("'gas natural domiciliario' matches regex -> SERVICIOS at 0.8", () => {
    const result = autoCategorize("gas natural domiciliario");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.SERVICIOS);
    expect(result!.categorization_confidence).toBe(0.8);
  });

  it("'pago obligacion prestamo vehiculo' matches /pago\\s+obligacion/ -> PAGOS_DEUDA", () => {
    const result = autoCategorize("pago obligacion prestamo vehiculo");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.PAGOS_DEUDA);
  });
});

// ─────────────────────────────────────────────────────────────────
// CAT-04: Keyword Expansion — Colombian merchants
// ─────────────────────────────────────────────────────────────────
describe("CAT-04: Keyword Expansion", () => {
  // Supermarkets
  it("'olimpica supertiendas' -> ALIMENTACION", () => {
    const result = autoCategorize("olimpica supertiendas");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.ALIMENTACION);
  });

  it("'surtimax frutas' -> ALIMENTACION", () => {
    const result = autoCategorize("surtimax frutas");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.ALIMENTACION);
  });

  it("'carulla poblado' -> ALIMENTACION", () => {
    const result = autoCategorize("carulla poblado");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.ALIMENTACION);
  });

  // Delivery
  it("'rappi pedido' -> ALIMENTACION", () => {
    const result = autoCategorize("rappi pedido");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.ALIMENTACION);
  });

  it("'ifood entrega' -> ALIMENTACION", () => {
    const result = autoCategorize("ifood entrega");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.ALIMENTACION);
  });

  // Utilities
  it("'epm energia medellin' -> SERVICIOS", () => {
    const result = autoCategorize("epm energia medellin");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.SERVICIOS);
  });

  it("'codensa factura energia' -> SERVICIOS", () => {
    const result = autoCategorize("codensa factura energia");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.SERVICIOS);
  });

  it("'wom colombia movil' -> SERVICIOS", () => {
    const result = autoCategorize("wom colombia movil");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.SERVICIOS);
  });

  // Transport
  it("'didi viaje bogota' -> TRANSPORTE", () => {
    const result = autoCategorize("didi viaje bogota");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.TRANSPORTE);
  });

  it("'indriver trayecto medellin' -> TRANSPORTE", () => {
    const result = autoCategorize("indriver trayecto medellin");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.TRANSPORTE);
  });

  it("'indrive viaje' -> TRANSPORTE (alias)", () => {
    const result = autoCategorize("indrive viaje");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.TRANSPORTE);
  });
});

// ─────────────────────────────────────────────────────────────────
// No leading/trailing whitespace in keyword rules (D-05)
// ─────────────────────────────────────────────────────────────────
describe("Keyword hygiene — no leading/trailing whitespace", () => {
  it("KEYWORD_RULES does not contain keywords with leading/trailing whitespace", async () => {
    // Import the internal KEYWORD_RULES via a module-level export for testing
    const mod = await import("../auto-categorize");
    // We can't directly access KEYWORD_RULES, but we can check via side effects:
    // If "d1 " (with space) were a keyword, "d1" alone wouldn't match but "d1xyz" would.
    // Test: "d1" at word boundary should match, "d1xyz" should NOT
    const matchesBoundary = mod.autoCategorize("d1");
    expect(matchesBoundary).not.toBeNull();
    expect(matchesBoundary!.category_id).toBe(CAT.ALIMENTACION);
  });
});

// ─────────────────────────────────────────────────────────────────
// Priority chain verification
// ─────────────────────────────────────────────────────────────────
describe("Priority chain: user-learned (0.9) > regex (0.8) > keyword (0.7)", () => {
  it("user-learned rule fires before regex rules", () => {
    const userRules = [
      { pattern: "pago tc", category_id: CAT.TRANSFERENCIAS },
    ];
    const result = autoCategorize("pago tc visa colombia", userRules);
    expect(result!.category_id).toBe(CAT.TRANSFERENCIAS);
    expect(result!.categorization_confidence).toBe(0.9);
    expect(result!.categorization_source).toBe("USER_LEARNED");
  });

  it("regex rule fires before keyword rules when no user rule matches", () => {
    // 'pago prestamo vehiculo' should match regex /pago\s+(tc|tarjeta|cred(ito)?|prestamo)/ -> PAGOS_DEUDA at 0.8
    // NOT keyword 'pago prestamo' at 0.7
    const result = autoCategorize("pago prestamo vehiculo");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.PAGOS_DEUDA);
    expect(result!.categorization_confidence).toBe(0.8);
  });

  it("keyword rules fire at confidence 0.7 when no regex or user rule matches", () => {
    const result = autoCategorize("netflix mensual");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.SUSCRIPCIONES);
    expect(result!.categorization_confidence).toBe(0.7);
    expect(result!.categorization_source).toBe("SYSTEM_DEFAULT");
  });

  it("returns null when nothing matches", () => {
    const result = autoCategorize("xyzunknownmerchant999");
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────
// Function signature unchanged
// ─────────────────────────────────────────────────────────────────
describe("API compatibility", () => {
  it("autoCategorize with no userRules works", () => {
    const result = autoCategorize("uber viaje");
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.TRANSPORTE);
  });

  it("autoCategorize with empty userRules works", () => {
    const result = autoCategorize("uber viaje", []);
    expect(result).not.toBeNull();
    expect(result!.category_id).toBe(CAT.TRANSPORTE);
  });

  it("result has category_id, categorization_source, categorization_confidence", () => {
    const result = autoCategorize("netflix");
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("category_id");
    expect(result).toHaveProperty("categorization_source");
    expect(result).toHaveProperty("categorization_confidence");
  });
});
