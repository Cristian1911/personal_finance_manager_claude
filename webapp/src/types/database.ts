export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          available_balance: number | null
          color: string | null
          connection_status: Database["public"]["Enums"]["connection_status"]
          created_at: string
          credit_limit: number | null
          currency_balances: Json | null
          currency_code: Database["public"]["Enums"]["currency_code"]
          current_balance: number
          cutoff_day: number | null
          display_order: number
          expected_return_rate: number | null
          icon: string | null
          id: string
          initial_investment: number | null
          institution_name: string | null
          interest_rate: number | null
          is_active: boolean
          last_synced_at: string | null
          loan_amount: number | null
          loan_end_date: string | null
          loan_start_date: string | null
          mask: string | null
          maturity_date: string | null
          monthly_payment: number | null
          name: string
          payment_day: number | null
          provider: Database["public"]["Enums"]["data_provider"]
          provider_account_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type: Database["public"]["Enums"]["account_type"]
          available_balance?: number | null
          color?: string | null
          connection_status?: Database["public"]["Enums"]["connection_status"]
          created_at?: string
          credit_limit?: number | null
          currency_balances?: Json | null
          currency_code?: Database["public"]["Enums"]["currency_code"]
          current_balance?: number
          cutoff_day?: number | null
          display_order?: number
          expected_return_rate?: number | null
          icon?: string | null
          id?: string
          initial_investment?: number | null
          institution_name?: string | null
          interest_rate?: number | null
          is_active?: boolean
          last_synced_at?: string | null
          loan_amount?: number | null
          loan_end_date?: string | null
          loan_start_date?: string | null
          mask?: string | null
          maturity_date?: string | null
          monthly_payment?: number | null
          name: string
          payment_day?: number | null
          provider?: Database["public"]["Enums"]["data_provider"]
          provider_account_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          available_balance?: number | null
          color?: string | null
          connection_status?: Database["public"]["Enums"]["connection_status"]
          created_at?: string
          credit_limit?: number | null
          currency_balances?: Json | null
          currency_code?: Database["public"]["Enums"]["currency_code"]
          current_balance?: number
          cutoff_day?: number | null
          display_order?: number
          expected_return_rate?: number | null
          icon?: string | null
          id?: string
          initial_investment?: number | null
          institution_name?: string | null
          interest_rate?: number | null
          is_active?: boolean
          last_synced_at?: string | null
          loan_amount?: number | null
          loan_end_date?: string | null
          loan_start_date?: string | null
          mask?: string | null
          maturity_date?: string | null
          monthly_payment?: number | null
          name?: string
          payment_day?: number | null
          provider?: Database["public"]["Enums"]["data_provider"]
          provider_account_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          id: string
          period: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          id?: string
          period?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          id?: string
          period?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          created_at: string
          direction: Database["public"]["Enums"]["transaction_direction"] | null
          display_order: number
          icon: string
          id: string
          is_active: boolean
          is_essential: boolean
          is_system: boolean
          name: string
          name_es: string | null
          parent_id: string | null
          slug: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          direction?:
            | Database["public"]["Enums"]["transaction_direction"]
            | null
          display_order?: number
          icon?: string
          id?: string
          is_active?: boolean
          is_essential?: boolean
          is_system?: boolean
          name: string
          name_es?: string | null
          parent_id?: string | null
          slug: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          direction?:
            | Database["public"]["Enums"]["transaction_direction"]
            | null
          display_order?: number
          icon?: string
          id?: string
          is_active?: boolean
          is_essential?: boolean
          is_system?: boolean
          name?: string
          name_es?: string | null
          parent_id?: string | null
          slug?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      category_rules: {
        Row: {
          category_id: string
          created_at: string
          id: string
          match_count: number
          pattern: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          match_count?: number
          pattern: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          match_count?: number
          pattern?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          app_purpose: string | null
          avatar_url: string | null
          created_at: string
          email: string
          estimated_monthly_expenses: number | null
          estimated_monthly_income: number | null
          full_name: string | null
          id: string
          locale: string
          onboarding_completed: boolean
          preferred_currency: Database["public"]["Enums"]["currency_code"]
          timezone: string
          updated_at: string
        }
        Insert: {
          app_purpose?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          estimated_monthly_expenses?: number | null
          estimated_monthly_income?: number | null
          full_name?: string | null
          id: string
          locale?: string
          onboarding_completed?: boolean
          preferred_currency?: Database["public"]["Enums"]["currency_code"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          app_purpose?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          estimated_monthly_expenses?: number | null
          estimated_monthly_income?: number | null
          full_name?: string | null
          id?: string
          locale?: string
          onboarding_completed?: boolean
          preferred_currency?: Database["public"]["Enums"]["currency_code"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_transaction_templates: {
        Row: {
          account_id: string
          amount: number
          category_id: string | null
          created_at: string
          currency_code: Database["public"]["Enums"]["currency_code"]
          day_of_month: number | null
          day_of_week: number | null
          description: string | null
          direction: Database["public"]["Enums"]["transaction_direction"]
          end_date: string | null
          frequency: Database["public"]["Enums"]["recurrence_frequency"]
          id: string
          is_active: boolean
          merchant_name: string | null
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          category_id?: string | null
          created_at?: string
          currency_code?: Database["public"]["Enums"]["currency_code"]
          day_of_month?: number | null
          day_of_week?: number | null
          description?: string | null
          direction: Database["public"]["Enums"]["transaction_direction"]
          end_date?: string | null
          frequency: Database["public"]["Enums"]["recurrence_frequency"]
          id?: string
          is_active?: boolean
          merchant_name?: string | null
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string | null
          created_at?: string
          currency_code?: Database["public"]["Enums"]["currency_code"]
          day_of_month?: number | null
          day_of_week?: number | null
          description?: string | null
          direction?: Database["public"]["Enums"]["transaction_direction"]
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          id?: string
          is_active?: boolean
          merchant_name?: string | null
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transaction_templates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transaction_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transaction_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      statement_snapshots: {
        Row: {
          account_id: string
          available_credit: number | null
          created_at: string
          credit_limit: number | null
          currency_code: string
          final_balance: number | null
          id: string
          imported_count: number
          initial_amount: number | null
          installments_in_default: number | null
          interest_charged: number | null
          interest_rate: number | null
          late_interest_rate: number | null
          loan_number: string | null
          minimum_payment: number | null
          payment_due_date: string | null
          period_from: string | null
          period_to: string | null
          previous_balance: number | null
          purchases_and_charges: number | null
          remaining_balance: number | null
          skipped_count: number
          source_filename: string | null
          total_credits: number | null
          total_debits: number | null
          total_payment_due: number | null
          transaction_count: number
          user_id: string
        }
        Insert: {
          account_id: string
          available_credit?: number | null
          created_at?: string
          credit_limit?: number | null
          currency_code?: string
          final_balance?: number | null
          id?: string
          imported_count?: number
          initial_amount?: number | null
          installments_in_default?: number | null
          interest_charged?: number | null
          interest_rate?: number | null
          late_interest_rate?: number | null
          loan_number?: string | null
          minimum_payment?: number | null
          payment_due_date?: string | null
          period_from?: string | null
          period_to?: string | null
          previous_balance?: number | null
          purchases_and_charges?: number | null
          remaining_balance?: number | null
          skipped_count?: number
          source_filename?: string | null
          total_credits?: number | null
          total_debits?: number | null
          total_payment_due?: number | null
          transaction_count?: number
          user_id: string
        }
        Update: {
          account_id?: string
          available_credit?: number | null
          created_at?: string
          credit_limit?: number | null
          currency_code?: string
          final_balance?: number | null
          id?: string
          imported_count?: number
          initial_amount?: number | null
          installments_in_default?: number | null
          interest_charged?: number | null
          interest_rate?: number | null
          late_interest_rate?: number | null
          loan_number?: string | null
          minimum_payment?: number | null
          payment_due_date?: string | null
          period_from?: string | null
          period_to?: string | null
          previous_balance?: number | null
          purchases_and_charges?: number | null
          remaining_balance?: number | null
          skipped_count?: number
          source_filename?: string | null
          total_credits?: number | null
          total_debits?: number | null
          total_payment_due?: number | null
          transaction_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "statement_snapshots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          amount_in_base_currency: number | null
          categorization_confidence: number | null
          categorization_source: Database["public"]["Enums"]["categorization_source"]
          category_id: string | null
          clean_description: string | null
          created_at: string
          currency_code: Database["public"]["Enums"]["currency_code"]
          direction: Database["public"]["Enums"]["transaction_direction"]
          exchange_rate: number
          id: string
          idempotency_key: string
          installment_current: number | null
          installment_group_id: string | null
          installment_total: number | null
          is_excluded: boolean
          is_recurring: boolean
          is_subscription: boolean
          merchant_category_code: string | null
          merchant_logo_url: string | null
          merchant_name: string | null
          notes: string | null
          posting_date: string | null
          provider: Database["public"]["Enums"]["data_provider"]
          provider_transaction_id: string | null
          raw_description: string | null
          recurrence_group_id: string | null
          secondary_category_id: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          tags: string[] | null
          transaction_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          amount_in_base_currency?: number | null
          categorization_confidence?: number | null
          categorization_source?: Database["public"]["Enums"]["categorization_source"]
          category_id?: string | null
          clean_description?: string | null
          created_at?: string
          currency_code: Database["public"]["Enums"]["currency_code"]
          direction: Database["public"]["Enums"]["transaction_direction"]
          exchange_rate?: number
          id?: string
          idempotency_key: string
          installment_current?: number | null
          installment_group_id?: string | null
          installment_total?: number | null
          is_excluded?: boolean
          is_recurring?: boolean
          is_subscription?: boolean
          merchant_category_code?: string | null
          merchant_logo_url?: string | null
          merchant_name?: string | null
          notes?: string | null
          posting_date?: string | null
          provider?: Database["public"]["Enums"]["data_provider"]
          provider_transaction_id?: string | null
          raw_description?: string | null
          recurrence_group_id?: string | null
          secondary_category_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          tags?: string[] | null
          transaction_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          amount_in_base_currency?: number | null
          categorization_confidence?: number | null
          categorization_source?: Database["public"]["Enums"]["categorization_source"]
          category_id?: string | null
          clean_description?: string | null
          created_at?: string
          currency_code?: Database["public"]["Enums"]["currency_code"]
          direction?: Database["public"]["Enums"]["transaction_direction"]
          exchange_rate?: number
          id?: string
          idempotency_key?: string
          installment_current?: number | null
          installment_group_id?: string | null
          installment_total?: number | null
          is_excluded?: boolean
          is_recurring?: boolean
          is_subscription?: boolean
          merchant_category_code?: string | null
          merchant_logo_url?: string | null
          merchant_name?: string | null
          notes?: string | null
          posting_date?: string | null
          provider?: Database["public"]["Enums"]["data_provider"]
          provider_transaction_id?: string | null
          raw_description?: string | null
          recurrence_group_id?: string | null
          secondary_category_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          tags?: string[] | null
          transaction_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_secondary_category_id_fkey"
            columns: ["secondary_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      account_type:
        | "CHECKING"
        | "SAVINGS"
        | "CREDIT_CARD"
        | "CASH"
        | "INVESTMENT"
        | "LOAN"
        | "OTHER"
      categorization_source:
        | "SYSTEM_DEFAULT"
        | "USER_CREATED"
        | "ML_MODEL"
        | "USER_OVERRIDE"
        | "USER_LEARNED"
      connection_status: "CONNECTED" | "DISCONNECTED" | "ERROR" | "PENDING"
      currency_code:
        | "COP"
        | "BRL"
        | "MXN"
        | "USD"
        | "EUR"
        | "PEN"
        | "CLP"
        | "ARS"
      data_provider:
        | "MANUAL"
        | "BELVO"
        | "PROMETEO"
        | "PLAID"
        | "CSV_IMPORT"
        | "OCR"
      recurrence_frequency:
        | "WEEKLY"
        | "BIWEEKLY"
        | "MONTHLY"
        | "QUARTERLY"
        | "ANNUAL"
      transaction_direction: "INFLOW" | "OUTFLOW"
      transaction_status: "PENDING" | "POSTED" | "CANCELLED"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: [
        "CHECKING",
        "SAVINGS",
        "CREDIT_CARD",
        "CASH",
        "INVESTMENT",
        "LOAN",
        "OTHER",
      ],
      categorization_source: [
        "SYSTEM_DEFAULT",
        "USER_CREATED",
        "ML_MODEL",
        "USER_OVERRIDE",
        "USER_LEARNED",
      ],
      connection_status: ["CONNECTED", "DISCONNECTED", "ERROR", "PENDING"],
      currency_code: ["COP", "BRL", "MXN", "USD", "EUR", "PEN", "CLP", "ARS"],
      data_provider: [
        "MANUAL",
        "BELVO",
        "PROMETEO",
        "PLAID",
        "CSV_IMPORT",
        "OCR",
      ],
      recurrence_frequency: [
        "WEEKLY",
        "BIWEEKLY",
        "MONTHLY",
        "QUARTERLY",
        "ANNUAL",
      ],
      transaction_direction: ["INFLOW", "OUTFLOW"],
      transaction_status: ["PENDING", "POSTED", "CANCELLED"],
    },
  },
} as const
