/**
 * HTTP client for the Zeta API.
 * All requests use the capture token for auth.
 */
export declare function getSummary(currency?: string): Promise<unknown>;
export declare function getAccounts(): Promise<unknown>;
export declare function getTransactions(filters: {
    account_id?: string;
    category_id?: string;
    direction?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
    page?: string;
    page_size?: string;
}): Promise<unknown>;
export declare function getBudgets(currency?: string): Promise<unknown>;
export declare function getDebts(currency?: string): Promise<unknown>;
export declare function createTransaction(content: string, accountId?: string): Promise<unknown>;
