/**
 * Destinatario (payee/merchant) matching engine.
 * Matches raw transaction descriptions against user-defined rules,
 * and suggests new destinatario patterns from unmatched descriptions.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DestinatarioRule {
  destinatario_id: string;
  destinatario_name: string;
  default_category_id: string | null;
  match_type: "contains" | "exact";
  pattern: string;
  priority: number;
}

export interface DestinatarioMatch {
  destinatario_id: string;
  destinatario_name: string;
  category_id: string | null;
  matched_rule_pattern: string;
}

export interface DestinatarioSuggestion {
  cleanedPattern: string;
  count: number;
  rawDescriptions: string[];
  transactionPreviews: { date: string; rawDescription: string; amount: number }[];
}

// ─── Prepared rules (pre-sorted + pre-lowercased) ────────────────────────────

export type PreparedDestinatarioRule = DestinatarioRule & {
  _lowerPattern: string;
};

// ─── Noise tokens ────────────────────────────────────────────────────────────

const NOISE_TOKENS = new Set([
  "SUC", "SUCURSAL", "OFC", "OFICINA", "PAG", "PAGO", "COMPRA",
  "DISPONIBLE", "CR", "DB", "REVERSO", "DE",
]);

// ─── cleanDescription ────────────────────────────────────────────────────────

/**
 * Strip noise tokens (branch labels, payment prefixes, etc.) and pure-numeric
 * tokens from a raw transaction description, returning an upper-cased,
 * whitespace-normalised string suitable for grouping.
 */
export function cleanDescription(raw: string): string {
  const upper = raw.toUpperCase().trim();
  const tokens = upper.split(/\s+/);
  const cleaned = tokens.filter((token) => {
    if (NOISE_TOKENS.has(token)) return false;
    if (/^\d+$/.test(token)) return false;
    return true;
  });
  return cleaned.join(" ").trim();
}

/**
 * Pre-sort and pre-lowercase rules for repeated matching.
 * Call once, then pass the result to `matchDestinatario` for each transaction.
 */
export function prepareDestinatarioRules(
  rules: DestinatarioRule[]
): PreparedDestinatarioRule[] {
  return [...rules]
    .map((r) => ({ ...r, _lowerPattern: r.pattern.toLowerCase() }))
    .sort((a, b) => {
      if (a.match_type !== b.match_type) {
        return a.match_type === "exact" ? -1 : 1;
      }
      return a.priority - b.priority;
    });
}

// ─── matchDestinatario ───────────────────────────────────────────────────────

/**
 * Match a raw transaction description against a set of destinatario rules.
 * Returns the first matching destinatario or null if none match.
 *
 * Accepts either raw `DestinatarioRule[]` or pre-prepared rules from
 * `prepareDestinatarioRules()`. When matching many transactions, use
 * `prepareDestinatarioRules()` once to avoid repeated sort+lowercase.
 */
export function matchDestinatario(
  rawDescription: string,
  rules: DestinatarioRule[] | PreparedDestinatarioRule[]
): DestinatarioMatch | null {
  const cleaned = rawDescription.toLowerCase().trim();
  if (cleaned.length === 0) return null;

  // If rules aren't pre-prepared, prepare them on the fly
  const prepared: PreparedDestinatarioRule[] =
    rules.length > 0 && "_lowerPattern" in rules[0]
      ? (rules as PreparedDestinatarioRule[])
      : prepareDestinatarioRules(rules as DestinatarioRule[]);

  for (const rule of prepared) {
    const isMatch =
      rule.match_type === "exact"
        ? cleaned === rule._lowerPattern
        : cleaned.includes(rule._lowerPattern);

    if (isMatch) {
      return {
        destinatario_id: rule.destinatario_id,
        destinatario_name: rule.destinatario_name,
        category_id: rule.default_category_id,
        matched_rule_pattern: rule.pattern,
      };
    }
  }

  return null;
}

// ─── detectDestinatarioSuggestions ───────────────────────────────────────────

/**
 * Analyze transaction descriptions to suggest new destinatario patterns.
 * Groups descriptions by their cleaned form (noise tokens and pure-numeric
 * tokens stripped) and returns suggestions for groups that appear at least
 * `minCount` times across unique raw descriptions.
 */
export function detectDestinatarioSuggestions(
  transactions: { description: string; date?: string; amount?: number }[],
  minCount: number = 2
): DestinatarioSuggestion[] {
  const groups = new Map<
    string,
    { rawDescriptions: Set<string>; previews: { date: string; rawDescription: string; amount: number }[] }
  >();

  for (const tx of transactions) {
    const cleaned = cleanDescription(tx.description);
    if (cleaned.length === 0) continue;

    if (!groups.has(cleaned)) {
      groups.set(cleaned, { rawDescriptions: new Set(), previews: [] });
    }
    const group = groups.get(cleaned)!;
    group.rawDescriptions.add(tx.description);
    if (group.previews.length < 5) {
      group.previews.push({
        date: tx.date ?? "",
        rawDescription: tx.description,
        amount: tx.amount ?? 0,
      });
    }
  }

  const suggestions: DestinatarioSuggestion[] = [];
  for (const [pattern, group] of groups) {
    const totalCount = group.rawDescriptions.size;
    if (totalCount < minCount) continue;
    suggestions.push({
      cleanedPattern: pattern,
      count: totalCount,
      rawDescriptions: Array.from(group.rawDescriptions),
      transactionPreviews: group.previews,
    });
  }

  suggestions.sort((a, b) => {
    const countDiff = b.count - a.count;
    if (countDiff !== 0) return countDiff;
    return a.cleanedPattern.localeCompare(b.cleanedPattern);
  });

  return suggestions;
}

// ─── groupByCommonPrefix ──────────────────────────────────────────────────────

function getCommonPrefix(a: string, b: string): string {
  const tokensA = a.split(/\s+/);
  const tokensB = b.split(/\s+/);
  const common: string[] = [];
  for (let i = 0; i < Math.min(tokensA.length, tokensB.length); i++) {
    if (tokensA[i] === tokensB[i]) {
      common.push(tokensA[i]);
    } else {
      break;
    }
  }
  return common.join(" ");
}

/**
 * Group suggestions by longest common prefix (minimum 2 tokens).
 * Merges "NEQUI PAGO", "NEQUI PAGO TRANSFERENCIAS", "NEQUI PAGO 1234"
 * into one group with pattern "NEQUI PAGO" and combined count.
 */
export function groupByCommonPrefix(
  suggestions: DestinatarioSuggestion[]
): DestinatarioSuggestion[] {
  if (suggestions.length <= 1) return suggestions;

  const sorted = [...suggestions].sort((a, b) =>
    a.cleanedPattern.localeCompare(b.cleanedPattern)
  );

  const groups: DestinatarioSuggestion[] = [];
  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const prefix = getCommonPrefix(current.cleanedPattern, next.cleanedPattern);
    const prefixTokens = prefix.trim().split(/\s+/).filter(Boolean);

    if (prefixTokens.length >= 2) {
      current = {
        cleanedPattern: prefix.trim(),
        count: current.count + next.count,
        rawDescriptions: [...current.rawDescriptions, ...next.rawDescriptions],
        transactionPreviews: [
          ...current.transactionPreviews,
          ...next.transactionPreviews,
        ].slice(0, 5),
      };
    } else {
      groups.push(current);
      current = next;
    }
  }
  groups.push(current);

  groups.sort((a, b) => b.count - a.count);
  return groups;
}
