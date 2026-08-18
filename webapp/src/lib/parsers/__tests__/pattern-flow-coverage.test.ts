import { describe, it, expect } from "vitest";
import { EMAIL_PATTERN_TO_FLOW } from "@zeta/shared";
import { BANCOLOMBIA_PATTERN_TYPES } from "../bancolombia-email";

/**
 * Contract between the email parser and the flow classifier.
 *
 * The parser and the classifier live in different packages and are edited by
 * different work. When PR #385 added four Bancolombia formats, the classifier
 * kept working — unmapped hints fall through to the description rules — but
 * those four emails silently dropped from a 0.95 verdict to the 0.6
 * `default:outflow` guess. Nothing failed, so nothing said so.
 *
 * This test makes that decision explicit. Adding a pattern_type without either
 * mapping it or listing it below is now a failure, not a silent downgrade.
 */

/**
 * Patterns intentionally left out of EMAIL_PATTERN_TO_FLOW.
 *
 * A hint maps at confidence 0.95, which OUTRANKS every description rule. That
 * is right when the parser's verb settles the question and wrong when it does
 * not — for these, the 0.6 fall-through is the better answer because it leaves
 * the text rules free to correct it.
 */
const DELIBERATELY_UNMAPPED: Record<string, string> = {
  transferencia:
    "outbound and unqualified — indistinguishable from a merchant payment without a counterpart",
  factura_programada:
    "a scheduled bill can be a credit-card bill (DEBT_PAYMENT); mapping to SPEND would block `pago tarjeta` from firing",
  recarga:
    "a Civica top-up is consumption, a Nequi/Daviplata top-up is a SELF_TRANSFER; the parser cannot tell them apart",
};

describe("every Bancolombia pattern_type has a flow-class decision", () => {
  it.each(BANCOLOMBIA_PATTERN_TYPES)("%s", (patternType) => {
    const mapped = EMAIL_PATTERN_TO_FLOW[patternType];
    const excused = DELIBERATELY_UNMAPPED[patternType];

    expect(
      mapped !== undefined || excused !== undefined,
      `pattern_type "${patternType}" is neither in EMAIL_PATTERN_TO_FLOW nor in ` +
        `DELIBERATELY_UNMAPPED. Decide which it is: map it if the parser's verb ` +
        `settles the flow class, or add it to DELIBERATELY_UNMAPPED with the reason.`,
    ).toBe(true);

    // A pattern cannot be both mapped and excused — that reads as a decision
    // made twice, in opposite directions.
    expect(
      mapped !== undefined && excused !== undefined,
      `pattern_type "${patternType}" is both mapped and listed as unmapped.`,
    ).toBe(false);
  });

  it("does not carry stale entries for patterns the parser no longer emits", () => {
    const live = new Set<string>(BANCOLOMBIA_PATTERN_TYPES);
    // PY_HINT_TO_FLOW keys (PDF parser hints) share the map, so only check the
    // ones this file claims to own.
    for (const key of Object.keys(DELIBERATELY_UNMAPPED)) {
      expect(live.has(key), `DELIBERATELY_UNMAPPED lists "${key}", which the parser no longer emits`).toBe(true);
    }
  });
});
