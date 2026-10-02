import { supabase } from "../supabase";

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

export interface ForwardingAddress { address: string; gmailVerificationUrl: string | null }

/** The user's "reenvía tus alertas aquí" address (created on first ask). Null when signed out or offline. */
export async function getForwardingAddress(): Promise<ForwardingAddress | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token || !API) return null;
  const res = await fetch(`${API}/api/v2/email-address`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`email-address ${res.status}`);
  return res.json();
}
