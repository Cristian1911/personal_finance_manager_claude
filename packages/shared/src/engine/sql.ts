import type { Dialect } from "./types";

/** SQL is written with `?`; Postgres needs `$1, $2, …`. */
export function toDialect(sql: string, dialect: Dialect): string {
  if (dialect === "sqlite") return sql;
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/** Postgres returns numeric as string; SQLite returns number. */
export function toNumber(v: unknown): number {
  return typeof v === "number" ? v : Number(v);
}

/** Postgres returns timestamptz as Date; SQLite stores ISO text. */
export function toIso(v: unknown): string {
  return v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString();
}

/** Postgres returns jsonb parsed; SQLite stores JSON text. */
export function toJson<T>(v: unknown): T {
  return (typeof v === "string" ? JSON.parse(v) : v) as T;
}
