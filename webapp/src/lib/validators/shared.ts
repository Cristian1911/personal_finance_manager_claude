import { z } from "zod";

/**
 * Permissive UUID validator — accepts any 8-4-4-4-12 hex string.
 * Zod 4's z.string().uuid() enforces RFC 9562 version/variant bits,
 * which rejects our seed category UUIDs (e.g. a0000001-0001-4000-8000-...).
 */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const uuidStr = (msg = "UUID inválido") => z.string().regex(UUID_RE, msg);
