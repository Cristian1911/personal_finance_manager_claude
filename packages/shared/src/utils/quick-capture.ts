import { format, subDays } from "date-fns";
import type { TransactionDirection } from "../types/domain";

export type QuickCaptureMissingField =
  | "amount"
  | "direction"
  | "description"
  | "account_id";

export type ParsedQuickCapture = {
  input: string;
  amount: number;
  direction: TransactionDirection;
  transaction_date: string;
  description: string;
  merchant_name: string;
  raw_description: string;
  capture_input_text: string;
  missing_fields: QuickCaptureMissingField[];
  confidence: number;
};

export type QuickCaptureParseResult =
  | {
      success: true;
      data: ParsedQuickCapture;
    }
  | {
      success: false;
      error: string;
      missing_fields: QuickCaptureMissingField[];
      confidence: number;
    };

export type QuickCaptureContext = {
  now?: Date;
};

const OUTFLOW_HINTS = [
  "gaste",
  "gasté",
  "pague",
  "pagué",
  "compre",
  "compré",
  "debito",
  "débito",
  "salio",
  "salió",
  "transferi",
  "transferí",
];

const INFLOW_HINTS = [
  "me pagaron",
  "me entro",
  "me entró",
  "recibi",
  "recibí",
  "ingreso",
  "ingresó",
  "consigne",
  "consigné",
  "cayo",
  "cayó",
];

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeInput(value: string): string {
  return compactWhitespace(stripAccents(value).toLowerCase());
}

function parseAmountToken(token: string): number | null {
  const normalized = token.toLowerCase().replace(/\s+/g, "");
  const suffix = normalized.endsWith("mil")
    ? "mil"
    : normalized.endsWith("k")
      ? "k"
      : normalized.endsWith("m")
        ? "m"
        : "";

  let base = suffix ? normalized.slice(0, -suffix.length) : normalized;
  base = base.replace(/[^\d.,]/g, "");
  if (!base) return null;

  let value: number | null = null;
  if (suffix === "m") {
    value = Number(base.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(value) ? Math.round(value * 1_000_000) : null;
  }

  if (suffix === "k" || suffix === "mil") {
    value = Number(base.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(value) ? Math.round(value * 1_000) : null;
  }

  const digitsOnly = base.replace(/[^\d]/g, "");
  if (!digitsOnly) return null;

  if (base.includes(".") && !base.includes(",") && /^\d{1,3}(\.\d{3})+$/.test(base)) {
    return Number(base.replace(/\./g, ""));
  }
  if (base.includes(",") && !base.includes(".") && /^\d{1,3}(,\d{3})+$/.test(base)) {
    return Number(base.replace(/,/g, ""));
  }

  value = Number(base.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) ? Math.round(value) : null;
}

function extractAmount(input: string): { amount: number | null; rawMatch: string | null } {
  const amountRegex =
    /(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?(?:\s?(?:k|m|mil)))/i;
  const match = input.match(amountRegex);
  if (!match) return { amount: null, rawMatch: null };
  const amount = parseAmountToken(match[0]);
  return { amount, rawMatch: match[0] };
}

function extractDirection(normalized: string): TransactionDirection | null {
  if (OUTFLOW_HINTS.some((hint) => normalized.includes(hint))) return "OUTFLOW";
  if (INFLOW_HINTS.some((hint) => normalized.includes(hint))) return "INFLOW";
  return null;
}

function extractDate(rawInput: string, now: Date): { date: string; consumed: string[] } {
  const normalized = normalizeInput(rawInput);
  if (normalized.includes("ayer")) {
    return { date: format(subDays(now, 1), "yyyy-MM-dd"), consumed: ["ayer"] };
  }
  if (normalized.includes("hoy")) {
    return { date: format(now, "yyyy-MM-dd"), consumed: ["hoy"] };
  }

  const explicitDate = normalized.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (explicitDate) {
    const day = Number(explicitDate[1]);
    const month = Number(explicitDate[2]);
    const currentYear = now.getFullYear();
    const parsedYear = explicitDate[3]
      ? Number(explicitDate[3].length === 2 ? `20${explicitDate[3]}` : explicitDate[3])
      : currentYear;
    const date = new Date(parsedYear, month - 1, day, 12, 0, 0);
    if (!Number.isNaN(date.getTime())) {
      return {
        date: format(date, "yyyy-MM-dd"),
        consumed: [explicitDate[0]],
      };
    }
  }

  const dayOnly = normalized.match(/\bel\s+(\d{1,2})\b/);
  if (dayOnly) {
    const date = new Date(now.getFullYear(), now.getMonth(), Number(dayOnly[1]), 12, 0, 0);
    if (!Number.isNaN(date.getTime())) {
      return {
        date: format(date, "yyyy-MM-dd"),
        consumed: [dayOnly[0]],
      };
    }
  }

  return { date: format(now, "yyyy-MM-dd"), consumed: [] };
}

function cleanupDescription(rawInput: string, amountToken: string | null, consumedDateBits: string[]) {
  let description = rawInput;
  const removablePatterns = [
    /\bme pagaron\b/gi,
    /\bme entro\b/gi,
    /\bme entró\b/gi,
    /\brecibi\b/gi,
    /\brecibí\b/gi,
    /\bingreso\b/gi,
    /\bingresó\b/gi,
    /\bconsigne\b/gi,
    /\bconsigné\b/gi,
    /\bgaste\b/gi,
    /\bgasté\b/gi,
    /\bpague\b/gi,
    /\bpagué\b/gi,
    /\bcompre\b/gi,
    /\bcompré\b/gi,
    /\bdebito\b/gi,
    /\bdébito\b/gi,
    /\bde\b/gi,
    /\ben\b/gi,
    /\bpor\b/gi,
  ];

  for (const pattern of removablePatterns) {
    description = description.replace(pattern, " ");
  }
  if (amountToken) {
    description = description.replace(amountToken, " ");
  }
  for (const bit of consumedDateBits) {
    description = description.replace(new RegExp(bit, "gi"), " ");
  }

  description = description.replace(/[,:;]+/g, " ");
  description = compactWhitespace(description);
  return description;
}

export function parseQuickCaptureText(
  input: string,
  context: QuickCaptureContext = {}
): QuickCaptureParseResult {
  const rawInput = compactWhitespace(input);
  if (!rawInput) {
    return {
      success: false,
      error: "Escribe un movimiento para interpretarlo.",
      missing_fields: ["amount", "direction", "description", "account_id"],
      confidence: 0,
    };
  }

  const now = context.now ?? new Date();
  const normalized = normalizeInput(rawInput);
  const { amount, rawMatch } = extractAmount(rawInput);
  const direction = extractDirection(normalized);
  const { date, consumed } = extractDate(rawInput, now);
  const description = cleanupDescription(rawInput, rawMatch, consumed);

  const missing_fields: QuickCaptureMissingField[] = ["account_id"];
  if (!amount) missing_fields.unshift("amount");
  if (!direction) missing_fields.push("direction");
  if (!description) missing_fields.push("description");

  if (!amount || !direction || !description) {
    return {
      success: false,
      error: "No pude interpretar monto, tipo y descripción con suficiente confianza.",
      missing_fields,
      confidence: amount || direction || description ? 0.35 : 0.1,
    };
  }

  const confidence =
    (amount ? 0.4 : 0) + (direction ? 0.25 : 0) + (description ? 0.25 : 0) + 0.1;

  return {
    success: true,
    data: {
      input: rawInput,
      amount,
      direction,
      transaction_date: date,
      description,
      merchant_name: description,
      raw_description: rawInput,
      capture_input_text: rawInput,
      missing_fields,
      confidence: Math.min(confidence, 1),
    },
  };
}
