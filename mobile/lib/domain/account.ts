import type { Account } from "@zeta/shared";
import type { AccountRow } from "../repositories/accounts";

export function toDomainAccount(row: AccountRow): Account {
  return {
    ...row,
    account_type: row.account_type as Account["account_type"],
    currency_code: row.currency_code as Account["currency_code"],
    is_active: row.is_active === 1,
    connection_status: "DISCONNECTED",
    provider: "MANUAL",
    currency_balances: null,
    display_order: 0,
    expected_return_rate: null,
    initial_investment: null,
    last_synced_at: null,
    loan_amount: null,
    loan_end_date: null,
    loan_start_date: null,
    mask: null,
    maturity_date: null,
    monthly_payment: row.monthly_payment,
    provider_account_id: null,
  };
}
