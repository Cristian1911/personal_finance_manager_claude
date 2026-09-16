import type { RecurringCandidate } from "@zeta/shared";

/**
 * Discovery id shared by the transaction callout, the Inicio card (slice 6)
 * and `DiscoveryInline` (slice 7). Plain module on purpose: the server page
 * calls it, so it must not live in a "use client" file.
 */
export function recurringDiscoveryId(candidate: RecurringCandidate): string {
  return `recurring:${candidate.key}`;
}

/** Shape accepted by `dismissDiscovery`: `recurring:<dest|desc>:<key>:<CUR>`. */
export const DISCOVERY_ID_PATTERN = /^recurring:(dest|desc):.+:[A-Z]{3}$/;
