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
      club_players: {
        Row: {
          birth_date: string | null
          city: string
          club_id: string
          created_at: string
          created_by: string | null
          email: string
          gender: string
          house_number: string
          id: string
          name: string
          phone: string
          photo_consent: boolean
          postal_code: string
          street: string
          ttr: number
        }
        Insert: {
          birth_date?: string | null
          city?: string
          club_id: string
          created_at?: string
          created_by?: string | null
          email?: string
          gender?: string
          house_number?: string
          id?: string
          name: string
          phone?: string
          photo_consent?: boolean
          postal_code?: string
          street?: string
          ttr?: number
        }
        Update: {
          birth_date?: string | null
          city?: string
          club_id?: string
          created_at?: string
          created_by?: string | null
          email?: string
          gender?: string
          house_number?: string
          id?: string
          name?: string
          phone?: string
          photo_consent?: boolean
          postal_code?: string
          street?: string
          ttr?: number
        }
        Relationships: [
          {
            foreignKeyName: "club_players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      doubles_pairs: {
        Row: {
          created_at: string
          id: string
          pair_name: string
          player1_id: string
          player2_id: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pair_name?: string
          player1_id: string
          player2_id: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pair_name?: string
          player1_id?: string
          player2_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doubles_pairs_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doubles_pairs_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doubles_pairs_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      match_photos: {
        Row: {
          created_at: string
          id: string
          match_id: string | null
          photo_type: string
          photo_url: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id?: string | null
          photo_type?: string
          photo_url: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string | null
          photo_type?: string
          photo_url?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_photos_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_photos_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          completed_at: string | null
          created_at: string
          group_number: number | null
          id: string
          player1_id: string | null
          player2_id: string | null
          position: number
          round: number
          sets: Json
          status: string
          table_number: number | null
          tournament_id: string
          winner_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          group_number?: number | null
          id?: string
          player1_id?: string | null
          player2_id?: string | null
          position?: number
          round?: number
          sets?: Json
          status?: string
          table_number?: number | null
          tournament_id: string
          winner_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          group_number?: number | null
          id?: string
          player1_id?: string | null
          player2_id?: string | null
          position?: number
          round?: number
          sets?: Json
          status?: string
          table_number?: number | null
          tournament_id?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          birth_date: string | null
          city: string
          club: string
          created_at: string
          gender: string
          group_number: number | null
          house_number: string
          id: string
          name: string
          phone: string
          postal_code: string
          street: string
          tournament_id: string
          ttr: number
        }
        Insert: {
          birth_date?: string | null
          city?: string
          club?: string
          created_at?: string
          gender?: string
          group_number?: number | null
          house_number?: string
          id?: string
          name: string
          phone?: string
          postal_code?: string
          street?: string
          tournament_id: string
          ttr?: number
        }
        Update: {
          birth_date?: string | null
          city?: string
          club?: string
          created_at?: string
          gender?: string
          group_number?: number | null
          house_number?: string
          id?: string
          name?: string
          phone?: string
          postal_code?: string
          street?: string
          tournament_id?: string
          ttr?: number
        }
        Relationships: [
          {
            foreignKeyName: "players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          best_of: number
          break_minutes: number
          created_at: string
          created_by: string | null
          id: string
          logo_url: string | null
          mode: string
          motto: string
          name: string
          phase: string | null
          rounds: number
          started: boolean
          table_count: number
          tournament_date: string | null
          type: string
          updated_at: string
          venue_city: string
          venue_house_number: string
          venue_postal_code: string
          venue_street: string
        }
        Insert: {
          best_of?: number
          break_minutes?: number
          created_at?: string
          created_by?: string | null
          id?: string
          logo_url?: string | null
          mode?: string
          motto?: string
          name?: string
          phase?: string | null
          rounds?: number
          started?: boolean
          table_count?: number
          tournament_date?: string | null
          type?: string
          updated_at?: string
          venue_city?: string
          venue_house_number?: string
          venue_postal_code?: string
          venue_street?: string
        }
        Update: {
          best_of?: number
          break_minutes?: number
          created_at?: string
          created_by?: string | null
          id?: string
          logo_url?: string | null
          mode?: string
          motto?: string
          name?: string
          phase?: string | null
          rounds?: number
          started?: boolean
          table_count?: number
          tournament_date?: string | null
          type?: string
          updated_at?: string
          venue_city?: string
          venue_house_number?: string
          venue_postal_code?: string
          venue_street?: string
        }
        Relationships: []
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
