/**
 * HTTP client for the Zeta API.
 * All requests use the capture token for auth.
 */

const apiUrl = process.env.ZETA_API_URL ?? "http://localhost:3000";
const token = process.env.ZETA_CAPTURE_TOKEN ?? "";

const authHeaders: Record<string, string> = {
  "Authorization": `Bearer ${token}`,
};

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, apiUrl);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), { headers: authHeaders });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zeta API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const url = new URL(path, apiUrl);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zeta API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── API methods ─────────────────────────────────────────────────────────────

export async function getSummary(currency?: string) {
  return get("/api/mcp/summary", { currency: currency ?? "" });
}

export async function getAccounts() {
  return get("/api/mcp/accounts");
}

export async function getTransactions(filters: {
  account_id?: string;
  category_id?: string;
  direction?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: string;
  page_size?: string;
}) {
  return get("/api/mcp/transactions", filters as Record<string, string>);
}

export async function getBudgets(currency?: string) {
  return get("/api/mcp/budgets", { currency: currency ?? "" });
}

export async function getDebts(currency?: string) {
  return get("/api/mcp/debts", { currency: currency ?? "" });
}

export async function createTransaction(content: string, accountId?: string) {
  return post("/api/capture", {
    type: "text",
    content,
    account_id: accountId,
  });
}
