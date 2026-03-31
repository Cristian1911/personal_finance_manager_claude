import { describe, it, expect } from "vitest";
import { parseBancolombiaEmail } from "../bancolombia-email";

describe("parseBancolombiaEmail", () => {
  // Pattern 1: Retiro
  it("parses ATM withdrawal (Retiraste)", () => {
    const line =
      "Bancolombia: Retiraste $50.000,00 en PQBOLIVAR_1 de tu T.Deb **0735 el 26/03/2026 a las 11:20. Si tienes dudas, llamanos al 6045109095. Estamos cerca";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("OUTFLOW");
    expect(result!.amount).toBe(50000);
    expect(result!.merchant).toBe("PQBOLIVAR_1");
    expect(result!.card_last4).toBe("0735");
    expect(result!.card_type).toBe("T.Deb");
    expect(result!.transaction_date).toBe("2026-03-26");
    expect(result!.transaction_time).toBe("11:20");
    expect(result!.pattern_type).toBe("retiro");
  });

  // Pattern 2: Compra con T.Deb
  it("parses debit purchase (Compraste T.Deb)", () => {
    const line =
      "Bancolombia: Compraste $22.000,00 en DUNKIN DONUTS con tu T.Deb *0735, el 26/03/2026 a las 14:11. Si tienes dudas, encuentranos aqui: 6045109095 o 018000931987. Estamos cerca.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("OUTFLOW");
    expect(result!.amount).toBe(22000);
    expect(result!.merchant).toBe("DUNKIN DONUTS");
    expect(result!.card_last4).toBe("0735");
    expect(result!.card_type).toBe("T.Deb");
    expect(result!.transaction_date).toBe("2026-03-26");
    expect(result!.pattern_type).toBe("compra_debito");
  });

  // Pattern 2b: Debit with decimals
  it("parses debit purchase with decimals", () => {
    const line =
      "Bancolombia: Compraste $152.340,77 en SUPABASE con tu T.Deb *0735, el 27/03/2026 a las 21:10. Si tienes dudas, encuentranos aqui: 6045109095 o 018000931987. Estamos cerca.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.amount).toBeCloseTo(152340.77);
    expect(result!.merchant).toBe("SUPABASE");
  });

  // Pattern 3: Compra con T.Cred (COP prefix)
  it("parses credit card purchase (Compraste T.Cred with COP)", () => {
    const line =
      "Bancolombia: Compraste COP81.000,00 en DLO*GOOGLE ChatGPT con tu T.Cred *2365, el 27/03/2026 a las 15:25. Si tienes dudas, encuentranos aqui: 6045109095 o 018000931987. Estamos cerca.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("OUTFLOW");
    expect(result!.amount).toBe(81000);
    expect(result!.merchant).toBe("DLO*GOOGLE ChatGPT");
    expect(result!.card_last4).toBe("2365");
    expect(result!.card_type).toBe("T.Cred");
    expect(result!.pattern_type).toBe("compra_credito");
  });

  // Pattern 4: Transferencia
  it("parses bank transfer (Transferiste)", () => {
    const line =
      "Bancolombia: Transferiste $680,000.00 desde tu cuenta 4398 a la cuenta *3196360227 el 27/03/2026 a las 17:19. ¿Dudas? Llamanos al 018000931987. Estamos cerca.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("OUTFLOW");
    expect(result!.amount).toBe(680000);
    expect(result!.merchant).toBeNull();
    expect(result!.destination).toBe("3196360227");
    expect(result!.card_last4).toBe("4398");
    expect(result!.transaction_date).toBe("2026-03-27");
    expect(result!.pattern_type).toBe("transferencia");
  });

  // Pattern 4b: Transfer with asterisk on source
  it("parses transfer with asterisk on source account", () => {
    const line =
      "Bancolombia: Transferiste $50,900 desde tu cuenta *4398 a la cuenta *10382409401 el 26/03/2026 a las 17:11. ¿Dudas? Llamanos al 018000931987. Estamos cerca.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(50900);
    expect(result!.card_last4).toBe("4398");
    expect(result!.destination).toBe("10382409401");
  });

  // Pattern 5: Transferencia por QR (YYYY/MM/DD date!)
  it("parses QR transfer (Transferiste por QR) with YYYY/MM/DD date", () => {
    const line =
      "Bancolombia: Transferiste $42,500.00 por QR desde tu cuenta 4398 a la cuenta 2655, el 2026/03/27 11:59. ¿Dudas? Llamanos al 018000931987. Estamos cerca.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("OUTFLOW");
    expect(result!.amount).toBe(42500);
    expect(result!.card_last4).toBe("4398");
    expect(result!.destination).toBe("2655");
    expect(result!.transaction_date).toBe("2026-03-27");
    expect(result!.pattern_type).toBe("qr_transferencia");
  });

  // Pattern 6: Pago por codigo QR
  it("parses QR llave payment (pagaste por codigo QR)", () => {
    const line =
      "Bancolombia: CRISTIAN CAMILO GIRALDO MAZO pagaste $23,300.00 por codigo QR desde tu cuenta *4398 a la llave 0042980136 el 27/03/2026 a las 09:18. Con codigo QR es facil y de una. Dudas al 018000912345.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("OUTFLOW");
    expect(result!.amount).toBe(23300);
    expect(result!.card_last4).toBe("4398");
    expect(result!.destination).toBe("0042980136");
    expect(result!.transaction_date).toBe("2026-03-27");
    expect(result!.pattern_type).toBe("qr_pago");
  });

  // Pattern 7: Pagaste (PSE) with seconds in time
  it("parses PSE payment (Pagaste a ... desde tu producto)", () => {
    const line =
      "Bancolombia: Pagaste $2,270,573.00 a FUNDACION UNIVERSITARIA CEIPA desde tu producto *4398 el 30/03/2026 08:49:58. ¿Dudas? Llamanos al 6045109095. Estamos cerca";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("OUTFLOW");
    expect(result!.amount).toBe(2270573);
    expect(result!.merchant).toBe("FUNDACION UNIVERSITARIA CEIPA");
    expect(result!.card_last4).toBe("4398");
    expect(result!.card_type).toBe("producto");
    expect(result!.transaction_date).toBe("2026-03-30");
    expect(result!.transaction_time).toBe("08:49");
    expect(result!.pattern_type).toBe("pago_pse");
  });

  // Pattern 8: Bre-B transfer (2-digit year, recipient name)
  it("parses Bre-B transfer (transferiste a la llave ... a RECIPIENT)", () => {
    const line =
      "Bancolombia: CRISTIAN, transferiste $100,000.00 a la llave 3013866335 desde tu cuenta *4398 a JUAN DIEGO TABORDA LOPEZ el 29/03/26 a las 20:52. Con Bre-b es de una y gratis. Dudas al 018000912345.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("OUTFLOW");
    expect(result!.amount).toBe(100000);
    expect(result!.destination).toBe("3013866335");
    expect(result!.merchant).toBe("JUAN DIEGO TABORDA LOPEZ");
    expect(result!.card_last4).toBe("4398");
    expect(result!.transaction_date).toBe("2026-03-29");
    expect(result!.pattern_type).toBe("bre_b");
  });

  // Pattern 9: Nomina (INFLOW)
  it("parses salary deposit (Recibiste pago de Nomina)", () => {
    const line =
      "Bancolombia: Recibiste un pago de Nomina de UNIVERSIDAD PON por $1,203,850.00 en tu cuenta de Ahorros el 27/03/2026 a las 03:32. Si tienes dudas, llamanos al 018000931987. A tu lado siempre.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("INFLOW");
    expect(result!.amount).toBe(1203850);
    expect(result!.merchant).toBe("UNIVERSIDAD PON");
    expect(result!.transaction_date).toBe("2026-03-27");
    expect(result!.pattern_type).toBe("nomina");
  });

  // Amount parsing edge cases
  it("parses whole amount without decimals (transfers)", () => {
    const line =
      "Bancolombia: Transferiste $44,000 desde tu cuenta *4398 a la cuenta *25536314779 el 27/03/2026 a las 19:30. ¿Dudas? Llamanos al 018000931987. Estamos cerca.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(44000);
  });

  // Unrecognized emails
  it("returns null for non-Bancolombia email", () => {
    const line = "Your Amazon order has shipped!";
    expect(parseBancolombiaEmail(line)).toBeNull();
  });

  it("returns null for Bancolombia marketing email", () => {
    const line =
      "Bancolombia: Aprovecha las tasas especiales en créditos de vivienda.";
    expect(parseBancolombiaEmail(line)).toBeNull();
  });
});
