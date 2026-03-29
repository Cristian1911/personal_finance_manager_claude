/**
 * HTTP client for the Zeta API.
 * All requests use the capture token for auth.
 */
const apiUrl = process.env.ZETA_API_URL ?? "http://localhost:3000";
const token = process.env.ZETA_CAPTURE_TOKEN ?? "";
const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
};
async function get(path, params) {
    const url = new URL(path, apiUrl);
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== "")
                url.searchParams.set(k, v);
        }
    }
    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Zeta API ${res.status}: ${body}`);
    }
    return res.json();
}
async function post(path, body) {
    const url = new URL(path, apiUrl);
    const res = await fetch(url.toString(), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Zeta API ${res.status}: ${text}`);
    }
    return res.json();
}
// ── API methods ─────────────────────────────────────────────────────────────
export async function getSummary(currency) {
    return get("/api/mcp/summary", { currency: currency ?? "" });
}
export async function getAccounts() {
    return get("/api/mcp/accounts");
}
export async function getTransactions(filters) {
    return get("/api/mcp/transactions", filters);
}
export async function getBudgets(currency) {
    return get("/api/mcp/budgets", { currency: currency ?? "" });
}
export async function getDebts(currency) {
    return get("/api/mcp/debts", { currency: currency ?? "" });
}
export async function createTransaction(content, accountId) {
    return post("/api/capture", {
        type: "text",
        content,
        account_id: accountId,
    });
}
