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
      admin_audit_logs: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
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
          consent_confirmed_at: string | null
          created_at: string
          id: string
          input_snapshot: Json
          is_primary: boolean
          lang: string | null
          name: string | null
          normalized_input_hash: string
          relationship_label: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          birth_date?: string | null
          birth_place?: string | null
          birth_time?: string | null
          chart_role?: string
          consent_confirmed_at?: string | null
          created_at?: string
          id?: string
          input_snapshot?: Json
          is_primary?: boolean
          lang?: string | null
          name?: string | null
          normalized_input_hash: string
          relationship_label?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          birth_date?: string | null
          birth_place?: string | null
          birth_time?: string | null
          chart_role?: string
          consent_confirmed_at?: string | null
          created_at?: string
          id?: string
          input_snapshot?: Json
          is_primary?: boolean
          lang?: string | null
          name?: string | null
          normalized_input_hash?: string
          relationship_label?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      community_blocks: {
        Row: {
          blocked_user_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_user_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_user_id?: string
          blocker_id?: string
          created_at?: string
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
      community_delivery_config: {
        Row: {
          daily_letter_limit: number
          first_wave: number
          id: number
          letter_ttl_days: number
          max_recipients: number
          max_replies: number
          recipient_daily_cap: number
          second_wave: number
          updated_at: string
          waiting_hint_hours: number
          wave_interval_hours: number
        }
        Insert: {
          daily_letter_limit?: number
          first_wave?: number
          id?: number
          letter_ttl_days?: number
          max_recipients?: number
          max_replies?: number
          recipient_daily_cap?: number
          second_wave?: number
          updated_at?: string
          waiting_hint_hours?: number
          wave_interval_hours?: number
        }
        Update: {
          daily_letter_limit?: number
          first_wave?: number
          id?: number
          letter_ttl_days?: number
          max_recipients?: number
          max_replies?: number
          recipient_daily_cap?: number
          second_wave?: number
          updated_at?: string
          waiting_hint_hours?: number
          wave_interval_hours?: number
        }
        Relationships: []
      }
      community_letter_deliveries: {
        Row: {
          delivered_at: string
          id: string
          letter_id: string
          read_at: string | null
          recipient_id: string
          replied_at: string | null
          status: string
        }
        Insert: {
          delivered_at?: string
          id?: string
          letter_id: string
          read_at?: string | null
          recipient_id: string
          replied_at?: string | null
          status?: string
        }
        Update: {
          delivered_at?: string
          id?: string
          letter_id?: string
          read_at?: string | null
          recipient_id?: string
          replied_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_letter_deliveries_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "community_letters"
            referencedColumns: ["id"]
          },
        ]
      }
      community_letter_replies: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          letter_id: string
          saved_by_author_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          letter_id: string
          saved_by_author_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          letter_id?: string
          saved_by_author_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_letter_replies_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "community_letters"
            referencedColumns: ["id"]
          },
        ]
      }
      community_letters: {
        Row: {
          author_id: string | null
          body: string
          content_origin: string
          created_at: string
          dispatch_wave: number
          expires_at: string
          id: string
          language: string
          last_dispatch_at: string | null
          published_at: string | null
          response_style: string | null
          risk_level: string
          status: string
          subject: string | null
          target_age_band: string
          topic: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          author_id?: string | null
          body: string
          content_origin?: string
          created_at?: string
          dispatch_wave?: number
          expires_at?: string
          id?: string
          language?: string
          last_dispatch_at?: string | null
          published_at?: string | null
          response_style?: string | null
          risk_level?: string
          status?: string
          subject?: string | null
          target_age_band: string
          topic?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          content_origin?: string
          created_at?: string
          dispatch_wave?: number
          expires_at?: string
          id?: string
          language?: string
          last_dispatch_at?: string | null
          published_at?: string | null
          response_style?: string | null
          risk_level?: string
          status?: string
          subject?: string | null
          target_age_band?: string
          topic?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: []
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
      community_match_grants: {
        Row: {
          a_granted_at: string | null
          a_revoked_at: string | null
          a_user_id: string
          b_granted_at: string | null
          b_revoked_at: string | null
          b_user_id: string
          created_at: string
          mode: string
          pair_key: string
          updated_at: string
        }
        Insert: {
          a_granted_at?: string | null
          a_revoked_at?: string | null
          a_user_id: string
          b_granted_at?: string | null
          b_revoked_at?: string | null
          b_user_id: string
          created_at?: string
          mode?: string
          pair_key: string
          updated_at?: string
        }
        Update: {
          a_granted_at?: string | null
          a_revoked_at?: string | null
          a_user_id?: string
          b_granted_at?: string | null
          b_revoked_at?: string | null
          b_user_id?: string
          created_at?: string
          mode?: string
          pair_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_match_invites: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          mode: string
          recipient_id: string
          responded_at: string | null
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          mode?: string
          recipient_id: string
          responded_at?: string | null
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          mode?: string
          recipient_id?: string
          responded_at?: string | null
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_match_profiles: {
        Row: {
          age_band: string | null
          anonymous_alias: string
          consent_version: string
          consented_at: string
          created_at: string
          is_active: boolean
          last_recommended_at: string | null
          paused_at: string | null
          primary_chart_id: string | null
          recommend_count_today: number
          recommend_day_key: string
          show_age_band: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          age_band?: string | null
          anonymous_alias: string
          consent_version: string
          consented_at?: string
          created_at?: string
          is_active?: boolean
          last_recommended_at?: string | null
          paused_at?: string | null
          primary_chart_id?: string | null
          recommend_count_today?: number
          recommend_day_key?: string
          show_age_band?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          age_band?: string | null
          anonymous_alias?: string
          consent_version?: string
          consented_at?: string
          created_at?: string
          is_active?: boolean
          last_recommended_at?: string | null
          paused_at?: string | null
          primary_chart_id?: string | null
          recommend_count_today?: number
          recommend_day_key?: string
          show_age_band?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_match_profiles_primary_chart_id_fkey"
            columns: ["primary_chart_id"]
            isOneToOne: false
            referencedRelation: "charts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_match_results: {
        Row: {
          a_user_id: string
          b_user_id: string
          calculator_version: string
          created_at: string
          evidence_summary: Json
          facets_snapshot: Json
          mode: string
          pair_key: string
          score_snapshot: Json
          status: string
        }
        Insert: {
          a_user_id: string
          b_user_id: string
          calculator_version: string
          created_at?: string
          evidence_summary: Json
          facets_snapshot: Json
          mode?: string
          pair_key: string
          score_snapshot: Json
          status?: string
        }
        Update: {
          a_user_id?: string
          b_user_id?: string
          calculator_version?: string
          created_at?: string
          evidence_summary?: Json
          facets_snapshot?: Json
          mode?: string
          pair_key?: string
          score_snapshot?: Json
          status?: string
        }
        Relationships: []
      }
      community_moderation_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          notes: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      community_notifications: {
        Row: {
          created_at: string
          entity_id: string | null
          id: string
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          id?: string
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          id?: string
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
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
      community_profiles: {
        Row: {
          academy: string | null
          age_band: string | null
          alias: string | null
          avatar_url: string | null
          created_at: string
          element: string | null
          language: string
          onboarded_at: string | null
          opt_in: boolean
          quote: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          academy?: string | null
          age_band?: string | null
          alias?: string | null
          avatar_url?: string | null
          created_at?: string
          element?: string | null
          language?: string
          onboarded_at?: string | null
          opt_in?: boolean
          quote?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          academy?: string | null
          age_band?: string | null
          alias?: string | null
          avatar_url?: string | null
          created_at?: string
          element?: string | null
          language?: string
          onboarded_at?: string | null
          opt_in?: boolean
          quote?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      community_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          priority: string
          reason: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          priority?: string
          reason: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          priority?: string
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      community_sample_echoes: {
        Row: {
          body: string
          created_at: string
          echo_age_band: string
          id: string
          letter_id: string
          position: number
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          echo_age_band: string
          id?: string
          letter_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          echo_age_band?: string
          id?: string
          letter_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_sample_echoes_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "community_letters"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
          reason: string | null
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      friend_invites: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          inviter_id: string
          message: string | null
          responded_at: string | null
          status: string
          target_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          inviter_id: string
          message?: string | null
          responded_at?: string | null
          status?: string
          target_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          inviter_id?: string
          message?: string | null
          responded_at?: string | null
          status?: string
          target_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      friend_reports: {
        Row: {
          category: string
          created_at: string
          detail: string | null
          id: string
          reported_id: string
          reporter_id: string
          status: string
        }
        Insert: {
          category: string
          created_at?: string
          detail?: string | null
          id?: string
          reported_id: string
          reporter_id: string
          status?: string
        }
        Update: {
          category?: string
          created_at?: string
          detail?: string | null
          id?: string
          reported_id?: string
          reporter_id?: string
          status?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          a_user_id: string
          b_user_id: string
          created_at: string
          id: string
          invite_id: string | null
          removed_at: string | null
        }
        Insert: {
          a_user_id: string
          b_user_id: string
          created_at?: string
          id?: string
          invite_id?: string | null
          removed_at?: string | null
        }
        Update: {
          a_user_id?: string
          b_user_id?: string
          created_at?: string
          id?: string
          invite_id?: string | null
          removed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "friendships_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "friend_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      historical_figures: {
        Row: {
          created_at: string
          era_en: string
          era_zh: string
          id: string
          name_en: string
          name_zh: string
          person_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          era_en: string
          era_zh: string
          id?: string
          name_en: string
          name_zh: string
          person_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          era_en?: string
          era_zh?: string
          id?: string
          name_en?: string
          name_zh?: string
          person_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      historical_life_events: {
        Row: {
          borrow_en: string
          borrow_zh: string
          choice_en: string
          choice_zh: string
          content_version: string
          created_at: string
          curated_rank: number
          domains: string[]
          dont_copy_en: string
          dont_copy_zh: string
          event_key: string
          id: string
          is_active: boolean
          person_key: string
          signal: string
          situation_en: string
          situation_zh: string
          stage: string
          tags: string[]
          tension_en: string
          tension_zh: string
          updated_at: string
        }
        Insert: {
          borrow_en: string
          borrow_zh: string
          choice_en: string
          choice_zh: string
          content_version?: string
          created_at?: string
          curated_rank?: number
          domains?: string[]
          dont_copy_en: string
          dont_copy_zh: string
          event_key: string
          id?: string
          is_active?: boolean
          person_key: string
          signal?: string
          situation_en: string
          situation_zh: string
          stage: string
          tags?: string[]
          tension_en: string
          tension_zh: string
          updated_at?: string
        }
        Update: {
          borrow_en?: string
          borrow_zh?: string
          choice_en?: string
          choice_zh?: string
          content_version?: string
          created_at?: string
          curated_rank?: number
          domains?: string[]
          dont_copy_en?: string
          dont_copy_zh?: string
          event_key?: string
          id?: string
          is_active?: boolean
          person_key?: string
          signal?: string
          situation_en?: string
          situation_zh?: string
          stage?: string
          tags?: string[]
          tension_en?: string
          tension_zh?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "historical_life_events_person_key_fkey"
            columns: ["person_key"]
            isOneToOne: false
            referencedRelation: "historical_figures"
            referencedColumns: ["person_key"]
          },
        ]
      }
      historical_reflections: {
        Row: {
          body_en: string
          body_zh: string
          created_at: string
          event_key: string
          id: string
          tone: string
        }
        Insert: {
          body_en: string
          body_zh: string
          created_at?: string
          event_key: string
          id?: string
          tone?: string
        }
        Update: {
          body_en?: string
          body_zh?: string
          created_at?: string
          event_key?: string
          id?: string
          tone?: string
        }
        Relationships: [
          {
            foreignKeyName: "historical_reflections_event_key_fkey"
            columns: ["event_key"]
            isOneToOne: false
            referencedRelation: "historical_life_events"
            referencedColumns: ["event_key"]
          },
        ]
      }
      historical_sources: {
        Row: {
          created_at: string
          event_key: string | null
          id: string
          is_primary: boolean
          kind: string
          license: string | null
          notes: string | null
          person_key: string
          title: string
          url: string | null
        }
        Insert: {
          created_at?: string
          event_key?: string | null
          id?: string
          is_primary?: boolean
          kind?: string
          license?: string | null
          notes?: string | null
          person_key: string
          title: string
          url?: string | null
        }
        Update: {
          created_at?: string
          event_key?: string | null
          id?: string
          is_primary?: boolean
          kind?: string
          license?: string | null
          notes?: string | null
          person_key?: string
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historical_sources_event_key_fkey"
            columns: ["event_key"]
            isOneToOne: false
            referencedRelation: "historical_life_events"
            referencedColumns: ["event_key"]
          },
          {
            foreignKeyName: "historical_sources_person_key_fkey"
            columns: ["person_key"]
            isOneToOne: false
            referencedRelation: "historical_figures"
            referencedColumns: ["person_key"]
          },
        ]
      }
      life_bookmarks: {
        Row: {
          created_at: string
          domain: string | null
          figure_key: string
          id: string
          stage: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          domain?: string | null
          figure_key: string
          id?: string
          stage?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          domain?: string | null
          figure_key?: string
          id?: string
          stage?: string | null
          user_id?: string
        }
        Relationships: []
      }
      life_responses: {
        Row: {
          body: string
          created_at: string
          domain: string | null
          figure_key: string
          id: string
          stage: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          domain?: string | null
          figure_key: string
          id?: string
          stage?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          domain?: string | null
          figure_key?: string
          id?: string
          stage?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      literature_passages: {
        Row: {
          action_prompt_en: string | null
          action_prompt_zh: string | null
          active: boolean
          citation_label: string | null
          concern_tags: string[]
          context_en: string | null
          context_zh: string | null
          created_at: string
          default_interpretation_en: string | null
          default_interpretation_zh: string | null
          display_text_en: string | null
          display_text_zh: string | null
          id: string
          life_stage_tags: string[]
          original_text: string
          question_en: string | null
          question_zh: string | null
          reading_path: string | null
          rights_status: string
          slug: string
          text_type: string
          tone_tags: string[]
          translator: string | null
          updated_at: string
          weight: number
          work_id: string
        }
        Insert: {
          action_prompt_en?: string | null
          action_prompt_zh?: string | null
          active?: boolean
          citation_label?: string | null
          concern_tags?: string[]
          context_en?: string | null
          context_zh?: string | null
          created_at?: string
          default_interpretation_en?: string | null
          default_interpretation_zh?: string | null
          display_text_en?: string | null
          display_text_zh?: string | null
          id?: string
          life_stage_tags?: string[]
          original_text: string
          question_en?: string | null
          question_zh?: string | null
          reading_path?: string | null
          rights_status?: string
          slug: string
          text_type?: string
          tone_tags?: string[]
          translator?: string | null
          updated_at?: string
          weight?: number
          work_id: string
        }
        Update: {
          action_prompt_en?: string | null
          action_prompt_zh?: string | null
          active?: boolean
          citation_label?: string | null
          concern_tags?: string[]
          context_en?: string | null
          context_zh?: string | null
          created_at?: string
          default_interpretation_en?: string | null
          default_interpretation_zh?: string | null
          display_text_en?: string | null
          display_text_zh?: string | null
          id?: string
          life_stage_tags?: string[]
          original_text?: string
          question_en?: string | null
          question_zh?: string | null
          reading_path?: string | null
          rights_status?: string
          slug?: string
          text_type?: string
          tone_tags?: string[]
          translator?: string | null
          updated_at?: string
          weight?: number
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "literature_passages_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "literature_works"
            referencedColumns: ["id"]
          },
        ]
      }
      literature_works: {
        Row: {
          author_original: string | null
          author_zh: string | null
          country_or_region: string | null
          created_at: string
          era: string | null
          id: string
          is_public_domain: boolean
          language: string
          literary_form: string | null
          publication_year: string | null
          rights_note: string | null
          slug: string
          source_name: string | null
          source_url: string | null
          title_original: string | null
          title_zh: string | null
          updated_at: string
          verification_status: string
        }
        Insert: {
          author_original?: string | null
          author_zh?: string | null
          country_or_region?: string | null
          created_at?: string
          era?: string | null
          id?: string
          is_public_domain?: boolean
          language: string
          literary_form?: string | null
          publication_year?: string | null
          rights_note?: string | null
          slug: string
          source_name?: string | null
          source_url?: string | null
          title_original?: string | null
          title_zh?: string | null
          updated_at?: string
          verification_status?: string
        }
        Update: {
          author_original?: string | null
          author_zh?: string | null
          country_or_region?: string | null
          created_at?: string
          era?: string | null
          id?: string
          is_public_domain?: boolean
          language?: string
          literary_form?: string | null
          publication_year?: string | null
          rights_note?: string | null
          slug?: string
          source_name?: string | null
          source_url?: string | null
          title_original?: string | null
          title_zh?: string | null
          updated_at?: string
          verification_status?: string
        }
        Relationships: []
      }
      membership_orders: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          granted_expires_at: string
          granted_started_at: string
          id: string
          idempotency_key: string
          payment_method: string
          previous_expires_at: string | null
          previous_tier: string
          provider: string
          provider_order_id: string
          status: string
          target_tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          granted_expires_at: string
          granted_started_at: string
          id?: string
          idempotency_key: string
          payment_method: string
          previous_expires_at?: string | null
          previous_tier: string
          provider?: string
          provider_order_id: string
          status?: string
          target_tier: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          granted_expires_at?: string
          granted_started_at?: string
          id?: string
          idempotency_key?: string
          payment_method?: string
          previous_expires_at?: string | null
          previous_tier?: string
          provider?: string
          provider_order_id?: string
          status?: string
          target_tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          birth_date: string | null
          created_at: string
          display_name: string | null
          email: string
          id: string
          membership_expires_at: string | null
          membership_started_at: string | null
          membership_tier: Database["public"]["Enums"]["membership_tier"]
          phone: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          membership_expires_at?: string | null
          membership_started_at?: string | null
          membership_tier?: Database["public"]["Enums"]["membership_tier"]
          phone?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          membership_expires_at?: string | null
          membership_started_at?: string | null
          membership_tier?: Database["public"]["Enums"]["membership_tier"]
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      redemption_attempts: {
        Row: {
          code_prefix: string | null
          created_at: string
          error_code: string | null
          id: string
          ip_hash: string | null
          outcome: string
          rate_limited: boolean
          user_id: string | null
        }
        Insert: {
          code_prefix?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          ip_hash?: string | null
          outcome: string
          rate_limited?: boolean
          user_id?: string | null
        }
        Update: {
          code_prefix?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          ip_hash?: string | null
          outcome?: string
          rate_limited?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      redemption_codes: {
        Row: {
          assigned_email: string | null
          benefit_type: string
          campaign_name: string | null
          code_hash: string
          code_last4: string
          code_prefix: string
          created_at: string
          created_by: string
          disabled_at: string | null
          disabled_by: string | null
          duration_days: number | null
          expires_at: string | null
          id: string
          internal_note: string | null
          max_redemptions: number
          redemption_count: number
          report_scope: string | null
          starts_at: string | null
          status: string
        }
        Insert: {
          assigned_email?: string | null
          benefit_type: string
          campaign_name?: string | null
          code_hash: string
          code_last4: string
          code_prefix: string
          created_at?: string
          created_by: string
          disabled_at?: string | null
          disabled_by?: string | null
          duration_days?: number | null
          expires_at?: string | null
          id?: string
          internal_note?: string | null
          max_redemptions?: number
          redemption_count?: number
          report_scope?: string | null
          starts_at?: string | null
          status?: string
        }
        Update: {
          assigned_email?: string | null
          benefit_type?: string
          campaign_name?: string | null
          code_hash?: string
          code_last4?: string
          code_prefix?: string
          created_at?: string
          created_by?: string
          disabled_at?: string | null
          disabled_by?: string | null
          duration_days?: number | null
          expires_at?: string | null
          id?: string
          internal_note?: string | null
          max_redemptions?: number
          redemption_count?: number
          report_scope?: string | null
          starts_at?: string | null
          status?: string
        }
        Relationships: []
      }
      redemption_uses: {
        Row: {
          benefit_type: string
          chart_id: string | null
          entitlement_id: string | null
          failure_code: string | null
          fulfilled_at: string | null
          id: string
          ip_hash: string | null
          order_id: string | null
          redeemed_at: string
          redemption_code_id: string
          request_id: string
          status: string
          user_agent_summary: string | null
          user_id: string
        }
        Insert: {
          benefit_type: string
          chart_id?: string | null
          entitlement_id?: string | null
          failure_code?: string | null
          fulfilled_at?: string | null
          id?: string
          ip_hash?: string | null
          order_id?: string | null
          redeemed_at?: string
          redemption_code_id: string
          request_id: string
          status: string
          user_agent_summary?: string | null
          user_id: string
        }
        Update: {
          benefit_type?: string
          chart_id?: string | null
          entitlement_id?: string | null
          failure_code?: string | null
          fulfilled_at?: string | null
          id?: string
          ip_hash?: string | null
          order_id?: string | null
          redeemed_at?: string
          redemption_code_id?: string
          request_id?: string
          status?: string
          user_agent_summary?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "redemption_uses_redemption_code_id_fkey"
            columns: ["redemption_code_id"]
            isOneToOne: false
            referencedRelation: "redemption_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          calculation_version: string | null
          chart_id: string
          content_hash: string | null
          created_at: string
          error_message: string | null
          generated_at: string | null
          id: string
          input_hash: string | null
          input_snapshot: Json
          kind: string
          model: string | null
          provider: string | null
          report_json: Json | null
          report_version: string
          status: string
          token_usage: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          calculation_version?: string | null
          chart_id: string
          content_hash?: string | null
          created_at?: string
          error_message?: string | null
          generated_at?: string | null
          id?: string
          input_hash?: string | null
          input_snapshot?: Json
          kind: string
          model?: string | null
          provider?: string | null
          report_json?: Json | null
          report_version: string
          status?: string
          token_usage?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          calculation_version?: string | null
          chart_id?: string
          content_hash?: string | null
          created_at?: string
          error_message?: string | null
          generated_at?: string | null
          id?: string
          input_hash?: string | null
          input_snapshot?: Json
          kind?: string
          model?: string | null
          provider?: string | null
          report_json?: Json | null
          report_version?: string
          status?: string
          token_usage?: Json | null
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
          admin_note: string | null
          category: Database["public"]["Enums"]["feedback_category"]
          created_at: string
          id: string
          keywords: string[]
          lang: string | null
          message: string
          order_id: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          request_id: string | null
          resolved: boolean
          resolved_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string | null
          ticket_code: string
          updated_at: string
          user_id: string | null
          user_reply: string | null
        }
        Insert: {
          admin_note?: string | null
          category?: Database["public"]["Enums"]["feedback_category"]
          created_at?: string
          id?: string
          keywords?: string[]
          lang?: string | null
          message: string
          order_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          request_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string | null
          ticket_code?: string
          updated_at?: string
          user_id?: string | null
          user_reply?: string | null
        }
        Update: {
          admin_note?: string | null
          category?: Database["public"]["Enums"]["feedback_category"]
          created_at?: string
          id?: string
          keywords?: string[]
          lang?: string | null
          message?: string
          order_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          request_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string | null
          ticket_code?: string
          updated_at?: string
          user_id?: string | null
          user_reply?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "premium_report_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_literature_annotations: {
        Row: {
          annotation: string
          created_at: string
          id: string
          recommendation_id: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          annotation: string
          created_at?: string
          id?: string
          recommendation_id: string
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          annotation?: string
          created_at?: string
          id?: string
          recommendation_id?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_literature_annotations_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "user_literature_recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_literature_preferences: {
        Row: {
          created_at: string
          preferred_regions: string[]
          preferred_tones: string[]
          prefers_classical: boolean
          prefers_modern: boolean
          show_age_on_share: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          preferred_regions?: string[]
          preferred_tones?: string[]
          prefers_classical?: boolean
          prefers_modern?: boolean
          show_age_on_share?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          preferred_regions?: string[]
          preferred_tones?: string[]
          prefers_classical?: boolean
          prefers_modern?: boolean
          show_age_on_share?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_literature_recommendations: {
        Row: {
          ai_model: string | null
          chart_id: string | null
          concern: string | null
          content_version: string
          dismissed: boolean
          generated_at: string
          id: string
          last_viewed_at: string
          life_stage: string | null
          passage_id: string
          personalized_bridge_en: string | null
          personalized_bridge_zh: string | null
          prompt_version: string | null
          ranking_reasons: Json
          ranking_score: number | null
          reading_tone: string | null
          saved: boolean
          unique_key: string
          user_id: string
        }
        Insert: {
          ai_model?: string | null
          chart_id?: string | null
          concern?: string | null
          content_version?: string
          dismissed?: boolean
          generated_at?: string
          id?: string
          last_viewed_at?: string
          life_stage?: string | null
          passage_id: string
          personalized_bridge_en?: string | null
          personalized_bridge_zh?: string | null
          prompt_version?: string | null
          ranking_reasons?: Json
          ranking_score?: number | null
          reading_tone?: string | null
          saved?: boolean
          unique_key: string
          user_id: string
        }
        Update: {
          ai_model?: string | null
          chart_id?: string | null
          concern?: string | null
          content_version?: string
          dismissed?: boolean
          generated_at?: string
          id?: string
          last_viewed_at?: string
          life_stage?: string | null
          passage_id?: string
          personalized_bridge_en?: string | null
          personalized_bridge_zh?: string | null
          prompt_version?: string | null
          ranking_reasons?: Json
          ranking_score?: number | null
          reading_tone?: string | null
          saved?: boolean
          unique_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_literature_recommendations_chart_id_fkey"
            columns: ["chart_id"]
            isOneToOne: false
            referencedRelation: "charts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_literature_recommendations_passage_id_fkey"
            columns: ["passage_id"]
            isOneToOne: false
            referencedRelation: "literature_passages"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          concern: string | null
          concern_at: string | null
          created_at: string
          daily_focus: string | null
          daily_focus_date: string | null
          life_stage: string | null
          life_stage_source: string | null
          onboarding_intent: string | null
          onboarding_intent_at: string | null
          support_mode: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          concern?: string | null
          concern_at?: string | null
          created_at?: string
          daily_focus?: string | null
          daily_focus_date?: string | null
          life_stage?: string | null
          life_stage_source?: string | null
          onboarding_intent?: string | null
          onboarding_intent_at?: string | null
          support_mode?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          concern?: string | null
          concern_at?: string | null
          created_at?: string
          daily_focus?: string | null
          daily_focus_date?: string | null
          life_stage?: string | null
          life_stage_source?: string | null
          onboarding_intent?: string | null
          onboarding_intent_at?: string | null
          support_mode?: string | null
          updated_at?: string
          user_id?: string
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
      admin_community_audit_log: {
        Args: { _action?: string; _limit?: number; _target_type?: string }
        Returns: {
          action: string
          actor_id: string
          created_at: string
          id: string
          notes: string
          target_id: string
          target_type: string
        }[]
      }
      admin_community_hall_metrics: { Args: { _days?: number }; Returns: Json }
      admin_community_hall_overview: { Args: never; Returns: Json }
      admin_create_redemption_code:
        | {
            Args: {
              _benefit_type: string
              _campaign_name: string
              _code_hash: string
              _code_last4: string
              _code_prefix: string
              _duration_days: number
              _expires_at: string
              _internal_note: string
              _max_redemptions: number
              _report_scope: string
              _starts_at: string
            }
            Returns: string
          }
        | {
            Args: {
              _assigned_email?: string
              _benefit_type: string
              _campaign_name: string
              _code_hash: string
              _code_last4: string
              _code_prefix: string
              _duration_days: number
              _expires_at: string
              _internal_note: string
              _max_redemptions: number
              _report_scope: string
              _starts_at: string
            }
            Returns: string
          }
      admin_disable_redemption_code: {
        Args: { _code_id: string }
        Returns: undefined
      }
      admin_list_redemption_codes: {
        Args: {
          _benefit_type?: string
          _campaign_name?: string
          _limit?: number
          _status?: string
        }
        Returns: {
          assigned_email: string
          benefit_type: string
          campaign_name: string
          code_last4: string
          code_prefix: string
          created_at: string
          created_by: string
          duration_days: number
          expires_at: string
          id: string
          internal_note: string
          max_redemptions: number
          redemption_count: number
          report_scope: string
          starts_at: string
          status: string
        }[]
      }
      admin_list_redemption_uses: {
        Args: { _code_id?: string; _limit?: number; _user_id?: string }
        Returns: {
          benefit_type: string
          chart_id: string
          code_last4: string
          code_prefix: string
          entitlement_id: string
          failure_code: string
          fulfilled_at: string
          id: string
          order_id: string
          redeemed_at: string
          redemption_code_id: string
          status: string
          user_email: string
          user_id: string
        }[]
      }
      admin_moderate_community_letter: {
        Args: { _action: string; _letter_id: string; _notes?: string }
        Returns: Json
      }
      admin_moderate_community_reply: {
        Args: { _action: string; _notes?: string; _reply_id: string }
        Returns: Json
      }
      admin_set_community_participation: {
        Args: { _notes?: string; _status: string; _user_id: string }
        Returns: Json
      }
      apply_membership_grant: {
        Args: {
          _amount_cents?: number
          _duration_days: number
          _idempotency_key: string
          _payment_method: string
          _provider: string
          _target_tier: string
          _user_id: string
        }
        Returns: Json
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
      close_community_letter: { Args: { _letter_id: string }; Returns: string }
      community_age_band: { Args: { _uid: string }; Returns: string }
      community_email_verified: { Args: never; Returns: boolean }
      community_match_alias_for: { Args: { _uid: string }; Returns: string }
      community_match_expire_stale: { Args: never; Returns: undefined }
      community_match_invite_by_alias: {
        Args: { _alias: string; _mode?: string }
        Returns: {
          created_at: string
          expires_at: string
          id: string
          mode: string
          recipient_id: string
          responded_at: string | null
          sender_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "community_match_invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      community_match_opt_in: {
        Args: {
          _age_band: string
          _consent_version: string
          _show_age_band: boolean
        }
        Returns: {
          age_band: string | null
          anonymous_alias: string
          consent_version: string
          consented_at: string
          created_at: string
          is_active: boolean
          last_recommended_at: string | null
          paused_at: string | null
          primary_chart_id: string | null
          recommend_count_today: number
          recommend_day_key: string
          show_age_band: boolean
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "community_match_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      community_match_opt_out: { Args: never; Returns: undefined }
      community_match_pair_key: {
        Args: { _a: string; _b: string }
        Returns: string
      }
      community_match_recommend: {
        Args: { _limit?: number }
        Returns: {
          age_band: string
          alias: string
          invite_target_id: string
          is_paused: boolean
        }[]
      }
      community_match_respond: {
        Args: { _action: string; _invite_id: string }
        Returns: {
          created_at: string
          expires_at: string
          id: string
          mode: string
          recipient_id: string
          responded_at: string | null
          sender_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "community_match_invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      community_match_revoke_grant: {
        Args: { _mode?: string; _pair_key: string }
        Returns: undefined
      }
      community_match_revoke_invite: {
        Args: { _invite_id: string }
        Returns: undefined
      }
      community_match_set_paused: {
        Args: { _paused: boolean }
        Returns: undefined
      }
      community_match_upsert_result: {
        Args: {
          _calc_version: string
          _evidence: Json
          _facets: Json
          _mode: string
          _pair_key: string
          _score: Json
        }
        Returns: undefined
      }
      delete_my_community_data: { Args: never; Returns: Json }
      dispatch_community_letter: {
        Args: { _letter_id: string }
        Returns: number
      }
      generate_ticket_code: { Args: never; Returns: string }
      get_community_letter_dispatch_state: {
        Args: { _letter_id: string }
        Returns: Json
      }
      get_community_library_samples: {
        Args: { _language?: string; _limit?: number }
        Returns: Json
      }
      get_community_public_letter: {
        Args: { _letter_id: string }
        Returns: Json
      }
      get_community_public_wall: { Args: { _limit?: number }; Returns: Json }
      get_my_community_mailbox: { Args: never; Returns: Json }
      list_my_redemption_uses: {
        Args: never
        Returns: {
          benefit_type: string
          campaign_name: string
          chart_id: string
          code_last4: string
          code_prefix: string
          duration_days: number
          fulfilled_at: string
          id: string
          order_id: string
          redeemed_at: string
          status: string
        }[]
      }
      mark_community_onboarded: { Args: never; Returns: string }
      redeem_code: {
        Args: {
          _chart_id: string
          _code_hash: string
          _code_prefix: string
          _ip_hash: string
          _request_id: string
          _user_agent_summary: string
        }
        Returns: Json
      }
      reply_to_community_letter: {
        Args: { _body: string; _letter_id: string; _needs_review?: boolean }
        Returns: string
      }
      report_community_content: {
        Args: {
          _details?: string
          _reason: string
          _target_id: string
          _target_type: string
        }
        Returns: string
      }
      send_community_letter: {
        Args: {
          _body: string
          _needs_review?: boolean
          _response_style: string
          _risk_level?: string
          _subject: string
          _target_age_band: string
          _topic: string
          _visibility?: string
        }
        Returns: string
      }
      set_chart_role: {
        Args: { _chart_id: string; _role: string }
        Returns: boolean
      }
      set_community_echo_saved: {
        Args: { _reply_id: string; _saved: boolean }
        Returns: boolean
      }
      set_primary_chart: { Args: { _chart_id: string }; Returns: boolean }
      simulate_mock_membership_upgrade: {
        Args: {
          _idempotency_key: string
          _payment_method: string
          _target_tier: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
      feedback_category:
        | "device"
        | "order"
        | "other"
        | "product"
        | "payment"
        | "subscription"
      membership_tier: "none" | "sage" | "oracle"
      ticket_priority: "low" | "normal" | "high" | "urgent"
      ticket_status:
        | "new"
        | "in_progress"
        | "waiting_user"
        | "resolved"
        | "closed"
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
      feedback_category: [
        "device",
        "order",
        "other",
        "product",
        "payment",
        "subscription",
      ],
      membership_tier: ["none", "sage", "oracle"],
      ticket_priority: ["low", "normal", "high", "urgent"],
      ticket_status: [
        "new",
        "in_progress",
        "waiting_user",
        "resolved",
        "closed",
      ],
    },
  },
} as const
