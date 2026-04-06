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
          debit_card_mask: string | null
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
          pdf_password: string | null
          provider: Database["public"]["Enums"]["data_provider"]
          provider_account_id: string | null
          show_in_dashboard: boolean
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
          debit_card_mask?: string | null
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
          pdf_password?: string | null
          provider?: Database["public"]["Enums"]["data_provider"]
          provider_account_id?: string | null
          show_in_dashboard?: boolean
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
          debit_card_mask?: string | null
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
          pdf_password?: string | null
          provider?: Database["public"]["Enums"]["data_provider"]
          provider_account_id?: string | null
          show_in_dashboard?: boolean
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
      admin_config: {
        Row: {
          id: string
          prompt_text: string | null
        }
        Insert: {
          id: string
          prompt_text?: string | null
        }
        Update: {
          id?: string
          prompt_text?: string | null
        }
        Relationships: []
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
      bug_reports: {
        Row: {
          attachment_path: string | null
          created_at: string
          description: string | null
          device_context: Json
          github_issue_url: string | null
          id: string
          route_hint: string | null
          selected_area_hint: string | null
          source: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attachment_path?: string | null
          created_at?: string
          description?: string | null
          device_context?: Json
          github_issue_url?: string | null
          id?: string
          route_hint?: string | null
          selected_area_hint?: string | null
          source?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attachment_path?: string | null
          created_at?: string
          description?: string | null
          device_context?: Json
          github_issue_url?: string | null
          id?: string
          route_hint?: string | null
          selected_area_hint?: string | null
          source?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bug_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      capture_tokens: {
        Row: {
          created_at: string
          default_account_id: string | null
          id: string
          label: string
          last_used_at: string | null
          revoked_at: string | null
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_account_id?: string | null
          id?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_account_id?: string | null
          id?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capture_tokens_default_account_id_fkey"
            columns: ["default_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
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
          expense_type: string | null
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
          expense_type?: string | null
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
          expense_type?: string | null
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
      category_tags: {
        Row: {
          category_id: string
          tag_id: string
        }
        Insert: {
          category_id: string
          tag_id: string
        }
        Update: {
          category_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_tags_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_scenarios: {
        Row: {
          allocations: Json
          cash_entries: Json
          created_at: string
          id: string
          name: string | null
          results: Json | null
          snapshot_accounts: Json
          strategy: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allocations?: Json
          cash_entries: Json
          created_at?: string
          id?: string
          name?: string | null
          results?: Json | null
          snapshot_accounts: Json
          strategy?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allocations?: Json
          cash_entries?: Json
          created_at?: string
          id?: string
          name?: string | null
          results?: Json | null
          snapshot_accounts?: Json
          strategy?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      design_reviews: {
        Row: {
          annotation_path: string | null
          component_hint: string | null
          created_at: string
          description: string | null
          device_context: Json | null
          excalidraw_path: string | null
          id: string
          resolved_at: string | null
          resolved_by: string | null
          route: string | null
          severity: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          annotation_path?: string | null
          component_hint?: string | null
          created_at?: string
          description?: string | null
          device_context?: Json | null
          excalidraw_path?: string | null
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          severity?: string
          status?: string
          title: string
          user_id: string
        }
        Update: {
          annotation_path?: string | null
          component_hint?: string | null
          created_at?: string
          description?: string | null
          device_context?: Json | null
          excalidraw_path?: string | null
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          severity?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      destinatario_rules: {
        Row: {
          created_at: string
          destinatario_id: string
          id: string
          last_matched_at: string | null
          match_count: number
          match_type: string
          pattern: string
          priority: number
          user_id: string
        }
        Insert: {
          created_at?: string
          destinatario_id: string
          id?: string
          last_matched_at?: string | null
          match_count?: number
          match_type?: string
          pattern: string
          priority?: number
          user_id: string
        }
        Update: {
          created_at?: string
          destinatario_id?: string
          id?: string
          last_matched_at?: string | null
          match_count?: number
          match_type?: string
          pattern?: string
          priority?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "destinatario_rules_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "destinatarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "destinatario_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      destinatario_tags: {
        Row: {
          destinatario_id: string
          tag_id: string
        }
        Insert: {
          destinatario_id: string
          tag_id: string
        }
        Update: {
          destinatario_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "destinatario_tags_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "destinatarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "destinatario_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      destinatarios: {
        Row: {
          created_at: string
          default_category_id: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_category_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_category_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "destinatarios_default_category_id_fkey"
            columns: ["default_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "destinatarios_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_ingest_addresses: {
        Row: {
          account_id: string | null
          address_key: string
          allowed_sender: string | null
          auto_import: boolean
          created_at: string
          gmail_verification_at: string | null
          gmail_verification_url: string | null
          id: string
          is_active: boolean
          pdf_import_enabled: boolean
          user_id: string
        }
        Insert: {
          account_id?: string | null
          address_key: string
          allowed_sender?: string | null
          auto_import?: boolean
          created_at?: string
          gmail_verification_at?: string | null
          gmail_verification_url?: string | null
          id?: string
          is_active?: boolean
          pdf_import_enabled?: boolean
          user_id: string
        }
        Update: {
          account_id?: string | null
          address_key?: string
          allowed_sender?: string | null
          auto_import?: boolean
          created_at?: string
          gmail_verification_at?: string | null
          gmail_verification_url?: string | null
          id?: string
          is_active?: boolean
          pdf_import_enabled?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_ingest_addresses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_ingest_addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_ingest_logs: {
        Row: {
          created_at: string
          email_ingest_id: string | null
          error_message: string | null
          from_address: string | null
          id: string
          raw_body: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email_ingest_id?: string | null
          error_message?: string | null
          from_address?: string | null
          id?: string
          raw_body?: string | null
          status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email_ingest_id?: string | null
          error_message?: string | null
          from_address?: string | null
          id?: string
          raw_body?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_ingest_logs_email_ingest_id_fkey"
            columns: ["email_ingest_id"]
            isOneToOne: false
            referencedRelation: "email_ingest_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_ingest_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rate_cache: {
        Row: {
          avg_30d: number | null
          fetched_at: string
          pair: string
          rate: number
          rates_30d: Json
        }
        Insert: {
          avg_30d?: number | null
          fetched_at?: string
          pair: string
          rate: number
          rates_30d?: Json
        }
        Update: {
          avg_30d?: number | null
          fetched_at?: string
          pair?: string
          rate?: number
          rates_30d?: Json
        }
        Relationships: []
      }
      financial_reminders: {
        Row: {
          amount: number | null
          completed_at: string | null
          created_at: string
          currency_code: string | null
          due_date: string | null
          id: string
          is_completed: boolean
          title: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          completed_at?: string | null
          created_at?: string
          currency_code?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean
          title: string
          user_id: string
        }
        Update: {
          amount?: number | null
          completed_at?: string | null
          created_at?: string
          currency_code?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      pending_email_statements: {
        Row: {
          created_at: string
          email_ingest_id: string
          error_message: string | null
          file_size_bytes: number | null
          from_address: string
          id: string
          idempotency_hash: string
          imported_at: string | null
          original_filename: string | null
          parsed_at: string | null
          parsed_data: Json | null
          status: string
          storage_path: string
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_ingest_id: string
          error_message?: string | null
          file_size_bytes?: number | null
          from_address: string
          id?: string
          idempotency_hash: string
          imported_at?: string | null
          original_filename?: string | null
          parsed_at?: string | null
          parsed_data?: Json | null
          status?: string
          storage_path: string
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_ingest_id?: string
          error_message?: string | null
          file_size_bytes?: number | null
          from_address?: string
          id?: string
          idempotency_hash?: string
          imported_at?: string | null
          original_filename?: string | null
          parsed_at?: string | null
          parsed_data?: Json | null
          status?: string
          storage_path?: string
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_email_statements_email_ingest_id_fkey"
            columns: ["email_ingest_id"]
            isOneToOne: false
            referencedRelation: "email_ingest_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_email_statements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_email_transactions: {
        Row: {
          created_at: string
          email_ingest_id: string
          id: string
          idempotency_key: string
          parsed_data: Json
          raw_body: string
          status: string
          suggested_account_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email_ingest_id: string
          id?: string
          idempotency_key: string
          parsed_data: Json
          raw_body: string
          status?: string
          suggested_account_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email_ingest_id?: string
          id?: string
          idempotency_key?: string
          parsed_data?: Json
          raw_body?: string
          status?: string
          suggested_account_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_email_transactions_email_ingest_id_fkey"
            columns: ["email_ingest_id"]
            isOneToOne: false
            referencedRelation: "email_ingest_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_email_transactions_suggested_account_id_fkey"
            columns: ["suggested_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_email_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_assignments: {
        Row: {
          assigned_amount: number
          created_at: string
          expense_entry_id: string
          id: string
          income_entry_id: string
          period_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_amount: number
          created_at?: string
          expense_entry_id: string
          id?: string
          income_entry_id: string
          period_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_amount?: number
          created_at?: string
          expense_entry_id?: string
          id?: string
          income_entry_id?: string
          period_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_assignments_expense_entry_id_fkey"
            columns: ["expense_entry_id"]
            isOneToOne: false
            referencedRelation: "planning_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_assignments_income_entry_id_fkey"
            columns: ["income_entry_id"]
            isOneToOne: false
            referencedRelation: "planning_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_assignments_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "planning_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_entries: {
        Row: {
          account_id: string | null
          amount: number
          category_id: string | null
          completed_at: string | null
          created_at: string
          entry_type: Database["public"]["Enums"]["planning_entry_type"]
          expected_date: string
          id: string
          label: string
          notes: string | null
          period_id: string
          recurring_template_id: string | null
          sort_order: number
          status: Database["public"]["Enums"]["planning_entry_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id?: string | null
          completed_at?: string | null
          created_at?: string
          entry_type: Database["public"]["Enums"]["planning_entry_type"]
          expected_date: string
          id?: string
          label: string
          notes?: string | null
          period_id: string
          recurring_template_id?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["planning_entry_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string | null
          completed_at?: string | null
          created_at?: string
          entry_type?: Database["public"]["Enums"]["planning_entry_type"]
          expected_date?: string
          id?: string
          label?: string
          notes?: string | null
          period_id?: string
          recurring_template_id?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["planning_entry_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "planning_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_entries_recurring_template_id_fkey"
            columns: ["recurring_template_id"]
            isOneToOne: false
            referencedRelation: "recurring_transaction_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_periods: {
        Row: {
          created_at: string
          currency_code: Database["public"]["Enums"]["currency_code"]
          end_date: string
          id: string
          is_active: boolean
          name: string | null
          notes: string | null
          preset: Database["public"]["Enums"]["planning_period_preset"]
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency_code?: Database["public"]["Enums"]["currency_code"]
          end_date: string
          id?: string
          is_active?: boolean
          name?: string | null
          notes?: string | null
          preset?: Database["public"]["Enums"]["planning_period_preset"]
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency_code?: Database["public"]["Enums"]["currency_code"]
          end_date?: string
          id?: string
          is_active?: boolean
          name?: string | null
          notes?: string | null
          preset?: Database["public"]["Enums"]["planning_period_preset"]
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_events: {
        Row: {
          created_at: string
          duration_ms: number | null
          entry_point: string | null
          error_code: string | null
          event_name: string
          event_time: string
          flow: string | null
          id: string
          metadata: Json
          platform: string
          session_id: string | null
          step: string | null
          success: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          entry_point?: string | null
          error_code?: string | null
          event_name: string
          event_time?: string
          flow?: string | null
          id?: string
          metadata?: Json
          platform?: string
          session_id?: string | null
          step?: string | null
          success?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          entry_point?: string | null
          error_code?: string | null
          event_name?: string
          event_time?: string
          flow?: string | null
          id?: string
          metadata?: Json
          platform?: string
          session_id?: string | null
          step?: string | null
          success?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_events_user_id_fkey"
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
          budget_mode: string | null
          created_at: string
          dashboard_config: Json | null
          email: string
          estimated_monthly_expenses: number | null
          estimated_monthly_income: number | null
          full_name: string | null
          id: string
          locale: string
          monthly_salary: number | null
          onboarding_completed: boolean
          preferred_currency: Database["public"]["Enums"]["currency_code"]
          timezone: string
          updated_at: string
        }
        Insert: {
          app_purpose?: string | null
          avatar_url?: string | null
          budget_mode?: string | null
          created_at?: string
          dashboard_config?: Json | null
          email: string
          estimated_monthly_expenses?: number | null
          estimated_monthly_income?: number | null
          full_name?: string | null
          id: string
          locale?: string
          monthly_salary?: number | null
          onboarding_completed?: boolean
          preferred_currency?: Database["public"]["Enums"]["currency_code"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          app_purpose?: string | null
          avatar_url?: string | null
          budget_mode?: string | null
          created_at?: string
          dashboard_config?: Json | null
          email?: string
          estimated_monthly_expenses?: number | null
          estimated_monthly_income?: number | null
          full_name?: string | null
          id?: string
          locale?: string
          monthly_salary?: number | null
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
          transfer_source_account_id: string | null
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
          transfer_source_account_id?: string | null
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
          transfer_source_account_id?: string | null
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
            foreignKeyName: "recurring_transaction_templates_transfer_source_account_id_fkey"
            columns: ["transfer_source_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
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
          updated_at: string
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
          updated_at?: string
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
          updated_at?: string
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
      tag_groups: {
        Row: {
          color: string | null
          created_at: string
          display_order: number
          id: string
          is_system: boolean
          name: string
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_system?: boolean
          name: string
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_system?: boolean
          name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tag_groups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          display_order: number
          group_id: string | null
          id: string
          is_system: boolean
          name: string
          slug: string
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          display_order?: number
          group_id?: string | null
          id?: string
          is_system?: boolean
          name: string
          slug: string
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          display_order?: number
          group_id?: string | null
          id?: string
          is_system?: boolean
          name?: string
          slug?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tags_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "tag_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_tags: {
        Row: {
          tag_id: string
          transaction_id: string
        }
        Insert: {
          tag_id: string
          transaction_id: string
        }
        Update: {
          tag_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_tags_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          amount_in_base_currency: number | null
          capture_input_text: string | null
          capture_method: Database["public"]["Enums"]["transaction_capture_method"]
          categorization_confidence: number | null
          categorization_source: Database["public"]["Enums"]["categorization_source"]
          category_id: string | null
          clean_description: string | null
          created_at: string
          currency_code: Database["public"]["Enums"]["currency_code"]
          destinatario_id: string | null
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
          original_amount: number | null
          posting_date: string | null
          provider: Database["public"]["Enums"]["data_provider"]
          provider_transaction_id: string | null
          raw_description: string | null
          reconciled_into_transaction_id: string | null
          reconciliation_score: number | null
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
          capture_input_text?: string | null
          capture_method?: Database["public"]["Enums"]["transaction_capture_method"]
          categorization_confidence?: number | null
          categorization_source?: Database["public"]["Enums"]["categorization_source"]
          category_id?: string | null
          clean_description?: string | null
          created_at?: string
          currency_code: Database["public"]["Enums"]["currency_code"]
          destinatario_id?: string | null
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
          original_amount?: number | null
          posting_date?: string | null
          provider?: Database["public"]["Enums"]["data_provider"]
          provider_transaction_id?: string | null
          raw_description?: string | null
          reconciled_into_transaction_id?: string | null
          reconciliation_score?: number | null
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
          capture_input_text?: string | null
          capture_method?: Database["public"]["Enums"]["transaction_capture_method"]
          categorization_confidence?: number | null
          categorization_source?: Database["public"]["Enums"]["categorization_source"]
          category_id?: string | null
          clean_description?: string | null
          created_at?: string
          currency_code?: Database["public"]["Enums"]["currency_code"]
          destinatario_id?: string | null
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
          original_amount?: number | null
          posting_date?: string | null
          provider?: Database["public"]["Enums"]["data_provider"]
          provider_transaction_id?: string | null
          raw_description?: string | null
          reconciled_into_transaction_id?: string | null
          reconciliation_score?: number | null
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
            foreignKeyName: "transactions_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "destinatarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_reconciled_into_transaction_id_fkey"
            columns: ["reconciled_into_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
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
      unrecognized_emails: {
        Row: {
          created_at: string
          email_ingest_id: string | null
          from_address: string
          html_body: string | null
          id: string
          status: string
          subject: string | null
          text_body: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email_ingest_id?: string | null
          from_address: string
          html_body?: string | null
          id?: string
          status?: string
          subject?: string | null
          text_body?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email_ingest_id?: string | null
          from_address?: string
          html_body?: string | null
          id?: string
          status?: string
          subject?: string | null
          text_body?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unrecognized_emails_email_ingest_id_fkey"
            columns: ["email_ingest_id"]
            isOneToOne: false
            referencedRelation: "email_ingest_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unrecognized_emails_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_items: {
        Row: {
          account_id: string | null
          amount: number
          bought_at: string | null
          category_id: string | null
          created_at: string
          currency_code: string
          desire_type: string | null
          enriched: boolean
          enriched_at: string | null
          funding_type: string | null
          id: string
          image_url: string | null
          installments: number | null
          last_nudge_dismissed_at: string | null
          last_score: number | null
          last_scored_at: string | null
          last_verdict: string | null
          name: string
          ready_at: string | null
          status: string
          transaction_id: string | null
          updated_at: string
          urgency: string | null
          url: string | null
          user_id: string
          why: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          bought_at?: string | null
          category_id?: string | null
          created_at?: string
          currency_code?: string
          desire_type?: string | null
          enriched?: boolean
          enriched_at?: string | null
          funding_type?: string | null
          id?: string
          image_url?: string | null
          installments?: number | null
          last_nudge_dismissed_at?: string | null
          last_score?: number | null
          last_scored_at?: string | null
          last_verdict?: string | null
          name: string
          ready_at?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
          urgency?: string | null
          url?: string | null
          user_id: string
          why?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          bought_at?: string | null
          category_id?: string | null
          created_at?: string
          currency_code?: string
          desire_type?: string | null
          enriched?: boolean
          enriched_at?: string | null
          funding_type?: string | null
          id?: string
          image_url?: string | null
          installments?: number | null
          last_nudge_dismissed_at?: string | null
          last_score?: number | null
          last_scored_at?: string | null
          last_verdict?: string | null
          name?: string
          ready_at?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
          urgency?: string | null
          url?: string | null
          user_id?: string
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_reflections: {
        Row: {
          days_since_purchase: number
          id: string
          note: string | null
          rating: number
          reflected_at: string
          reflection_stage: string
          user_id: string
          wishlist_item_id: string
          worth_it: boolean
        }
        Insert: {
          days_since_purchase: number
          id?: string
          note?: string | null
          rating: number
          reflected_at?: string
          reflection_stage: string
          user_id: string
          wishlist_item_id: string
          worth_it: boolean
        }
        Update: {
          days_since_purchase?: number
          id?: string
          note?: string | null
          rating?: number
          reflected_at?: string
          reflection_stage?: string
          user_id?: string
          wishlist_item_id?: string
          worth_it?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_reflections_wishlist_item_id_fkey"
            columns: ["wishlist_item_id"]
            isOneToOne: false
            referencedRelation: "wishlist_items"
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
        | "EMAIL"
      planning_entry_status: "PLANNED" | "COMPLETED" | "SKIPPED"
      planning_entry_type: "INCOME" | "EXPENSE"
      planning_period_preset: "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "CUSTOM"
      recurrence_frequency:
        | "WEEKLY"
        | "BIWEEKLY"
        | "MONTHLY"
        | "QUARTERLY"
        | "ANNUAL"
      transaction_capture_method:
        | "MANUAL_FORM"
        | "TEXT_QUICK_CAPTURE"
        | "PDF_IMPORT"
        | "OCR_BATCH"
        | "OCR_SINGLE"
        | "EMAIL_IMPORT"
        | "EMAIL_PDF_IMPORT"
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
        "EMAIL",
      ],
      planning_entry_status: ["PLANNED", "COMPLETED", "SKIPPED"],
      planning_entry_type: ["INCOME", "EXPENSE"],
      planning_period_preset: ["WEEKLY", "BIWEEKLY", "MONTHLY", "CUSTOM"],
      recurrence_frequency: [
        "WEEKLY",
        "BIWEEKLY",
        "MONTHLY",
        "QUARTERLY",
        "ANNUAL",
      ],
      transaction_capture_method: [
        "MANUAL_FORM",
        "TEXT_QUICK_CAPTURE",
        "PDF_IMPORT",
        "OCR_BATCH",
        "OCR_SINGLE",
        "EMAIL_IMPORT",
        "EMAIL_PDF_IMPORT",
      ],
      transaction_direction: ["INFLOW", "OUTFLOW"],
      transaction_status: ["PENDING", "POSTED", "CANCELLED"],
    },
  },
} as const
