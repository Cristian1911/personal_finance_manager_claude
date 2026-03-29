"use server";

import { parseQuickCaptureText } from "@zeta/shared";
import type { ParsedQuickCapture, QuickCaptureParseResult } from "@zeta/shared";
import { format } from "date-fns";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const SYSTEM_PROMPT = `Eres un parser de transacciones financieras para una app colombiana.
El usuario dicta un gasto o ingreso por voz. Extrae los campos en JSON.

Reglas:
- amount: número positivo en la moneda local (COP). "quince" = 15000, "quince mil" = 15000, "ochenta" = 80000, "doscientos" = 200000, "un millón" = 1000000. Cuando el monto es ambiguo y parece ser en pesos colombianos, asume miles (ej: "quince" = 15000, "ochenta" = 80000).
- direction: "OUTFLOW" para gastos, pagos, compras, transferencias salientes. "INFLOW" para ingresos, pagos recibidos, devoluciones.
- description: nombre corto del comercio o concepto (ej: "Café", "Uber", "Dentista", "Arriendo"). No incluir montos ni verbos.
- transaction_date: fecha en formato YYYY-MM-DD. "ayer" = fecha de ayer, "hoy" o sin mención = hoy. "el 15" = día 15 del mes actual.
- Si no puedes determinar un campo con confianza, usa null.`;

type AIParseResult = {
  amount: number | null;
  direction: "INFLOW" | "OUTFLOW" | null;
  description: string | null;
  transaction_date: string;
};

async function parseWithGemini(input: string): Promise<AIParseResult | null> {
  if (!GEMINI_API_KEY) return null;

  try {
    const today = format(new Date(), "yyyy-MM-dd");
    const yesterday = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [
            {
              parts: [
                {
                  text: `Hoy es ${today}. Ayer fue ${yesterday}.\n\nTexto del usuario: "${input}"`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                amount: { type: "number", nullable: true },
                direction: {
                  type: "string",
                  enum: ["INFLOW", "OUTFLOW"],
                  nullable: true,
                },
                description: { type: "string", nullable: true },
                transaction_date: { type: "string" },
              },
              required: ["transaction_date"],
            },
            maxOutputTokens: 100,
          },
        }),
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!response.ok) return null;

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    return JSON.parse(text) as AIParseResult;
  } catch {
    return null;
  }
}

/**
 * Parse a voice/text transcript into structured transaction data.
 * Tries the fast regex parser first, then falls back to Gemini 2.0 Flash.
 */
export async function parseVoiceCapture(
  input: string,
): Promise<QuickCaptureParseResult> {
  // Fast path: regex parser
  const regexResult = parseQuickCaptureText(input);
  if (regexResult.success && regexResult.data.confidence >= 0.8) {
    return regexResult;
  }

  // Slow path: Gemini Flash (free tier)
  const aiResult = await parseWithGemini(input);
  if (aiResult) {
    const { amount, direction, description, transaction_date } = aiResult;

    if (amount && direction && description) {
      const data: ParsedQuickCapture = {
        input,
        amount,
        direction,
        transaction_date: transaction_date || format(new Date(), "yyyy-MM-dd"),
        description,
        merchant_name: description,
        raw_description: input,
        capture_input_text: input,
        missing_fields: ["account_id"],
        confidence: 0.95,
      };
      return { success: true, data };
    }

    // AI got partial data — merge with what regex found
    const mergedAmount = amount ?? (regexResult.success ? regexResult.data.amount : null);
    const mergedDirection = direction ?? (regexResult.success ? regexResult.data.direction : null);
    const mergedDescription = description ?? (regexResult.success ? regexResult.data.description : null);

    if (mergedAmount && mergedDirection && mergedDescription) {
      return {
        success: true,
        data: {
          input,
          amount: mergedAmount,
          direction: mergedDirection,
          transaction_date: transaction_date || format(new Date(), "yyyy-MM-dd"),
          description: mergedDescription,
          merchant_name: mergedDescription,
          raw_description: input,
          capture_input_text: input,
          missing_fields: ["account_id"],
          confidence: 0.85,
        },
      };
    }

    // Still missing fields — report what's needed
    const missing: Array<"amount" | "direction" | "description" | "account_id"> = ["account_id"];
    if (!mergedAmount) missing.push("amount");
    if (!mergedDirection) missing.push("direction");
    if (!mergedDescription) missing.push("description");

    return {
      success: false,
      error: "No pude interpretar todos los campos.",
      missing_fields: missing,
      confidence: 0.4,
    };
  }

  // No AI available — return regex result as-is
  return regexResult;
}
