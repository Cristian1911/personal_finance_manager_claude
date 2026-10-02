import { supabase } from "../supabase";

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

/** Mirrors webapp/src/lib/engine/v2-statement.ts (the phone can't import the web app). */
export interface StatementPlan {
  index: number;
  bank: string;
  kind: "savings" | "credit_card" | "loan" | "investment";
  last4: string | null;
  period: { from: string | null; to: string | null };
  rows: number;
  accountId: string | null;
  suggested: { name: string; accountType: string } | null;
  options: { id: string; name: string }[];
}
export type StatementChoice = { index: number; accountId?: string; create?: { accountId: string; name: string }; skip?: boolean };
export interface StatementResult {
  index: number; account: string; created: boolean; nuevos: number; yaEstaban: number; paraRevisar: number;
  otraMoneda: number; errores: number; balance: number | null;
}
export type StatementAnswer =
  | { kind: "results"; results: StatementResult[] }
  | { kind: "needs"; plans: StatementPlan[] }
  | { kind: "password" }
  | { kind: "error"; message: string };

/** Sends the PDF to Zeta (it reads it and imports it as commands); the phone then pulls. */
export async function uploadStatement(
  file: { uri: string; name: string },
  opts: { password?: string; choices?: StatementChoice[] } = {},
): Promise<StatementAnswer> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!API || !token) return { kind: "error", message: "Inicia sesión para subir extractos." };
  const form = new FormData();
  // React Native's FormData takes a file as { uri, name, type }.
  form.append("file", { uri: file.uri, name: file.name, type: "application/pdf" } as unknown as Blob);
  if (opts.password) form.append("password", opts.password);
  if (opts.choices) form.append("choices", JSON.stringify(opts.choices));
  let res: Response;
  try {
    res = await fetch(`${API}/api/v2/import-pdf`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: form });
  } catch {
    return { kind: "error", message: "Sin conexión. Intenta de nuevo cuando tengas internet." };
  }
  const body = await res.json().catch(() => ({}));
  if (res.ok && body.results) return { kind: "results", results: body.results };
  if (res.ok && body.needs) return { kind: "needs", plans: body.needs };
  if (body.errorType === "password_required" || body.errorType === "invalid_password" || body.errorType === "wrong_password") return { kind: "password" };
  return { kind: "error", message: body.error ?? "No pudimos leer este PDF." };
}
