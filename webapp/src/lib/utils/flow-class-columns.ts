import {
  classifyFlow,
  FLOW_CLASS_RULES_VERSION,
  type FlowClassInput,
} from "@zeta/shared";

/**
 * The `flow_class` column bag for an INSERT into `transactions`.
 *
 * Every write path goes through this rather than calling `classifyFlow()` and
 * spreading the fields by hand, for one reason: `flow_class_version` has to be
 * stamped with the rules version that actually produced the verdict, or the
 * re-derivation story stops working — a row claiming version 1 that was written
 * by version 2 rules can never be found and fixed. Bundling the two makes
 * forgetting the version impossible instead of merely discouraged.
 *
 * `source_pattern` is persisted alongside the verdict on purpose. The verdict is
 * derived; the parser's raw signal is evidence. Keeping the evidence is what
 * lets a rules bump re-classify old rows from stored inputs instead of
 * re-parsing statements nobody has anymore.
 *
 * Not written here: `flow_class_override`. No automatic path may ever set it —
 * it is the user's channel, and the whole point of having two columns is that a
 * rules bump can rewrite `flow_class` without touching a human decision.
 */
export function flowClassColumns(input: FlowClassInput): {
  flow_class: string;
  flow_class_version: number;
  source_pattern: string | null;
} {
  const { flowClass } = classifyFlow(input);
  return {
    flow_class: flowClass,
    flow_class_version: FLOW_CLASS_RULES_VERSION,
    source_pattern: input.sourcePattern ?? null,
  };
}
