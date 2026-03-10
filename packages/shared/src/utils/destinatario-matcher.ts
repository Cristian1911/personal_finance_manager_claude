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
  pattern: string;
  count: number;
  sample_descriptions: string[];
}

// ─── Prepared rules (pre-sorted + pre-lowercased) ────────────────────────────

export type PreparedDestinatarioRule = DestinatarioRule & {
  _lowerPattern: string;
};

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
 * Tokenize a cleaned description into significant tokens.
 * Keeps tokens that are 3+ characters and not purely numeric.
 */
function extractTokens(cleaned: string): string[] {
  return cleaned
    .split(/[\s\W_]+/)
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t));
}

/**
 * Generate candidate patterns from consecutive token sequences (1-3 tokens).
 */
function generateCandidatePatterns(tokens: string[]): string[] {
  const candidates: string[] = [];
  for (let len = 1; len <= 3; len++) {
    for (let i = 0; i <= tokens.length - len; i++) {
      candidates.push(tokens.slice(i, i + len).join(" "));
    }
  }
  return candidates;
}

/**
 * Analyze unmatched transaction descriptions to suggest new destinatario patterns.
 * Groups descriptions by recurring token patterns and returns suggestions
 * for patterns that appear in at least `minCount` unique descriptions.
 */
export function detectDestinatarioSuggestions(
  unmatchedDescriptions: string[],
  minCount: number = 2
): DestinatarioSuggestion[] {
  // 1. Clean descriptions
  const cleanedDescriptions = unmatchedDescriptions
    .map((d) => d.toLowerCase().trim())
    .filter((d) => d.length > 0);

  // 2. Build pattern -> unique descriptions map
  const patternDescriptions = new Map<string, Set<string>>();

  for (const desc of cleanedDescriptions) {
    const tokens = extractTokens(desc);
    const candidates = generateCandidatePatterns(tokens);

    for (const candidate of candidates) {
      if (!patternDescriptions.has(candidate)) {
        patternDescriptions.set(candidate, new Set());
      }
      patternDescriptions.get(candidate)!.add(desc);
    }
  }

  // 3. Filter to patterns meeting minCount threshold
  const qualifying: { pattern: string; descriptions: Set<string> }[] = [];

  for (const [pattern, descs] of patternDescriptions) {
    if (descs.size >= minCount) {
      qualifying.push({ pattern, descriptions: descs });
    }
  }

  // 4. Sort by unique description count desc, then pattern length desc
  qualifying.sort((a, b) => {
    const countDiff = b.descriptions.size - a.descriptions.size;
    if (countDiff !== 0) return countDiff;
    return b.pattern.length - a.pattern.length;
  });

  // 5. Deduplicate: skip patterns whose descriptions are mostly claimed
  const claimedDescriptions = new Set<string>();
  const suggestions: DestinatarioSuggestion[] = [];

  for (const { pattern, descriptions } of qualifying) {
    // Count how many of this pattern's descriptions are NOT yet claimed
    let unclaimed = 0;
    for (const desc of descriptions) {
      if (!claimedDescriptions.has(desc)) {
        unclaimed++;
      }
    }

    // Skip if most descriptions are already claimed by a better suggestion
    if (unclaimed < minCount) continue;

    // Claim these descriptions
    for (const desc of descriptions) {
      claimedDescriptions.add(desc);
    }

    // Collect up to 5 sample descriptions
    const samples: string[] = [];
    for (const desc of descriptions) {
      if (samples.length >= 5) break;
      samples.push(desc);
    }

    suggestions.push({
      pattern,
      count: descriptions.size,
      sample_descriptions: samples,
    });
  }

  return suggestions;
}
