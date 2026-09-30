import type { FieldVersion } from "../types";

/**
 * S1-2: the stored edit wins over (clientTs, commandId) when it is later.
 * Equal timestamps are broken by command id, so phone and server always
 * pick the same winner whatever the arrival order.
 */
export function isNewer(stored: FieldVersion, clientTs: string, commandId: string): boolean {
  const a = Date.parse(stored.clientTs);
  const b = Date.parse(clientTs);
  return a !== b ? a > b : stored.commandId > commandId;
}
