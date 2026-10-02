/** What Anotar opens on: a kind, and for Entre cuentas the destination (Pagar tarjeta). */
export interface AnotarPrefill {
  kind?: "gasto" | "ingreso" | "entre";
  toAccountId?: string;
  /** Start listening right away (the Inicio mic). */
  dictar?: boolean;
}

const openers = new Set<(p: AnotarPrefill) => void>();

/** Opens Anotar from any v2 screen (the tab layout owns the sheet). */
export function openAnotar(prefill: AnotarPrefill = {}): void {
  for (const o of openers) o(prefill);
}

export function onOpenAnotar(open: (p: AnotarPrefill) => void): () => void {
  openers.add(open);
  return () => { openers.delete(open); };
}
