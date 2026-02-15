export interface AccountFormDefaults {
  name?: string;
  account_type?: string;
  currency_code?: string;
  institution_name?: string;
  mask?: string;
  color?: string;
  current_balance?: number;
  credit_limit?: number;
  interest_rate?: number;
  cutoff_day?: number;
  payment_day?: number;
  loan_amount?: number;
  monthly_payment?: number;
  loan_start_month?: number;
  loan_start_year?: number;
  loan_end_month?: number;
  loan_end_year?: number;
  initial_investment?: number;
  expected_return_rate?: number;
  maturity_month?: number;
  maturity_year?: number;
}
