export interface ParsedEmailTransaction {
  direction: "OUTFLOW" | "INFLOW";
  amount: number;
  currency: "COP";
  merchant: string | null;
  destination: string | null;
  card_last4: string;
  card_type: "T.Deb" | "T.Cred" | "Cta" | "producto";
  transaction_date: string;
  transaction_time: string;
  raw_line: string;
  pattern_type:
    | "retiro"
    | "compra_debito"
    | "compra_credito"
    | "transferencia"
    | "boton_bancolombia"
    | "qr_transferencia"
    | "qr_pago"
    | "pago_pse"
    | "bre_b"
    | "pago_recibido"
    | "pago_recibido_cuenta"
    | "nomina"
    | "avance"
    | "qr_recibido"
    | "transferencia_recibida"
    | "transferencia_recibida_llave"
    | "compra_asociada"
    | "recarga"
    | "factura_programada";
}

/**
 * Start of the transactional copy. Two template families:
 *  - "Bancolombia: <alert>"                 (current "Alertas y Notificaciones" template)
 *  - "Bancolombia (le) informa <alert>"     (legacy "Notificación Transaccional" template)
 * First match wins, which keeps the security footer ("Bancolombia nunca le solicitará…",
 * "correosospechoso@bancolombia.com.co") from being picked up as the marker.
 */
const BODY_MARKER = /Bancolombia(?::|\s+(?:le\s+)?informa\b)/;

function extractCandidateBody(body: string): string | null {
  const markerIndex = body.search(BODY_MARKER);
  if (markerIndex === -1) return null;

  return body.slice(markerIndex).replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
}

/** Normalize "8:06" → "08:06"; other patterns already emit zero-padded hours. */
function padTime(raw: string): string {
  const [h, m] = raw.split(":");
  return `${h.padStart(2, "0")}:${m}`;
}

function parseAmount(raw: string): number {
  const cleaned = raw.trim();
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  if (lastComma > lastDot) {
    // Comma is last separator — could be Colombian decimal comma or thousands comma
    const afterComma = cleaned.substring(lastComma + 1);
    if (afterComma.length === 3) {
      // 3 digits after comma = thousands separator (e.g. "50,900" or "44,000")
      return parseFloat(cleaned.replace(/,/g, ""));
    }
    // 0, 1, or 2 digits after comma = decimal comma (e.g. "50.000,00" or "152.340,77")
    return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
  }
  if (lastDot > lastComma) {
    const afterDot = cleaned.substring(lastDot + 1);
    if (afterDot.length <= 2) {
      // US format with comma as thousands separator: "680,000.00" or "2,270,573.00"
      return parseFloat(cleaned.replace(/,/g, ""));
    }
    // Dot as thousands separator, no decimal: remove dots
    return parseFloat(cleaned.replace(/\./g, "").replace(/,/g, ""));
  }
  if (lastComma !== -1) {
    const afterComma = cleaned.substring(lastComma + 1);
    if (afterComma.length === 3) {
      // Thousands separator: "50,900"
      return parseFloat(cleaned.replace(/,/g, ""));
    }
    if (afterComma.length <= 2) {
      return parseFloat(cleaned.replace(",", "."));
    }
    return parseFloat(cleaned.replace(/,/g, ""));
  }
  if (lastDot !== -1) {
    const afterDot = cleaned.substring(lastDot + 1);
    if (afterDot.length <= 2) return parseFloat(cleaned);
    return parseFloat(cleaned.replace(/\./g, ""));
  }
  return parseFloat(cleaned);
}

function parseDateDMY(raw: string): string {
  const parts = raw.split("/");
  if (parts.length !== 3) return raw;
  let [d, m, y] = parts;
  if (y.length === 2) y = "20" + y;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function parseDateYMD(raw: string): string {
  const parts = raw.split("/");
  if (parts.length !== 3) return raw;
  const [y, m, d] = parts;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

type PatternDef = {
  type: ParsedEmailTransaction["pattern_type"];
  regex: RegExp;
  extract: (
    m: RegExpMatchArray
  ) => Omit<ParsedEmailTransaction, "raw_line"> | null;
};

const PATTERNS: PatternDef[] = [
  // Pattern 1: Retiro (ATM withdrawal)
  // "Retiraste $50.000,00 en PQBOLIVAR_1 de tu T.Deb **0735 el 26/03/2026 a las 11:20"
  {
    type: "retiro",
    regex:
      /Retiraste \$([\d.,]+) en (.+?) de tu (T\.Deb) \*{1,2}(\d+) el (\d{2}\/\d{2}\/\d{4}) a las (\d{2}:\d{2})/,
    extract: (m) => ({
      direction: "OUTFLOW",
      amount: parseAmount(m[1]),
      currency: "COP",
      merchant: m[2].trim(),
      destination: null,
      card_last4: m[4],
      card_type: "T.Deb",
      transaction_date: parseDateDMY(m[5]),
      transaction_time: m[6],
      pattern_type: "retiro",
    }),
  },
  // Pattern 3: Compra con T.Cred (COP prefix) — must come before compra_debito
  // "Compraste COP81.000,00 en DLO*GOOGLE ChatGPT con tu T.Cred *2365, el 27/03/2026 a las 15:25"
  {
    type: "compra_credito",
    regex:
      /Compraste (?:COP|\$)([\d.,]+) en (.+?) con tu (T\.Cred) \*(\d+),? el (\d{2}\/\d{2}\/\d{4}) a las (\d{2}:\d{2})/,
    extract: (m) => ({
      direction: "OUTFLOW",
      amount: parseAmount(m[1]),
      currency: "COP",
      merchant: m[2].trim(),
      destination: null,
      card_last4: m[4],
      card_type: "T.Cred",
      transaction_date: parseDateDMY(m[5]),
      transaction_time: m[6],
      pattern_type: "compra_credito",
    }),
  },
  // Pattern 2: Compra con T.Deb
  // "Compraste $22.000,00 en DUNKIN DONUTS con tu T.Deb *0735, el 26/03/2026 a las 14:11"
  {
    type: "compra_debito",
    regex:
      /Compraste (?:COP|\$)([\d.,]+) en (.+?) con tu (T\.Deb) \*{1,2}(\d+),? el (\d{2}\/\d{2}\/\d{4}) a las (\d{2}:\d{2})/,
    extract: (m) => ({
      direction: "OUTFLOW",
      amount: parseAmount(m[1]),
      currency: "COP",
      merchant: m[2].trim(),
      destination: null,
      card_last4: m[4],
      card_type: "T.Deb",
      transaction_date: parseDateDMY(m[5]),
      transaction_time: m[6],
      pattern_type: "compra_debito",
    }),
  },
  // Pattern 14: Compra con la tarjeta en una frase aparte (compras internacionales / recurrentes)
  // "Compraste COP18.642,54 en Amazon Prime, el 22/07/2026 a las 19:50. Esta compra esta asociada a T.Cred *7022"
  {
    type: "compra_asociada",
    regex:
      /Compraste (?:COP|\$)([\d.,]+) en (.+?),? el (\d{2}\/\d{2}\/\d{4}) a las (\d{2}:\d{2})\.? Esta compra esta asociada a (T\.Cred|T\.Deb) \*{1,2}(\d+)/,
    extract: (m) => ({
      direction: "OUTFLOW",
      amount: parseAmount(m[1]),
      currency: "COP",
      merchant: m[2].trim(),
      destination: null,
      card_last4: m[6],
      card_type: m[5] as "T.Cred" | "T.Deb",
      transaction_date: parseDateDMY(m[3]),
      transaction_time: m[4],
      pattern_type: "compra_asociada",
    }),
  },
  // Pattern: Transferencia por Boton Bancolombia (PSE-style button payment to a merchant)
  // "Transferiste $126,750.00 por Boton Bancolombia a MUNICIPIO DE BELLO desde producto *4398. 19/06/2026 12:04:49"
  // Note: date+time follow a period (no "el"/"a las"); time may include seconds.
  // Must come before the plain "transferencia"/"qr_transferencia" patterns.
  {
    type: "boton_bancolombia",
    regex:
      /Transferiste \$([\d.,]+) por Boton Bancolombia a (.+?) desde producto \*?(\d+)\.? (\d{2}\/\d{2}\/\d{4}) (\d{2}:\d{2})(?::\d{2})?/,
    extract: (m) => ({
      direction: "OUTFLOW",
      amount: parseAmount(m[1]),
      currency: "COP",
      merchant: m[2].trim(),
      destination: null,
      card_last4: m[3],
      card_type: "producto",
      transaction_date: parseDateDMY(m[4]),
      transaction_time: m[5],
      pattern_type: "boton_bancolombia",
    }),
  },
  // Pattern 5: Transferencia por QR (YYYY/MM/DD date) — must come before plain transferencia
  // "Transferiste $42,500.00 por QR desde tu cuenta 4398 a la cuenta 2655, el 2026/03/27 11:59"
  {
    type: "qr_transferencia",
    regex:
      /Transferiste \$([\d.,]+) por QR desde tu cuenta \*?(\d+) a la cuenta \*?(\d+),? el (\d{4}\/\d{2}\/\d{2}) (\d{2}:\d{2})/,
    extract: (m) => ({
      direction: "OUTFLOW",
      amount: parseAmount(m[1]),
      currency: "COP",
      merchant: null,
      destination: m[3],
      card_last4: m[2],
      card_type: "Cta",
      transaction_date: parseDateYMD(m[4]),
      transaction_time: m[5],
      pattern_type: "qr_transferencia",
    }),
  },
  // Pattern 5b: Transferencia por QR (DD/MM/YYYY date) — same as 5 but day-first date
  // "Transferiste $16,000.00 por QR desde tu cuenta 4398 a la cuenta 6256, el 09/06/2026 03:22"
  {
    type: "qr_transferencia",
    regex:
      /Transferiste \$([\d.,]+) por QR desde tu cuenta \*?(\d+) a la cuenta \*?(\d+),? el (\d{2}\/\d{2}\/\d{4}) (\d{2}:\d{2})/,
    extract: (m) => ({
      direction: "OUTFLOW",
      amount: parseAmount(m[1]),
      currency: "COP",
      merchant: null,
      destination: m[3],
      card_last4: m[2],
      card_type: "Cta",
      transaction_date: parseDateDMY(m[4]),
      transaction_time: m[5],
      pattern_type: "qr_transferencia",
    }),
  },
  // Pattern 4: Transferencia (plain)
  // "Transferiste $680,000.00 desde tu cuenta 4398 a la cuenta *3196360227 el 27/03/2026 a las 17:19"
  // Bancolombia sometimes renders the destination as "a la cuenta * 01014602131" (space after the asterisk).
  {
    type: "transferencia",
    regex:
      /Transferiste \$([\d.,]+) desde tu cuenta \*?\s*(\d+) a la cuenta \*?\s*(\d+) el (\d{2}\/\d{2}\/\d{4}) a las (\d{2}:\d{2})/,
    extract: (m) => ({
      direction: "OUTFLOW",
      amount: parseAmount(m[1]),
      currency: "COP",
      merchant: null,
      destination: m[3],
      card_last4: m[2],
      card_type: "Cta",
      transaction_date: parseDateDMY(m[4]),
      transaction_time: m[5],
      pattern_type: "transferencia",
    }),
  },
  // Pattern 6: Pago por codigo QR (llave)
  // Llave may be numeric (phone) or an alphanumeric Bre-B key (e.g. "@empanadasminegra")
  // "CRISTIAN CAMILO GIRALDO MAZO pagaste $23,300.00 por codigo QR desde tu cuenta *4398 a la llave 0042980136 el 27/03/2026 a las 09:18"
  // "CRISTIAN CAMILO GIRALDO MAZO pagaste $13,800.00 por codigo QR desde tu cuenta *4398 a la llave @empanadasminegra el 25/07/2026 a las 09:16"
  {
    type: "qr_pago",
    regex:
      /pagaste \$([\d.,]+) por codigo QR desde tu cuenta \*?\s*(\d+) a la llave (\S+) el (\d{2}\/\d{2}\/\d{4}) a las (\d{2}:\d{2})/,
    extract: (m) => ({
      direction: "OUTFLOW",
      amount: parseAmount(m[1]),
      currency: "COP",
      merchant: null,
      destination: m[3],
      card_last4: m[2],
      card_type: "Cta",
      transaction_date: parseDateDMY(m[4]),
      transaction_time: m[5],
      pattern_type: "qr_pago",
    }),
  },
  // Pattern 7: Pagaste (PSE) — time may have seconds
  // "Pagaste $2,270,573.00 a FUNDACION UNIVERSITARIA CEIPA desde tu producto *4398 el 30/03/2026 08:49:58"
  {
    type: "pago_pse",
    regex:
      /Pagaste \$([\d.,]+) a (.+?) desde tu producto \*?(\d+) el (\d{2}\/\d{2}\/\d{4}) (\d{2}:\d{2})(?::\d{2})?/,
    extract: (m) => ({
      direction: "OUTFLOW",
      amount: parseAmount(m[1]),
      currency: "COP",
      merchant: m[2].trim(),
      destination: null,
      card_last4: m[3],
      card_type: "producto",
      transaction_date: parseDateDMY(m[4]),
      transaction_time: m[5],
      pattern_type: "pago_pse",
    }),
  },
  // Pattern 8: Bre-B transfer (2-digit year, recipient name after account)
  // Llave may be numeric (phone) or an alphanumeric Bre-B key (e.g. "@analogicdom")
  // "CRISTIAN, transferiste $100,000.00 a la llave 3013866335 desde tu cuenta *4398 a JUAN DIEGO TABORDA LOPEZ el 29/03/26 a las 20:52"
  // "CRISTIAN, transferiste $129,000.00 a la llave @analogicdom desde tu cuenta *4398 a ANDRES CUARTAS el 16/06/26 a las 16:56"
  {
    type: "bre_b",
    regex:
      /transferiste \$([\d.,]+) a la llave (\S+) desde tu cuenta \*?(\d+) a (.+?) el (\d{2}\/\d{2}\/\d{2,4}) a las (\d{2}:\d{2})/,
    extract: (m) => ({
      direction: "OUTFLOW",
      amount: parseAmount(m[1]),
      currency: "COP",
      merchant: m[4].trim(),
      destination: m[2],
      card_last4: m[3],
      card_type: "Cta",
      transaction_date: parseDateDMY(m[5]),
      transaction_time: m[6],
      pattern_type: "bre_b",
    }),
  },
  // Pattern 10: Avance (credit card cash advance)
  // "Hiciste un avance de $1,100,000 en tu SUC VIRTUAL el 16:11 09/04/2026 desde tu T.Credito *7022 a la cuenta *4398"
  {
    type: "avance",
    regex:
      /Hiciste un avance de \$([\d.,]+) en (?:tu )?(.+?) el (\d{2}:\d{2}) (\d{2}\/\d{2}\/\d{4}) desde tu T\.Credito \*(\d+) a la cuenta \*?(\d+)/,
    extract: (m) => ({
      direction: "OUTFLOW",
      amount: parseAmount(m[1]),
      currency: "COP",
      merchant: m[2].trim(),
      destination: m[6],
      card_last4: m[5],
      card_type: "T.Cred",
      transaction_date: parseDateDMY(m[4]),
      transaction_time: m[3],
      pattern_type: "avance",
    }),
  },
  // Pattern 12: QR received (INFLOW, YYYY/MM/DD date)
  // "Recibiste $21,400.00 por QR de MATEO PEREZ HERNANDEZ en tu cuenta *4398 el 2026/04/15 a las 12:26"
  {
    type: "qr_recibido",
    regex:
      /Recibiste \$([\d.,]+) por QR de (.+?) en tu cuenta \*{1,2}(\d+) el (\d{4}\/\d{2}\/\d{2}) a las (\d{2}:\d{2})/,
    extract: (m) => ({
      direction: "INFLOW",
      amount: parseAmount(m[1]),
      currency: "COP",
      merchant: m[2].trim(),
      destination: null,
      card_last4: m[3],
      card_type: "Cta",
      transaction_date: parseDateYMD(m[4]),
      transaction_time: m[5],
      pattern_type: "qr_recibido",
    }),
  },
  // Pattern 15: Transferencia recibida por llave / Bre-B (INFLOW) — must come before pattern 11.
  // Sender and amount are in the opposite order vs pattern 11, the year is 2-digit, and the
  // sentence carries the receiving llave.
  // "CRISTIAN, recibiste una transferencia de JHON ALEXANDER SANCHEZ PATIÑO por $37,700.00 en tu cuenta *4398 conectada a la llave 1152224099 el 06/08/26 a las 13:40"
  {
    type: "transferencia_recibida_llave",
    regex:
      /[Rr]ecibiste una transferencia de (.+?) por \$([\d.,]+) en tu cuenta \*{1,2}\s*(\d+) conectada a la llave (\S+) el (\d{2}\/\d{2}\/\d{2,4}) a las (\d{2}:\d{2})/,
    extract: (m) => ({
      direction: "INFLOW",
      amount: parseAmount(m[2]),
      currency: "COP",
      merchant: m[1].trim(),
      destination: m[4],
      card_last4: m[3],
      card_type: "Cta",
      transaction_date: parseDateDMY(m[5]),
      transaction_time: m[6],
      pattern_type: "transferencia_recibida_llave",
    }),
  },
  // Pattern 11: Transferencia recibida (incoming transfer — INFLOW)
  // "Recibiste una transferencia por $1,100,000 de CRISTIAN GIRALDO en tu cuenta **4398, el 09/04/2026 a las 16:11"
  {
    type: "transferencia_recibida",
    regex:
      /Recibiste una transferencia por \$([\d.,]+) de (.+?) en tu cuenta \*{1,2}(\d+),? el (\d{2}\/\d{2}\/\d{4}) a las (\d{2}:\d{2})/,
    extract: (m) => ({
      direction: "INFLOW",
      amount: parseAmount(m[1]),
      currency: "COP",
      merchant: m[2].trim(),
      destination: null,
      card_last4: m[3],
      card_type: "Cta",
      transaction_date: parseDateDMY(m[4]),
      transaction_time: m[5],
      pattern_type: "transferencia_recibida",
    }),
  },
  // Pattern 9: Pago recibido por proveedor (INFLOW)
  // "Recibiste un pago PROVEEDOR de F PENS PROTECCI por $30,143,338.00 en tu cuenta de Ahorros el 06/04/2026 a las 09:51"
  {
    type: "pago_recibido",
    regex:
      /Recibiste un pago PROVEEDOR de (.+?) por \$([\d.,]+) en tu cuenta de Ahorros el (\d{2}\/\d{2}\/\d{4}) a las (\d{2}:\d{2})/,
    extract: (m) => ({
      direction: "INFLOW",
      amount: parseAmount(m[2]),
      currency: "COP",
      merchant: m[1].trim(),
      destination: null,
      card_last4: "",
      card_type: "Cta",
      transaction_date: parseDateDMY(m[3]),
      transaction_time: m[4],
      pattern_type: "pago_recibido",
    }),
  },
  // Pattern 13: Pago recibido a cuenta con etiqueta (INFLOW) — formato Bre-B con nombre de cuenta
  // "Recibiste un pago por $1,100,000.00 de GIRALDO CRISTIA a tu cuenta AHORROS, el 12:43 a las 21/05/2026"
  // Note: time/date order is reversed vs other patterns ("el HH:MM a las DD/MM/YYYY")
  {
    type: "pago_recibido_cuenta",
    regex:
      /Recibiste un pago por \$([\d.,]+) de (.+?) a tu cuenta (.+?),? el (\d{2}:\d{2}) a las (\d{2}\/\d{2}\/\d{4})/,
    extract: (m) => ({
      direction: "INFLOW",
      amount: parseAmount(m[1]),
      currency: "COP",
      merchant: m[2].trim(),
      destination: null,
      card_last4: "",
      card_type: "Cta",
      transaction_date: parseDateDMY(m[5]),
      transaction_time: m[4],
      pattern_type: "pago_recibido_cuenta",
    }),
  },
  // Pattern 9: Nomina (INFLOW)
  // "Recibiste un pago de Nomina de UNIVERSIDAD PON por $1,203,850.00 en tu cuenta de Ahorros el 27/03/2026 a las 03:32"
  {
    type: "nomina",
    regex:
      /Recibiste un pago de Nomina de (.+?) por \$([\d.,]+) en tu cuenta de Ahorros el (\d{2}\/\d{2}\/\d{4}) a las (\d{2}:\d{2})/,
    extract: (m) => ({
      direction: "INFLOW",
      amount: parseAmount(m[2]),
      currency: "COP",
      merchant: m[1].trim(),
      destination: null,
      card_last4: "",
      card_type: "Cta",
      transaction_date: parseDateDMY(m[3]),
      transaction_time: m[4],
      pattern_type: "nomina",
    }),
  },
  // ── Plantilla legacy "Notificación Transaccional" ("Bancolombia (le) informa …") ──
  // Sin "el"/"a las": la fecha y la hora van tras un punto, y la hora puede ir sin cero inicial.
  // Pattern 16: Recarga (Cívica, celular, etc.)
  // "Bancolombia le informa Recarga de Tarjeta Civica por $10,000.00 desde cta *4398. 06/08/2026 8:06"
  {
    type: "recarga",
    regex:
      /Recarga de (.+?) por \$([\d.,]+) desde (?:cta|Aho|producto) ?\*?\s*(\d+)\.? (\d{2}\/\d{2}\/\d{4}) (\d{1,2}:\d{2})/,
    extract: (m) => ({
      direction: "OUTFLOW",
      amount: parseAmount(m[2]),
      currency: "COP",
      merchant: `Recarga ${m[1].trim()}`,
      destination: null,
      card_last4: m[3],
      card_type: "Cta",
      transaction_date: parseDateDMY(m[4]),
      transaction_time: padTime(m[5]),
      pattern_type: "recarga",
    }),
  },
  // Pattern 17: Pago de factura programada — sin hora en el correo.
  // "Bancolombia informa pago Factura Programada IGS MULTIASISTE Ref 11065995 por $34.063,00 desde Aho*4398. 16/07/2026"
  {
    type: "factura_programada",
    regex:
      /pago Factura Programada (.+?) (?:Ref \S+ )?por \$([\d.,]+) desde (?:cta|Aho|producto) ?\*?\s*(\d+)\.? (\d{2}\/\d{2}\/\d{4})/,
    extract: (m) => ({
      direction: "OUTFLOW",
      amount: parseAmount(m[2]),
      currency: "COP",
      merchant: m[1].trim(),
      destination: null,
      card_last4: m[3],
      card_type: "Cta",
      transaction_date: parseDateDMY(m[4]),
      // El correo no trae hora; se ancla a medianoche para no inventar un instante.
      transaction_time: "00:00",
      pattern_type: "factura_programada",
    }),
  },
];

/** Phrases indicating the transaction was declined/failed — not a real movement */
const FAILED_TX_PHRASES = [
  "no fue exitosa",
  "no se afecto",
  "fue rechazada",
  "no se realizo",
  "no se realizó",
  "intento fallido",
];

export function parseBancolombiaEmail(
  body: string
): ParsedEmailTransaction | null {
  const normalized = extractCandidateBody(body);
  if (!normalized) return null;

  // Reject informative emails about failed/declined transactions
  const lower = normalized.toLowerCase();
  if (FAILED_TX_PHRASES.some((phrase) => lower.includes(phrase))) {
    return null;
  }

  for (const pattern of PATTERNS) {
    const match = normalized.match(pattern.regex);
    if (match) {
      const parsed = pattern.extract(match);
      if (parsed) {
        // Extract raw_line from the alert segment only, excluding trailing support/marketing copy.
        const rawLineMatch = normalized.match(
          /Bancolombia(?::|\s+(?:le\s+)?informa)\s*([\s\S]+?)(?:\.\s*(?:Si tienes dudas|Encuentranos aqui|Con codigo QR|Con Bre-b|Con llaves|A tu lado|Estamos cerca|Inquietudes|Este es una notificaci|Esto es un mensaje)|\.?\s*(?:¿Dudas|¿Tienes dudas)|$)/
        );
        const raw_line = rawLineMatch ? rawLineMatch[1].trim() : normalized;
        return { ...parsed, raw_line };
      }
    }
  }

  return null;
}
