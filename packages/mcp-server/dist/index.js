#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as api from "./api-client.js";
const server = new McpServer({
    name: "zeta",
    version: "0.1.0",
});
// ── Tools ───────────────────────────────────────────────────────────────────
server.tool("get_financial_summary", "Obtener un resumen financiero: saldo total, disponible para gastar, pagos pendientes, deudas. Úsalo cuando el usuario pregunte '¿cómo voy?', '¿cuánto tengo?', o '¿puedo gastar X?'.", {
    currency: z.string().optional().describe("Código de moneda (default: COP)"),
}, async ({ currency }) => {
    const data = await api.getSummary(currency);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("get_accounts", "Listar todas las cuentas financieras con saldos, tipos y monedas. Incluye cuentas de ahorro, corrientes, tarjetas de crédito y préstamos.", {}, async () => {
    const data = await api.getAccounts();
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("get_transactions", "Buscar transacciones con filtros opcionales. Úsalo para responder '¿cuánto gasté en X?', '¿qué compré ayer?', o analizar patrones de gasto.", {
    account_id: z.string().optional().describe("Filtrar por cuenta"),
    category_id: z.string().optional().describe("Filtrar por categoría"),
    direction: z.enum(["INFLOW", "OUTFLOW"]).optional().describe("INFLOW = ingresos, OUTFLOW = gastos"),
    date_from: z.string().optional().describe("Fecha desde (YYYY-MM-DD)"),
    date_to: z.string().optional().describe("Fecha hasta (YYYY-MM-DD)"),
    search: z.string().optional().describe("Buscar por descripción o comercio"),
    page: z.string().optional().describe("Página (default: 1)"),
    page_size: z.string().optional().describe("Resultados por página (default: 20, max: 100)"),
}, async (filters) => {
    const data = await api.getTransactions(filters);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("get_budget_status", "Ver el estado del presupuesto mensual: cuánto se asignó, cuánto se gastó y cuánto queda por categoría. Responde '¿cómo va mi presupuesto?'.", {
    currency: z.string().optional().describe("Código de moneda (default: COP)"),
}, async ({ currency }) => {
    const data = await api.getBudgets(currency);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("get_debts", "Ver todas las deudas: tarjetas de crédito y préstamos con saldos, tasas de interés y pagos mensuales.", {
    currency: z.string().optional().describe("Código de moneda (default: COP)"),
}, async ({ currency }) => {
    const data = await api.getDebts(currency);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("create_transaction", "Registrar una transacción a partir de texto natural. Ejemplos: 'gasté 15k en café', 'me pagaron 500 mil', 'uber 8 mil ayer'. El sistema interpreta monto, tipo (gasto/ingreso) y descripción automáticamente.", {
    text: z.string().describe("Texto descriptivo de la transacción"),
    account_id: z.string().optional().describe("ID de la cuenta (usa la predeterminada si no se especifica)"),
}, async ({ text, account_id }) => {
    const data = await api.createTransaction(text, account_id);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
// ── Start ───────────────────────────────────────────────────────────────────
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((err) => {
    console.error("Zeta MCP server error:", err);
    process.exit(1);
});
