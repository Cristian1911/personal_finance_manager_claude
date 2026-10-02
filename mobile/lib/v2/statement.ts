import type { StatementInput } from "@zeta/shared";
import { supabase } from "../supabase";

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

export type ParseAnswer =
  | { kind: "statements"; statements: StatementInput[] }
  | { kind: "password" }
  | { kind: "error"; message: string };

/** Zeta's server reads the PDF (the parser is Python) and sends back the statements; nothing is saved there. */
export async function parseStatement(file: { uri: string; name: string }, password?: string): Promise<ParseAnswer> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!API || !token) return { kind: "error", message: "Inicia sesión para subir extractos." };
  const form = new FormData();
  // React Native's FormData takes a file as { uri, name, type }.
  form.append("file", { uri: file.uri, name: file.name, type: "application/pdf" } as unknown as Blob);
  if (password) form.append("password", password);
  let res: Response;
  try {
    res = await fetch(`${API}/api/v2/parse-pdf`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: form });
  } catch {
    return { kind: "error", message: "Sin conexión. Leer el PDF necesita internet; lo demás funciona sin ella." };
  }
  const body = await res.json().catch(() => ({}));
  if (res.ok && Array.isArray(body.statements)) return { kind: "statements", statements: body.statements };
  if (body.errorType === "password_required") return { kind: "password" };
  return { kind: "error", message: body.error ?? "No pudimos leer este PDF." };
}
