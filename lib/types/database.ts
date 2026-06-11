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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      cards: {
        Row: {
          back_image_path: string | null
          collection_id: string | null
          created_at: string
          definition: string
          difficulty: number
          due: string
          elapsed_days: number
          front_image_path: string | null
          fsrs_state: Database["public"]["Enums"]["fsrs_state"]
          generation_job_id: string | null
          id: string
          lapses: number
          last_review: string | null
          prompt_direction: Database["public"]["Enums"]["prompt_direction"]
          reps: number
          review_status: Database["public"]["Enums"]["review_status"]
          scheduled_days: number
          source_id: string | null
          source_span: string | null
          stability: number
          term: string
          updated_at: string
          user_id: string
        }
        Insert: {
          back_image_path?: string | null
          collection_id?: string | null
          created_at?: string
          definition: string
          difficulty?: number
          due?: string
          elapsed_days?: number
          front_image_path?: string | null
          fsrs_state?: Database["public"]["Enums"]["fsrs_state"]
          generation_job_id?: string | null
          id?: string
          lapses?: number
          last_review?: string | null
          prompt_direction?: Database["public"]["Enums"]["prompt_direction"]
          reps?: number
          review_status?: Database["public"]["Enums"]["review_status"]
          scheduled_days?: number
          source_id?: string | null
          source_span?: string | null
          stability?: number
          term: string
          updated_at?: string
          user_id: string
        }
        Update: {
          back_image_path?: string | null
          collection_id?: string | null
          created_at?: string
          definition?: string
          difficulty?: number
          due?: string
          elapsed_days?: number
          front_image_path?: string | null
          fsrs_state?: Database["public"]["Enums"]["fsrs_state"]
          generation_job_id?: string | null
          id?: string
          lapses?: number
          last_review?: string | null
          prompt_direction?: Database["public"]["Enums"]["prompt_direction"]
          reps?: number
          review_status?: Database["public"]["Enums"]["review_status"]
          scheduled_days?: number
          source_id?: string | null
          source_span?: string | null
          stability?: number
          term?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_generation_job_id_fkey"
            columns: ["generation_job_id"]
            isOneToOne: false
            referencedRelation: "generation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      generation_feedback: {
        Row: {
          action: Database["public"]["Enums"]["feedback_action"]
          after: Json | null
          before: Json | null
          card_id: string | null
          created_at: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["feedback_action"]
          after?: Json | null
          before?: Json | null
          card_id?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["feedback_action"]
          after?: Json | null
          before?: Json | null
          card_id?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_feedback_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_jobs: {
        Row: {
          anthropic_batch_id: string | null
          cards_generated: number
          created_at: string
          error: string | null
          id: string
          source_id: string | null
          status: Database["public"]["Enums"]["generation_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          anthropic_batch_id?: string | null
          cards_generated?: number
          created_at?: string
          error?: string | null
          id?: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["generation_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          anthropic_batch_id?: string | null
          cards_generated?: number
          created_at?: string
          error?: string | null
          id?: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["generation_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      sources: {
        Row: {
          content: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["source_kind"]
          title: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["source_kind"]
          title?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["source_kind"]
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      study_reviews: {
        Row: {
          card_id: string
          grade: number
          id: string
          mode: Database["public"]["Enums"]["study_mode"]
          reviewed_at: string
          user_id: string
        }
        Insert: {
          card_id: string
          grade: number
          id?: string
          mode?: Database["public"]["Enums"]["study_mode"]
          reviewed_at?: string
          user_id: string
        }
        Update: {
          card_id?: string
          grade?: number
          id?: string
          mode?: Database["public"]["Enums"]["study_mode"]
          reviewed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_reviews_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
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
      feedback_action: "kept" | "edited" | "rejected"
      fsrs_state: "new" | "learning" | "review" | "relearning"
      generation_status: "queued" | "running" | "succeeded" | "failed"
      prompt_direction: "definition_to_term" | "term_to_definition"
      review_status: "pending" | "accepted" | "edited" | "rejected"
      source_kind: "paste" | "markdown" | "pdf" | "docx"
      study_mode: "scheduled" | "cram"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      feedback_action: ["kept", "edited", "rejected"],
      fsrs_state: ["new", "learning", "review", "relearning"],
      generation_status: ["queued", "running", "succeeded", "failed"],
      prompt_direction: ["definition_to_term", "term_to_definition"],
      review_status: ["pending", "accepted", "edited", "rejected"],
      source_kind: ["paste", "markdown", "pdf", "docx"],
      study_mode: ["scheduled", "cram"],
    },
  },
} as const
