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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_usage_ledger: {
        Row: {
          chapter_key: string | null
          created_at: string
          error_code: string | null
          estimated_credits: number | null
          id: string
          input_tokens: number
          model_id: string
          operation: string
          output_tokens: number
          provider: string
          report_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          chapter_key?: string | null
          created_at?: string
          error_code?: string | null
          estimated_credits?: number | null
          id?: string
          input_tokens?: number
          model_id: string
          operation: string
          output_tokens?: number
          provider?: string
          report_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          chapter_key?: string | null
          created_at?: string
          error_code?: string | null
          estimated_credits?: number | null
          id?: string
          input_tokens?: number
          model_id?: string
          operation?: string
          output_tokens?: number
          provider?: string
          report_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_ledger_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "premium_pdf_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      charts: {
        Row: {
          birth_date: string | null
          birth_place: string | null
          birth_time: string | null
          chart_role: string
          created_at: string
          id: string
          input_snapshot: Json
          is_primary: boolean
          lang: string | null
          name: string | null
          normalized_input_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          birth_date?: string | null
          birth_place?: string | null
          birth_time?: string | null
          chart_role?: string
          created_at?: string
          id?: string
          input_snapshot?: Json
          is_primary?: boolean
          lang?: string | null
          name?: string | null
          normalized_input_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          birth_date?: string | null
          birth_place?: string | null
          birth_time?: string | null
          chart_role?: string
          created_at?: string
          id?: string
          input_snapshot?: Json
          is_primary?: boolean
          lang?: string | null
          name?: string | null
          normalized_input_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      community_comments: {
        Row: {
          author_house_key: string
          author_title: string
          body_text: string
          created_at: string
          deleted_at: string | null
          id: string
          parent_id: string | null
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author_house_key: string
          author_title: string
          body_text: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          parent_id?: string | null
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author_house_key?: string
          author_title?: string
          body_text?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          parent_id?: string | null
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_likes: {
        Row: {
          comment_id: string | null
          created_at: string
          id: string
          post_id: string | null
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          user_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_house_key: string
          author_title: string
          body_text: string
          created_at: string
          deleted_at: string | null
          facet: string
          id: string
          image_paths: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          author_house_key: string
          author_title: string
          body_text: string
          created_at?: string
          deleted_at?: string | null
          facet: string
          id?: string
          image_paths?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          author_house_key?: string
          author_title?: string
          body_text?: string
          created_at?: string
          deleted_at?: string | null
          facet?: string
          id?: string
          image_paths?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_otps: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          phone: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          phone: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
        }
        Relationships: []
      }
      premium_grant_audit: {
        Row: {
          action: string
          admin_user_id: string
          chart_id: string
          created_at: string
          id: string
          note: string | null
          order_id: string
          target_user_id: string
        }
        Insert: {
          action: string
          admin_user_id: string
          chart_id: string
          created_at?: string
          id?: string
          note?: string | null
          order_id: string
          target_user_id: string
        }
        Update: {
          action?: string
          admin_user_id?: string
          chart_id?: string
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "premium_grant_audit_chart_id_fkey"
            columns: ["chart_id"]
            isOneToOne: false
            referencedRelation: "charts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_grant_audit_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "premium_report_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      premium_pdf_reports: {
        Row: {
          ai_generation_count: number
          calculation_version: string | null
          chart_id: string
          content_hash: string | null
          content_json: Json | null
          created_at: string
          error_message: string | null
          generated_at: string | null
          id: string
          input_hash: string | null
          model: string | null
          model_id: string | null
          order_id: string | null
          pdf_storage_path: string | null
          prompt_version: string
          provider: string | null
          report_version: string
          source_report_id: string | null
          status: string
          token_usage: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_generation_count?: number
          calculation_version?: string | null
          chart_id: string
          content_hash?: string | null
          content_json?: Json | null
          created_at?: string
          error_message?: string | null
          generated_at?: string | null
          id?: string
          input_hash?: string | null
          model?: string | null
          model_id?: string | null
          order_id?: string | null
          pdf_storage_path?: string | null
          prompt_version?: string
          provider?: string | null
          report_version?: string
          source_report_id?: string | null
          status?: string
          token_usage?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_generation_count?: number
          calculation_version?: string | null
          chart_id?: string
          content_hash?: string | null
          content_json?: Json | null
          created_at?: string
          error_message?: string | null
          generated_at?: string | null
          id?: string
          input_hash?: string | null
          model?: string | null
          model_id?: string | null
          order_id?: string | null
          pdf_storage_path?: string | null
          prompt_version?: string
          provider?: string | null
          report_version?: string
          source_report_id?: string | null
          status?: string
          token_usage?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "premium_pdf_reports_chart_id_fkey"
            columns: ["chart_id"]
            isOneToOne: false
            referencedRelation: "charts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_pdf_reports_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "premium_report_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_pdf_reports_source_report_id_fkey"
            columns: ["source_report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      premium_report_chapters: {
        Row: {
          attempt_count: number
          chapter_index: number
          chapter_key: string
          claim_token: string | null
          claimed_at: string | null
          completed_at: string | null
          confidence: string | null
          content_hash: string | null
          content_json: Json | null
          created_at: string
          error_message: string | null
          evidence_refs: Json | null
          id: string
          input_tokens: number
          output_tokens: number
          report_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          chapter_index: number
          chapter_key: string
          claim_token?: string | null
          claimed_at?: string | null
          completed_at?: string | null
          confidence?: string | null
          content_hash?: string | null
          content_json?: Json | null
          created_at?: string
          error_message?: string | null
          evidence_refs?: Json | null
          id?: string
          input_tokens?: number
          output_tokens?: number
          report_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          chapter_index?: number
          chapter_key?: string
          claim_token?: string | null
          claimed_at?: string | null
          completed_at?: string | null
          confidence?: string | null
          content_hash?: string | null
          content_json?: Json | null
          created_at?: string
          error_message?: string | null
          evidence_refs?: Json | null
          id?: string
          input_tokens?: number
          output_tokens?: number
          report_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "premium_report_chapters_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "premium_pdf_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      premium_report_orders: {
        Row: {
          amount_cents: number
          chart_id: string
          created_at: string
          currency: string
          grant_note: string | null
          granted_by: string | null
          id: string
          paid_at: string | null
          product_version: string
          provider: string | null
          provider_order_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          chart_id: string
          created_at?: string
          currency?: string
          grant_note?: string | null
          granted_by?: string | null
          id?: string
          paid_at?: string | null
          product_version?: string
          provider?: string | null
          provider_order_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          chart_id?: string
          created_at?: string
          currency?: string
          grant_note?: string | null
          granted_by?: string | null
          id?: string
          paid_at?: string | null
          product_version?: string
          provider?: string | null
          provider_order_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "premium_report_orders_chart_id_fkey"
            columns: ["chart_id"]
            isOneToOne: false
            referencedRelation: "charts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          membership_expires_at: string | null
          membership_tier: Database["public"]["Enums"]["membership_tier"]
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          membership_expires_at?: string | null
          membership_tier?: Database["public"]["Enums"]["membership_tier"]
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          membership_expires_at?: string | null
          membership_tier?: Database["public"]["Enums"]["membership_tier"]
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          chart_id: string
          created_at: string
          error_message: string | null
          generated_at: string | null
          id: string
          input_snapshot: Json
          kind: string
          model: string | null
          provider: string | null
          report_json: Json | null
          report_version: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chart_id: string
          created_at?: string
          error_message?: string | null
          generated_at?: string | null
          id?: string
          input_snapshot?: Json
          kind: string
          model?: string | null
          provider?: string | null
          report_json?: Json | null
          report_version: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chart_id?: string
          created_at?: string
          error_message?: string | null
          generated_at?: string | null
          id?: string
          input_snapshot?: Json
          kind?: string
          model?: string | null
          provider?: string | null
          report_json?: Json | null
          report_version?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_chart_id_fkey"
            columns: ["chart_id"]
            isOneToOne: false
            referencedRelation: "charts"
            referencedColumns: ["id"]
          },
        ]
      }
      tarot_usage: {
        Row: {
          count: number
          month: string
          updated_at: string
          user_id: string
        }
        Insert: {
          count?: number
          month: string
          updated_at?: string
          user_id: string
        }
        Update: {
          count?: number
          month?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_activity: {
        Row: {
          activity_date: string
          created_at: string
          id: string
          path: string | null
          user_id: string
        }
        Insert: {
          activity_date?: string
          created_at?: string
          id?: string
          path?: string | null
          user_id: string
        }
        Update: {
          activity_date?: string
          created_at?: string
          id?: string
          path?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          category: Database["public"]["Enums"]["feedback_category"]
          created_at: string
          id: string
          keywords: string[]
          lang: string | null
          message: string
          resolved: boolean
          user_id: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["feedback_category"]
          created_at?: string
          id?: string
          keywords?: string[]
          lang?: string | null
          message: string
          resolved?: boolean
          user_id?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["feedback_category"]
          created_at?: string
          id?: string
          keywords?: string[]
          lang?: string | null
          message?: string
          resolved?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      year_readings_v1: {
        Row: {
          advice: Json
          age: number
          calculation_version: string
          chart_id: string
          composite_confidence: string | null
          composite_direction: string | null
          composite_score: number | null
          content_hash: string
          evidence_refs: Json
          facts_hash: string
          generated_at: string
          id: string
          interpretation: Json
          lang: string
          owner_id: string
          skill_version: string
          system_scores: Json
          unavailable_systems: Json
          year: number
        }
        Insert: {
          advice: Json
          age: number
          calculation_version: string
          chart_id: string
          composite_confidence?: string | null
          composite_direction?: string | null
          composite_score?: number | null
          content_hash: string
          evidence_refs?: Json
          facts_hash: string
          generated_at?: string
          id?: string
          interpretation: Json
          lang?: string
          owner_id: string
          skill_version: string
          system_scores: Json
          unavailable_systems?: Json
          year: number
        }
        Update: {
          advice?: Json
          age?: number
          calculation_version?: string
          chart_id?: string
          composite_confidence?: string | null
          composite_direction?: string | null
          composite_score?: number | null
          content_hash?: string
          evidence_refs?: Json
          facts_hash?: string
          generated_at?: string
          id?: string
          interpretation?: Json
          lang?: string
          owner_id?: string
          skill_version?: string
          system_scores?: Json
          unavailable_systems?: Json
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "year_readings_v1_chart_id_fkey"
            columns: ["chart_id"]
            isOneToOne: false
            referencedRelation: "charts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_ai_usage_summary: {
        Args: { _since?: string }
        Returns: {
          call_count: number
          last_call: string
          report_id: string
          total_credits: number
          total_input_tokens: number
          total_output_tokens: number
          user_id: string
        }[]
      }
      claim_premium_chapter: {
        Args: {
          _chapter_index: number
          _chapter_key: string
          _lock_ttl_seconds?: number
          _new_token: string
          _report_id: string
        }
        Returns: boolean
      }
      claim_premium_chapter_for_user: {
        Args: {
          _chapter_index: number
          _chapter_key: string
          _lock_ttl_seconds?: number
          _new_token: string
          _report_id: string
          _user_id: string
        }
        Returns: boolean
      }
      community_email_verified: { Args: never; Returns: boolean }
      set_chart_role: {
        Args: { _chart_id: string; _role: string }
        Returns: boolean
      }
      set_primary_chart: { Args: { _chart_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      feedback_category: "device" | "order" | "other"
      membership_tier: "none" | "sage" | "oracle"
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
      app_role: ["admin", "user"],
      feedback_category: ["device", "order", "other"],
      membership_tier: ["none", "sage", "oracle"],
    },
  },
} as const
