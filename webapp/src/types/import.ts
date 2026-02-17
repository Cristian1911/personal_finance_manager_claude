// Mirrors the Python ParseResponse from services/pdf_parser/models.py

export type ParsedTransaction = {
  date: string; // "YYYY-MM-DD"
  description: string;
  amount: number; // always positive
  direction: "INFLOW" | "OUTFLOW";
  balance: number | null;
  currency: string;
  authorization_number: string | null;
  installments: string | null; // e.g. "1/24"
};

export type StatementSummary = {
  previous_balance: number | null;
  total_credits: number | null;
  total_debits: number | null;
  final_balance: number | null;
  purchases_and_charges: number | null;
  interest_charged: number | null;
};

export type CreditCardMetadata = {
  credit_limit: number | null;
  available_credit: number | null;
  interest_rate: number | null;
  late_interest_rate: number | null;
  total_payment_due: number | null;
  minimum_payment: number | null;
  payment_due_date: string | null;
};

export type LoanMetadata = {
  loan_number: string | null;
  loan_type: string | null;
  initial_amount: number | null;
  disbursement_date: string | null;
  remaining_balance: number | null;
  interest_rate: number | null;
  late_interest_rate: number | null;
  total_payment_due: number | null;
  minimum_payment: number | null;
  payment_due_date: string | null;
  installments_in_default: number | null;
  statement_cut_date: string | null;
  last_payment_date: string | null;
};

export type ParsedStatement = {
  bank: string;
  statement_type: "savings" | "credit_card" | "loan";
  account_number: string | null;
  card_last_four: string | null;
  period_from: string | null;
  period_to: string | null;
  currency: string;
  summary: StatementSummary | null;
  credit_card_metadata: CreditCardMetadata | null;
  loan_metadata: LoanMetadata | null;
  transactions: ParsedTransaction[];
};

export type ParseResponse = {
  statements: ParsedStatement[];
};

export type StatementAccountMapping = {
  statementIndex: number;
  accountId: string;
  autoMatched: boolean;
};

export type TransactionToImport = {
  account_id: string;
  amount: number;
  currency_code: string;
  direction: "INFLOW" | "OUTFLOW";
  transaction_date: string;
  raw_description: string;
  category_id?: string | null;
  categorization_source?: "SYSTEM_DEFAULT" | "USER_CREATED" | "USER_OVERRIDE";
  categorization_confidence?: number | null;
};

export type ImportResult = {
  imported: number;
  skipped: number;
  errors: number;
  details: string[];
  accountUpdates?: AccountUpdateResult[];
};

// Metadata sent alongside transactions during import
export type StatementMetaForImport = {
  accountId: string;
  statementIndex: number;
  summary: StatementSummary | null;
  creditCardMetadata: CreditCardMetadata | null;
  loanMetadata: LoanMetadata | null;
  periodFrom: string | null;
  periodTo: string | null;
  currency: string;
  sourceFilename?: string;
  transactionCount: number;
};

// Describes a single field change between two snapshots
export type SnapshotDiff = {
  field: string;
  previousValue: number | string | null;
  currentValue: number | string | null;
  changeType: "increased" | "decreased" | "changed" | "new";
};

// Per-account update result returned after import
export type AccountUpdateResult = {
  accountId: string;
  accountName: string;
  diffs: SnapshotDiff[];
  isFirstImport: boolean;
};
