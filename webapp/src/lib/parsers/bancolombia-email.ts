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
    | "qr_transferencia"
    | "qr_pago"
    | "pago_pse"
    | "bre_b"
    | "nomina";
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
  // Pattern 4: Transferencia (plain)
  // "Transferiste $680,000.00 desde tu cuenta 4398 a la cuenta *3196360227 el 27/03/2026 a las 17:19"
  {
    type: "transferencia",
    regex:
      /Transferiste \$([\d.,]+) desde tu cuenta \*?(\d+) a la cuenta \*?(\d+) el (\d{2}\/\d{2}\/\d{4}) a las (\d{2}:\d{2})/,
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
  // "CRISTIAN CAMILO GIRALDO MAZO pagaste $23,300.00 por codigo QR desde tu cuenta *4398 a la llave 0042980136 el 27/03/2026 a las 09:18"
  {
    type: "qr_pago",
    regex:
      /pagaste \$([\d.,]+) por codigo QR desde tu cuenta \*?(\d+) a la llave (\d+) el (\d{2}\/\d{2}\/\d{4}) a las (\d{2}:\d{2})/,
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
  // "CRISTIAN, transferiste $100,000.00 a la llave 3013866335 desde tu cuenta *4398 a JUAN DIEGO TABORDA LOPEZ el 29/03/26 a las 20:52"
  {
    type: "bre_b",
    regex:
      /transferiste \$([\d.,]+) a la llave (\d+) desde tu cuenta \*?(\d+) a (.+?) el (\d{2}\/\d{2}\/\d{2,4}) a las (\d{2}:\d{2})/,
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
];

export function parseBancolombiaEmail(
  body: string
): ParsedEmailTransaction | null {
  // Must start with "Bancolombia:" to be a candidate
  if (!body.startsWith("Bancolombia:") && !body.match(/Bancolombia:\s/)) {
    return null;
  }

  for (const pattern of PATTERNS) {
    const match = body.match(pattern.regex);
    if (match) {
      const parsed = pattern.extract(match);
      if (parsed) {
        // Extract raw_line: everything after "Bancolombia: " up to the first sentence end
        const rawLineMatch = body.match(/Bancolombia:\s*([\s\S]+)/);
        const raw_line = rawLineMatch ? rawLineMatch[1].trim() : body;
        return { ...parsed, raw_line };
      }
    }
  }

  return null;
}
