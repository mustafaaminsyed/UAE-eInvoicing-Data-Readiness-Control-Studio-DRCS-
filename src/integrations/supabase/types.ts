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
      case_notes: {
        Row: {
          case_id: string
          created_at: string
          created_by: string | null
          id: string
          note: string
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note: string
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          buyer_id: string | null
          case_number: string
          check_name: string | null
          created_at: string
          exception_id: string | null
          id: string
          invoice_id: string
          invoice_number: string | null
          is_sla_breached: boolean | null
          owner_team: string
          resolution_notes: string | null
          resolved_at: string | null
          seller_trn: string | null
          severity: string
          sla_hours: number
          sla_target_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          buyer_id?: string | null
          case_number: string
          check_name?: string | null
          created_at?: string
          exception_id?: string | null
          id?: string
          invoice_id: string
          invoice_number?: string | null
          is_sla_breached?: boolean | null
          owner_team: string
          resolution_notes?: string | null
          resolved_at?: string | null
          seller_trn?: string | null
          severity: string
          sla_hours?: number
          sla_target_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string | null
          case_number?: string
          check_name?: string | null
          created_at?: string
          exception_id?: string | null
          id?: string
          invoice_id?: string
          invoice_number?: string | null
          is_sla_breached?: boolean | null
          owner_team?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          seller_trn?: string | null
          severity?: string
          sla_hours?: number
          sla_target_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      check_exceptions: {
        Row: {
          buyer_id: string | null
          case_id: string | null
          case_status: string | null
          check_id: string
          check_name: string
          created_at: string
          dataset_type: string | null
          expected_value_or_rule: string | null
          field_name: string | null
          id: string
          invoice_id: string | null
          invoice_number: string | null
          line_id: string | null
          message: string
          observed_value: string | null
          owner_team: string | null
          pint_reference_terms: string[] | null
          root_cause_category: string | null
          rule_type: string | null
          run_id: string | null
          scope: string | null
          seller_trn: string | null
          severity: string
          sla_target_hours: number | null
          suggested_fix: string | null
          timestamp: string
          use_case: string | null
        }
        Insert: {
          buyer_id?: string | null
          case_id?: string | null
          case_status?: string | null
          check_id: string
          check_name: string
          created_at?: string
          dataset_type?: string | null
          expected_value_or_rule?: string | null
          field_name?: string | null
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          line_id?: string | null
          message: string
          observed_value?: string | null
          owner_team?: string | null
          pint_reference_terms?: string[] | null
          root_cause_category?: string | null
          rule_type?: string | null
          run_id?: string | null
          scope?: string | null
          seller_trn?: string | null
          severity: string
          sla_target_hours?: number | null
          suggested_fix?: string | null
          timestamp?: string
          use_case?: string | null
        }
        Update: {
          buyer_id?: string | null
          case_id?: string | null
          case_status?: string | null
          check_id?: string
          check_name?: string
          created_at?: string
          dataset_type?: string | null
          expected_value_or_rule?: string | null
          field_name?: string | null
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          line_id?: string | null
          message?: string
          observed_value?: string | null
          owner_team?: string | null
          pint_reference_terms?: string[] | null
          root_cause_category?: string | null
          rule_type?: string | null
          run_id?: string | null
          scope?: string | null
          seller_trn?: string | null
          severity?: string
          sla_target_hours?: number | null
          suggested_fix?: string | null
          timestamp?: string
          use_case?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "check_exceptions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_exceptions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "check_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      check_runs: {
        Row: {
          critical_count: number
          dataset_type: string | null
          high_count: number
          id: string
          low_count: number
          medium_count: number
          pass_rate: number
          results_summary: Json | null
          run_date: string
          total_exceptions: number
          total_invoices: number
        }
        Insert: {
          critical_count?: number
          dataset_type?: string | null
          high_count?: number
          id?: string
          low_count?: number
          medium_count?: number
          pass_rate?: number
          results_summary?: Json | null
          run_date?: string
          total_exceptions?: number
          total_invoices?: number
        }
        Update: {
          critical_count?: number
          dataset_type?: string | null
          high_count?: number
          id?: string
          low_count?: number
          medium_count?: number
          pass_rate?: number
          results_summary?: Json | null
          run_date?: string
          total_exceptions?: number
          total_invoices?: number
        }
        Relationships: []
      }
      client_health: {
        Row: {
          calculated_at: string
          client_name: string | null
          critical_issues: number | null
          id: string
          rejection_rate: number | null
          score: number
          seller_trn: string
          sla_breaches: number | null
          total_invoices: number | null
          total_rejections: number | null
        }
        Insert: {
          calculated_at?: string
          client_name?: string | null
          critical_issues?: number | null
          id?: string
          rejection_rate?: number | null
          score?: number
          seller_trn: string
          sla_breaches?: number | null
          total_invoices?: number | null
          total_rejections?: number | null
        }
        Update: {
          calculated_at?: string
          client_name?: string | null
          critical_issues?: number | null
          id?: string
          rejection_rate?: number | null
          score?: number
          seller_trn?: string
          sla_breaches?: number | null
          total_invoices?: number | null
          total_rejections?: number | null
        }
        Relationships: []
      }
      client_risk_scores: {
        Row: {
          client_name: string | null
          created_at: string
          critical_count: number
          health_score: number
          high_count: number
          id: string
          low_count: number
          medium_count: number
          risk_score: number
          run_id: string
          seller_trn: string
          total_exceptions: number
          total_invoices: number
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          critical_count?: number
          health_score?: number
          high_count?: number
          id?: string
          low_count?: number
          medium_count?: number
          risk_score?: number
          run_id: string
          seller_trn: string
          total_exceptions?: number
          total_invoices?: number
        }
        Update: {
          client_name?: string | null
          created_at?: string
          critical_count?: number
          health_score?: number
          high_count?: number
          id?: string
          low_count?: number
          medium_count?: number
          risk_score?: number
          run_id?: string
          seller_trn?: string
          total_exceptions?: number
          total_invoices?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_risk_scores_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "check_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_checks: {
        Row: {
          check_type: string | null
          created_at: string
          dataset_scope: string
          description: string | null
          id: string
          is_active: boolean
          message_template: string
          name: string
          parameters: Json
          rule_type: string
          severity: string
          updated_at: string
        }
        Insert: {
          check_type?: string | null
          created_at?: string
          dataset_scope: string
          description?: string | null
          id?: string
          is_active?: boolean
          message_template: string
          name: string
          parameters?: Json
          rule_type: string
          severity: string
          updated_at?: string
        }
        Update: {
          check_type?: string | null
          created_at?: string
          dataset_scope?: string
          description?: string | null
          id?: string
          is_active?: boolean
          message_template?: string
          name?: string
          parameters?: Json
          rule_type?: string
          severity?: string
          updated_at?: string
        }
        Relationships: []
      }
      entity_scores: {
        Row: {
          created_at: string
          critical_count: number
          entity_id: string
          entity_name: string | null
          entity_type: string
          high_count: number
          id: string
          low_count: number
          medium_count: number
          run_id: string
          score: number
          total_exceptions: number
        }
        Insert: {
          created_at?: string
          critical_count?: number
          entity_id: string
          entity_name?: string | null
          entity_type: string
          high_count?: number
          id?: string
          low_count?: number
          medium_count?: number
          run_id: string
          score?: number
          total_exceptions?: number
        }
        Update: {
          created_at?: string
          critical_count?: number
          entity_id?: string
          entity_name?: string | null
          entity_type?: string
          high_count?: number
          id?: string
          low_count?: number
          medium_count?: number
          run_id?: string
          score?: number
          total_exceptions?: number
        }
        Relationships: [
          {
            foreignKeyName: "entity_scores_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "check_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lifecycle: {
        Row: {
          buyer_id: string | null
          changed_by: string | null
          created_at: string
          id: string
          invoice_id: string
          invoice_number: string | null
          notes: string | null
          previous_status: string | null
          seller_trn: string
          status: string
        }
        Insert: {
          buyer_id?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          invoice_id: string
          invoice_number?: string | null
          notes?: string | null
          previous_status?: string | null
          seller_trn: string
          status: string
        }
        Update: {
          buyer_id?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          invoice_id?: string
          invoice_number?: string | null
          notes?: string | null
          previous_status?: string | null
          seller_trn?: string
          status?: string
        }
        Relationships: []
      }
      investigation_flags: {
        Row: {
          check_id: string
          check_name: string
          confidence_score: number | null
          counterparty_name: string | null
          created_at: string
          dataset_type: string
          id: string
          invoice_id: string | null
          invoice_number: string | null
          matched_invoice_id: string | null
          matched_invoice_number: string | null
          message: string
          run_id: string | null
        }
        Insert: {
          check_id: string
          check_name: string
          confidence_score?: number | null
          counterparty_name?: string | null
          created_at?: string
          dataset_type: string
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          matched_invoice_id?: string | null
          matched_invoice_number?: string | null
          message: string
          run_id?: string | null
        }
        Update: {
          check_id?: string
          check_name?: string
          confidence_score?: number | null
          counterparty_name?: string | null
          created_at?: string
          dataset_type?: string
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          matched_invoice_id?: string | null
          matched_invoice_number?: string | null
          message?: string
          run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investigation_flags_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "check_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      mapping_templates: {
        Row: {
          client_name: string | null
          created_at: string
          description: string | null
          document_type: string | null
          erp_type: string | null
          id: string
          is_active: boolean
          legal_entity: string | null
          mappings: Json
          seller_trn: string | null
          template_name: string
          tenant_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          description?: string | null
          document_type?: string | null
          erp_type?: string | null
          id?: string
          is_active?: boolean
          legal_entity?: string | null
          mappings?: Json
          seller_trn?: string | null
          template_name: string
          tenant_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          client_name?: string | null
          created_at?: string
          description?: string | null
          document_type?: string | null
          erp_type?: string | null
          id?: string
          is_active?: boolean
          legal_entity?: string | null
          mappings?: Json
          seller_trn?: string | null
          template_name?: string
          tenant_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      pint_ae_checks: {
        Row: {
          check_id: string
          check_name: string
          created_at: string
          description: string | null
          evidence_required: string | null
          fail_condition: string | null
          id: string
          is_enabled: boolean | null
          mof_rule_reference: string | null
          owner_team_default: string | null
          parameters: Json | null
          pass_condition: string | null
          pint_reference_terms: string[] | null
          rule_type: string
          scope: string
          severity: string
          suggested_fix: string | null
          updated_at: string
          use_case: string | null
        }
        Insert: {
          check_id: string
          check_name: string
          created_at?: string
          description?: string | null
          evidence_required?: string | null
          fail_condition?: string | null
          id?: string
          is_enabled?: boolean | null
          mof_rule_reference?: string | null
          owner_team_default?: string | null
          parameters?: Json | null
          pass_condition?: string | null
          pint_reference_terms?: string[] | null
          rule_type: string
          scope: string
          severity: string
          suggested_fix?: string | null
          updated_at?: string
          use_case?: string | null
        }
        Update: {
          check_id?: string
          check_name?: string
          created_at?: string
          description?: string | null
          evidence_required?: string | null
          fail_condition?: string | null
          id?: string
          is_enabled?: boolean | null
          mof_rule_reference?: string | null
          owner_team_default?: string | null
          parameters?: Json | null
          pass_condition?: string | null
          pint_reference_terms?: string[] | null
          rule_type?: string
          scope?: string
          severity?: string
          suggested_fix?: string | null
          updated_at?: string
          use_case?: string | null
        }
        Relationships: []
      }
      rejections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          invoice_id: string
          invoice_number: string | null
          is_repeat: boolean | null
          original_rejection_id: string | null
          rejection_category: string
          rejection_code: string
          resolved_at: string | null
          root_cause_owner: string | null
          seller_trn: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          invoice_id: string
          invoice_number?: string | null
          is_repeat?: boolean | null
          original_rejection_id?: string | null
          rejection_category: string
          rejection_code: string
          resolved_at?: string | null
          root_cause_owner?: string | null
          seller_trn: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          invoice_id?: string
          invoice_number?: string | null
          is_repeat?: boolean | null
          original_rejection_id?: string | null
          rejection_category?: string
          rejection_code?: string
          resolved_at?: string | null
          root_cause_owner?: string | null
          seller_trn?: string
        }
        Relationships: [
          {
            foreignKeyName: "rejections_original_rejection_id_fkey"
            columns: ["original_rejection_id"]
            isOneToOne: false
            referencedRelation: "rejections"
            referencedColumns: ["id"]
          },
        ]
      }
      run_summaries: {
        Row: {
          created_at: string
          exceptions_by_severity: Json | null
          id: string
          pass_rate_percent: number
          run_id: string
          top_10_clients_by_risk: Json | null
          top_10_failing_checks: Json | null
          total_exceptions: number
          total_invoices_tested: number
        }
        Insert: {
          created_at?: string
          exceptions_by_severity?: Json | null
          id?: string
          pass_rate_percent?: number
          run_id: string
          top_10_clients_by_risk?: Json | null
          top_10_failing_checks?: Json | null
          total_exceptions?: number
          total_invoices_tested?: number
        }
        Update: {
          created_at?: string
          exceptions_by_severity?: Json | null
          id?: string
          pass_rate_percent?: number
          run_id?: string
          top_10_clients_by_risk?: Json | null
          top_10_failing_checks?: Json | null
          total_exceptions?: number
          total_invoices_tested?: number
        }
        Relationships: [
          {
            foreignKeyName: "run_summaries_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "check_runs"
            referencedColumns: ["id"]
          },
        ]
      },
      validation_explanations: {
        Row: {
          check_exception_id: string | null
          check_id: string | null
          check_name: string | null
          confidence: number
          created_at: string
          dataset_type: string | null
          direction: string | null
          error_message: string | null
          exception_key: string
          explanation: string
          generated_at: string
          id: string
          invoice_id: string | null
          model: string | null
          prompt_version: string
          recommended_fix: string
          risk: string
          rule_code: string | null
          source_context: Json | null
          status: string
          tenant_id: string
          updated_at: string
          validation_run_id: string | null
        }
        Insert: {
          check_exception_id?: string | null
          check_id?: string | null
          check_name?: string | null
          confidence: number
          created_at?: string
          dataset_type?: string | null
          direction?: string | null
          error_message?: string | null
          exception_key: string
          explanation: string
          generated_at?: string
          id?: string
          invoice_id?: string | null
          model?: string | null
          prompt_version?: string
          recommended_fix: string
          risk: string
          rule_code?: string | null
          source_context?: Json | null
          status?: string
          tenant_id?: string
          updated_at?: string
          validation_run_id?: string | null
        }
        Update: {
          check_exception_id?: string | null
          check_id?: string | null
          check_name?: string | null
          confidence?: number
          created_at?: string
          dataset_type?: string | null
          direction?: string | null
          error_message?: string | null
          exception_key?: string
          explanation?: string
          generated_at?: string
          id?: string
          invoice_id?: string | null
          model?: string | null
          prompt_version?: string
          recommended_fix?: string
          risk?: string
          rule_code?: string | null
          source_context?: Json | null
          status?: string
          tenant_id?: string
          updated_at?: string
          validation_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "validation_explanations_check_exception_id_fkey"
            columns: ["check_exception_id"]
            isOneToOne: false
            referencedRelation: "check_exceptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validation_explanations_validation_run_id_fkey"
            columns: ["validation_run_id"]
            isOneToOne: false
            referencedRelation: "check_runs"
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
