/**
 * Extracts a normalized "merchant pattern" from a transaction description.
 * Used to build user-learned category rules for auto-categorization.
 *
 * Example: "COMPRA EN RAPPI*MCDONALDS BOGOTA 12345" → "rappi mcdonalds"
 */

// Common noise words/prefixes in Colombian bank statements
const NOISE_PATTERNS = [
  /compra\s+(en|de)\s+/gi,
  /pago\s+(de|a|en)\s+/gi,
  /transferencia\s+(a|de|en)\s+/gi,
  /retiro\s+(en|de)\s+/gi,
  /abono\s+(de|a|en)\s+/gi,
  /debito\s+automatico\s+/gi,
  /\b(nit|cc|ce)\s*:?\s*\d+/gi,       // Tax/ID numbers
  /\b\d{4,}/g,                          // Long number sequences (auth codes, refs)
  /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, // Dates
  /\b(bogota|medellin|cali|barranquilla|cartagena|bucaramanga)\b/gi, // Cities
  /\b(col|co|colombia)\b/gi,
  /\*+/g,                               // Asterisks used as separators
  /\s{2,}/g,                            // Multiple spaces → single
];

/**
 * Extract a merchant fingerprint from a transaction description.
 * Prioritizes merchant_name if available, falls back to descriptions.
 */
export function extractPattern(
  merchantName: string | null | undefined,
  cleanDescription: string | null | undefined,
  rawDescription: string | null | undefined
): string | null {
  const source = merchantName || cleanDescription || rawDescription;
  if (!source || source.trim().length === 0) return null;

  let pattern = source.toLowerCase().trim();

  // Apply noise removal
  for (const regex of NOISE_PATTERNS) {
    pattern = pattern.replace(regex, " ");
  }

  // Trim and collapse whitespace
  pattern = pattern.replace(/\s+/g, " ").trim();

  // If the result is too short or empty, skip
  if (pattern.length < 3) return null;

  return pattern;
}
