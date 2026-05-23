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
      event_comments: {
        Row: {
          body: string
          created_at: string
          event_id: string
          id: string
          upvotes: number
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          event_id: string
          id?: string
          upvotes?: number
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          event_id?: string
          id?: string
          upvotes?: number
          user_id?: string
        }
        Relationships: []
      }
      event_impacts: {
        Row: {
          country_code: string
          country_name: string
          created_at: string
          event_id: string
          id: string
          impact_score: number
          lat: number
          lng: number
          narrative: string
        }
        Insert: {
          country_code: string
          country_name: string
          created_at?: string
          event_id: string
          id?: string
          impact_score?: number
          lat: number
          lng: number
          narrative: string
        }
        Update: {
          country_code?: string
          country_name?: string
          created_at?: string
          event_id?: string
          id?: string
          impact_score?: number
          lat?: number
          lng?: number
          narrative?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_impacts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_predictions: {
        Row: {
          confidence: number
          created_at: string
          event_id: string
          horizon: string
          id: string
          prediction: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          event_id: string
          horizon: string
          id?: string
          prediction: string
        }
        Update: {
          confidence?: number
          created_at?: string
          event_id?: string
          horizon?: string
          id?: string
          prediction?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_predictions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reports: {
        Row: {
          created_at: string
          event_id: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          breaking: boolean
          category: string
          confidence: number
          countries: string[]
          created_at: string
          headline: string
          id: string
          industries: string[]
          risk_score: number
          sentiment: number
          sources: string[]
          summary: string
        }
        Insert: {
          breaking?: boolean
          category: string
          confidence?: number
          countries?: string[]
          created_at?: string
          headline: string
          id?: string
          industries?: string[]
          risk_score?: number
          sentiment?: number
          sources?: string[]
          summary: string
        }
        Update: {
          breaking?: boolean
          category?: string
          confidence?: number
          countries?: string[]
          created_at?: string
          headline?: string
          id?: string
          industries?: string[]
          risk_score?: number
          sentiment?: number
          sources?: string[]
          summary?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      saved_events: {
        Row: {
          created_at: string
          event_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      storyline_events: {
        Row: {
          created_at: string
          event_id: string
          ordinal: number
          rationale: string | null
          storyline_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          ordinal?: number
          rationale?: string | null
          storyline_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          ordinal?: number
          rationale?: string | null
          storyline_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "storyline_events_storyline_id_fkey"
            columns: ["storyline_id"]
            isOneToOne: false
            referencedRelation: "storylines"
            referencedColumns: ["id"]
          },
        ]
      }
      storylines: {
        Row: {
          created_at: string
          id: string
          risk_score: number
          tags: string[]
          thesis: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          risk_score?: number
          tags?: string[]
          thesis: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          risk_score?: number
          tags?: string[]
          thesis?: string
          title?: string
        }
        Relationships: []
      }
      user_interests: {
        Row: {
          created_at: string
          topic: string
          user_id: string
        }
        Insert: {
          created_at?: string
          topic: string
          user_id: string
        }
        Update: {
          created_at?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      user_reputation: {
        Row: {
          points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          points?: number
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
          role?: Database["public"]["Enums"]["app_role"]
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
      votes: {
        Row: {
          created_at: string
          event_id: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          event_id: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          event_id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "votes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "expert" | "user"
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
      app_role: ["admin", "expert", "user"],
    },
  },
} as const
