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

  // Pattern 4c: Transfer with 2-digit year (template change, Aug 2026)
  it("parses transfer when the date carries a 2-digit year", () => {
    const line =
      "Logo Bancolombia [https://example.com/logo.png] yellow-icon [https://example.com/chulo.png] ¡Listo! Todo salió bien con tus movimientos Bancolombia: Transferiste $22,000.00 desde tu cuenta *4398 a la cuenta *3234381055 el 22/08/26 a las 10:53. ¿Dudas? Llamanos al 018000931987. Estamos cerca. icon1 [https://example.com/icon.png] Tus gastos tienen nombre.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("OUTFLOW");
    expect(result!.amount).toBe(22000);
    expect(result!.card_last4).toBe("4398");
    expect(result!.destination).toBe("3234381055");
    expect(result!.transaction_date).toBe("2026-08-22");
    expect(result!.transaction_time).toBe("10:53");
    expect(result!.pattern_type).toBe("transferencia");
    expect(result!.raw_line).toBe(
      "Transferiste $22,000.00 desde tu cuenta *4398 a la cuenta *3234381055 el 22/08/26 a las 10:53"
    );
  });

  // Pattern: Transferencia por Boton Bancolombia (PSE-style button payment)
  it("parses Boton Bancolombia transfer (Transferiste por Boton Bancolombia)", () => {
    const line =
      "header-logo [http://bancolombia-email-wsuite.s3.amazonaws.com/templates/60712c2057ad717760ad6b6c/img/header-logo.png]yellow-icon [http://bancolombia-email-wsuite.s3.amazonaws.com/templates/60712c2057ad717760ad6b6c/img/yellow-icon.png] NotificaciónTransaccionalBancolombia: Transferiste $126,750.00 por Boton Bancolombia a MUNICIPIO DE BELLO desde producto *4398. 19/06/2026 12:04:49 ¿Dudas? 018000931987.Este es una notificación automática, por favor no respondas este mensaje.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("OUTFLOW");
    expect(result!.amount).toBe(126750);
    expect(result!.merchant).toBe("MUNICIPIO DE BELLO");
    expect(result!.destination).toBeNull();
    expect(result!.card_last4).toBe("4398");
    expect(result!.card_type).toBe("producto");
    expect(result!.transaction_date).toBe("2026-06-19");
    expect(result!.transaction_time).toBe("12:04");
    expect(result!.pattern_type).toBe("boton_bancolombia");
    expect(result!.raw_line).toBe(
      "Transferiste $126,750.00 por Boton Bancolombia a MUNICIPIO DE BELLO desde producto *4398. 19/06/2026 12:04:49"
    );
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

  // Pattern 5b: Transferencia por QR (DD/MM/YYYY date!)
  it("parses QR transfer (Transferiste por QR) with DD/MM/YYYY date", () => {
    const line =
      "Logo Bancolombia [https://example.com/logo.png] yellow-icon [https://example.com/chulo.png] ¡Listo!Todo salió bien con tus movimientos Bancolombia: Transferiste $16,000.00 por QR desde tu cuenta 4398 a la cuenta 6256, el 09/06/2026 03:22. ¿Dudas? Llamanos al 018000931987. Estamos cerca.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("OUTFLOW");
    expect(result!.amount).toBe(16000);
    expect(result!.card_last4).toBe("4398");
    expect(result!.destination).toBe("6256");
    expect(result!.transaction_date).toBe("2026-06-09");
    expect(result!.transaction_time).toBe("03:22");
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

  // Pattern 8b: Bre-B transfer with alphanumeric llave (@handle)
  it("parses Bre-B transfer with alphanumeric llave (@analogicdom)", () => {
    const line =
      "Logo Bancolombia [http://example.com/logo.png] yellow-icon [https://example.com/chulo.png] ¡Listo! Todo salió bien con tus movimientos Bancolombia: CRISTIAN, transferiste $129,000.00 a la llave @analogicdom desde tu cuenta *4398 a ANDRES CUARTAS el 16/06/26 a las 16:56. Con Bre-b es de una y gratis. Dudas al 018000912345.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("OUTFLOW");
    expect(result!.amount).toBe(129000);
    expect(result!.destination).toBe("@analogicdom");
    expect(result!.merchant).toBe("ANDRES CUARTAS");
    expect(result!.card_last4).toBe("4398");
    expect(result!.transaction_date).toBe("2026-06-16");
    expect(result!.transaction_time).toBe("16:56");
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

  it("parses provider payment inflow from noisy HTML-derived body", () => {
    const line =
      "Logo Bancolombia [https://example.com/logo.png] ¡Listo! Todo salió bien con tus movimientos Bancolombia: Recibiste un pago PROVEEDOR de F PENS PROTECCI por $30,143,338.00 en tu cuenta de Ahorros el 06/04/2026 a las 09:51. Si tienes dudas, llamanos al 018000931987. A tu lado siempre. Tus gastos tienen nombre.";
    const result = parseBancolombiaEmail(line);

    expect(result).not.toBeNull();
    expect(result!.direction).toBe("INFLOW");
    expect(result!.amount).toBe(30143338);
    expect(result!.merchant).toBe("F PENS PROTECCI");
    expect(result!.transaction_date).toBe("2026-04-06");
    expect(result!.transaction_time).toBe("09:51");
    expect(result!.pattern_type).toBe("pago_recibido");
    expect(result!.raw_line).toBe(
      "Recibiste un pago PROVEEDOR de F PENS PROTECCI por $30,143,338.00 en tu cuenta de Ahorros el 06/04/2026 a las 09:51"
    );
  });

  // Amount parsing edge cases
  it("parses whole amount without decimals (transfers)", () => {
    const line =
      "Bancolombia: Transferiste $44,000 desde tu cuenta *4398 a la cuenta *25536314779 el 27/03/2026 a las 19:30. ¿Dudas? Llamanos al 018000931987. Estamos cerca.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(44000);
  });

  // Pattern 10: Avance (credit card cash advance)
  it("parses credit card cash advance (Hiciste un avance)", () => {
    const line =
      "Bancolombia: Hiciste un avance de $1,100,000 en tu SUC VIRTUAL el 16:11 09/04/2026 desde tu T.Credito *7022 a la cuenta *4398. ¿Dudas?";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("OUTFLOW");
    expect(result!.amount).toBe(1100000);
    expect(result!.merchant).toBe("SUC VIRTUAL");
    expect(result!.destination).toBe("4398");
    expect(result!.card_last4).toBe("7022");
    expect(result!.card_type).toBe("T.Cred");
    expect(result!.transaction_date).toBe("2026-04-09");
    expect(result!.transaction_time).toBe("16:11");
    expect(result!.pattern_type).toBe("avance");
  });

  // Pattern 11: Transferencia recibida (incoming transfer)
  it("parses incoming transfer (Recibiste una transferencia)", () => {
    const line =
      "Logo Bancolombia [https://example.com/logo.png] ¡Listo! Todo salió bien con tus movimientos Bancolombia: Recibiste una transferencia por $1,100,000 de CRISTIAN GIRALDO en tu cuenta **4398, el 09/04/2026 a las 16:11. Si tienes dudas, hablemos: 018000931987. Siempre a tu lado.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("INFLOW");
    expect(result!.amount).toBe(1100000);
    expect(result!.merchant).toBe("CRISTIAN GIRALDO");
    expect(result!.card_last4).toBe("4398");
    expect(result!.card_type).toBe("Cta");
    expect(result!.transaction_date).toBe("2026-04-09");
    expect(result!.transaction_time).toBe("16:11");
    expect(result!.pattern_type).toBe("transferencia_recibida");
  });

  // Pattern 12: QR received (INFLOW)
  it("parses QR inflow (Recibiste por QR)", () => {
    const line =
      "Logo Bancolombia [https://bancolombia-email-wsuite.s3.amazonaws.com/templates/605ce7f68622a5425353ea51/img/header-logo.png]yellow-icon [https://bancolombia-email-wsuite.s3.amazonaws.com/templates/64e68b61fa57f445dc99747d/img/chulo.png] ¡Listo!Todo salió bien con tus movimientos Bancolombia: Recibiste $21,400.00 por QR de MATEO PEREZ HERNANDEZ en tu cuenta *4398 el 2026/04/15 a las 12:26. ¿Dudas? Llama al 018000931987. Estamos cerca.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("INFLOW");
    expect(result!.amount).toBe(21400);
    expect(result!.merchant).toBe("MATEO PEREZ HERNANDEZ");
    expect(result!.card_last4).toBe("4398");
    expect(result!.card_type).toBe("Cta");
    expect(result!.transaction_date).toBe("2026-04-15");
    expect(result!.transaction_time).toBe("12:26");
    expect(result!.pattern_type).toBe("qr_recibido");
  });

  // Pattern 13: Pago recibido a cuenta con etiqueta (INFLOW)
  it("parses generic payment received with account label and reversed time/date order", () => {
    const line =
      "Logo Bancolombia [https://example.com/logo.png] yellow-icon [https://example.com/chulo.png] ¡Listo! Todo salió bien con tus movimientos Bancolombia: Recibiste un pago por $1,100,000.00 de GIRALDO CRISTIA a tu cuenta AHORROS, el 12:43 a las 21/05/2026. ¿Tienes dudas? Encuentranos aqui:018000931987. Estamos cerca";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("INFLOW");
    expect(result!.amount).toBe(1100000);
    expect(result!.merchant).toBe("GIRALDO CRISTIA");
    expect(result!.card_last4).toBe("");
    expect(result!.card_type).toBe("Cta");
    expect(result!.transaction_date).toBe("2026-05-21");
    expect(result!.transaction_time).toBe("12:43");
    expect(result!.pattern_type).toBe("pago_recibido_cuenta");
    expect(result!.raw_line).toBe(
      "Recibiste un pago por $1,100,000.00 de GIRALDO CRISTIA a tu cuenta AHORROS, el 12:43 a las 21/05/2026"
    );
  });

  // Pattern 15: Transferencia recibida por llave / Bre-B (INFLOW)
  it("parses Bre-B inbound transfer (recibiste una transferencia de X por $Y ... conectada a la llave)", () => {
    const line =
      "Logo Bancolombia [https://example.com/logo.png] yellow-icon [https://example.com/chulo.png] ¡Listo! Todo salió bien con tus movimientos Bancolombia: CRISTIAN, recibiste una transferencia de JHON ALEXANDER SANCHEZ PATIÑO por $37,700.00 en tu cuenta *4398 conectada a la llave 1152224099 el 06/08/26 a las 13:40. Con llaves es de una y gratis. Dudas al 018000912345.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("INFLOW");
    expect(result!.amount).toBe(37700);
    expect(result!.merchant).toBe("JHON ALEXANDER SANCHEZ PATIÑO");
    expect(result!.destination).toBe("1152224099");
    expect(result!.card_last4).toBe("4398");
    expect(result!.card_type).toBe("Cta");
    expect(result!.transaction_date).toBe("2026-08-06");
    expect(result!.transaction_time).toBe("13:40");
    expect(result!.pattern_type).toBe("transferencia_recibida_llave");
  });

  // Pattern 16: Recarga — plantilla legacy "Bancolombia le informa", hora sin cero inicial
  it("parses Recarga from the legacy \"Bancolombia le informa\" template", () => {
    const line =
      "Fluid Grid Master --> --> Notificacion Transaccional Bancolombia le informa Recarga de Tarjeta Civica por $10,000.00 desde cta *4398. 06/08/2026 8:06. Inquietudes al 018000945555.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("OUTFLOW");
    expect(result!.amount).toBe(10000);
    expect(result!.merchant).toBe("Recarga Tarjeta Civica");
    expect(result!.card_last4).toBe("4398");
    expect(result!.card_type).toBe("Cta");
    expect(result!.transaction_date).toBe("2026-08-06");
    // hora normalizada a HH:MM
    expect(result!.transaction_time).toBe("08:06");
    expect(result!.pattern_type).toBe("recarga");
    expect(result!.raw_line).toBe(
      "Recarga de Tarjeta Civica por $10,000.00 desde cta *4398. 06/08/2026 8:06"
    );
  });

  // Pattern 17: Factura programada — plantilla legacy, sin hora
  it("parses scheduled bill payment (pago Factura Programada) without a time", () => {
    const line =
      "Fluid Grid Master --> --> Notificacion Informativa Bancolombia informa pago Factura Programada IGS MULTIASISTE Ref 11065995 por $34.063,00 desde Aho*4398. 16/07/2026. Inquietudes 6045109095/018000931987.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("OUTFLOW");
    expect(result!.amount).toBe(34063);
    expect(result!.merchant).toBe("IGS MULTIASISTE");
    expect(result!.card_last4).toBe("4398");
    expect(result!.card_type).toBe("Cta");
    expect(result!.transaction_date).toBe("2026-07-16");
    expect(result!.transaction_time).toBe("00:00");
    expect(result!.pattern_type).toBe("factura_programada");
  });

  // Pattern 14: Compra con la tarjeta en una frase aparte
  it("parses purchase where the card is named in a separate sentence", () => {
    const line =
      "Bancolombia: Compraste COP18.642,54 en Amazon Prime, el 22/07/2026 a las 19:50. Esta compra esta asociada a T.Cred *7022. Si tienes dudas, encuentranos aqui: 01800931987. Siempre contigo.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("OUTFLOW");
    expect(result!.amount).toBeCloseTo(18642.54);
    expect(result!.merchant).toBe("Amazon Prime");
    expect(result!.card_last4).toBe("7022");
    expect(result!.card_type).toBe("T.Cred");
    expect(result!.transaction_date).toBe("2026-07-22");
    expect(result!.transaction_time).toBe("19:50");
    expect(result!.pattern_type).toBe("compra_asociada");
  });

  // Pattern 4c: destino con espacio despues del asterisco ("a la cuenta * 01014602131")
  it("parses transfer when the destination account has a space after the asterisk", () => {
    const line =
      "Bancolombia: Transferiste $26,100 desde tu cuenta *4398 a la cuenta * 01014602131 el 05/08/2026 a las 17:02. ¿Dudas? Llamanos al 018000931987. Estamos cerca.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("OUTFLOW");
    expect(result!.amount).toBe(26100);
    expect(result!.destination).toBe("01014602131");
    expect(result!.card_last4).toBe("4398");
    expect(result!.transaction_date).toBe("2026-08-05");
    expect(result!.pattern_type).toBe("transferencia");
  });

  // Pattern 6b: llave alfanumerica (@handle) en pago por codigo QR
  it("parses QR payment to an @-handle Bre-B key", () => {
    const line =
      "Bancolombia: CRISTIAN CAMILO GIRALDO MAZO pagaste $13,800.00 por codigo QR desde tu cuenta *4398 a la llave @empanadasminegra el 25/07/2026 a las 09:16. Con codigo QR es facil y de una. Dudas al 018000912345.";
    const result = parseBancolombiaEmail(line);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("OUTFLOW");
    expect(result!.amount).toBe(13800);
    expect(result!.destination).toBe("@empanadasminegra");
    expect(result!.card_last4).toBe("4398");
    expect(result!.transaction_date).toBe("2026-07-25");
    expect(result!.pattern_type).toBe("qr_pago");
  });

  // Guard: el marcador ampliado ("Bancolombia informa") no debe engancharse al pie de seguridad
  it("returns null for the security footer alone", () => {
    const line =
      "Bancolombia nunca le solicitara datos financieros como usuarios, claves, numeros de tarjetas de credito con sus codigos de seguridad y fechas de vencimiento mediante vinculos de correo electronico o llamadas. Reportalo a correosospechoso@bancolombia.com.co";
    expect(parseBancolombiaEmail(line)).toBeNull();
  });

  it("returns null for non-transactional alerts (clave dinamica, tarjeta on/off)", () => {
    expect(
      parseBancolombiaEmail(
        "Bancolombia: Desbloqueamos tu Clave Dinamica. ¿Dudas? Llamanos: 018000912345, opciones 3/3."
      )
    ).toBeNull();
    expect(
      parseBancolombiaEmail(
        "Bancolombia: Apagaste tu tarjeta de credito *7022 el 16/06/2026 12:40. Desactivaste transacciones, avances y pagos programados con ella."
      )
    ).toBeNull();
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
