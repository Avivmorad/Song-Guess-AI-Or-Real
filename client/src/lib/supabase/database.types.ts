export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      answers: {
        Row: {
          base_points: number | null;
          choice: Database["public"]["Enums"]["answer_choice"];
          id: string;
          is_correct: boolean | null;
          penalty_points: number | null;
          player_id: string;
          round_id: string;
          scored_at: string | null;
          speed_points: number | null;
          submitted_at: string;
          total_points: number | null;
        };
        Insert: {
          base_points?: number | null;
          choice: Database["public"]["Enums"]["answer_choice"];
          id?: string;
          is_correct?: boolean | null;
          penalty_points?: number | null;
          player_id: string;
          round_id: string;
          scored_at?: string | null;
          speed_points?: number | null;
          submitted_at?: string;
          total_points?: number | null;
        };
        Update: {
          base_points?: number | null;
          choice?: Database["public"]["Enums"]["answer_choice"];
          id?: string;
          is_correct?: boolean | null;
          penalty_points?: number | null;
          player_id?: string;
          round_id?: string;
          scored_at?: string | null;
          speed_points?: number | null;
          submitted_at?: string;
          total_points?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "answers_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "answers_round_id_fkey";
            columns: ["round_id"];
            isOneToOne: false;
            referencedRelation: "rounds";
            referencedColumns: ["id"];
          },
        ];
      };
      games: {
        Row: {
          created_at: string;
          finished_at: string | null;
          game_number: number;
          id: string;
          room_id: string;
          started_at: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          finished_at?: string | null;
          game_number: number;
          id?: string;
          room_id: string;
          started_at?: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          finished_at?: string | null;
          game_number?: number;
          id?: string;
          room_id?: string;
          started_at?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "games_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      players: {
        Row: {
          created_at: string;
          id: string;
          is_ready: boolean;
          joined_at: string;
          last_seen_at: string;
          left_at: string | null;
          nickname: string;
          room_id: string;
          score: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_ready?: boolean;
          joined_at?: string;
          last_seen_at?: string;
          left_at?: string | null;
          nickname: string;
          room_id: string;
          score?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_ready?: boolean;
          joined_at?: string;
          last_seen_at?: string;
          left_at?: string | null;
          nickname?: string;
          room_id?: string;
          score?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "players_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      room_events: {
        Row: {
          created_at: string;
          event_type: string;
          id: number;
          room_id: string;
        };
        Insert: {
          created_at?: string;
          event_type: string;
          id?: never;
          room_id: string;
        };
        Update: {
          created_at?: string;
          event_type?: string;
          id?: never;
          room_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "room_events_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      rooms: {
        Row: {
          allow_answer_changes: boolean;
          code: string;
          created_at: string;
          current_game_id: string | null;
          current_round: number;
          expires_at: string;
          host_user_id: string;
          id: string;
          max_players: number;
          music_volume: number;
          negative_points: boolean;
          phase: Database["public"]["Enums"]["room_phase"];
          phase_ends_at: string | null;
          reveal_duration_seconds: number;
          round_count: number;
          round_duration_seconds: number;
          song_pack: string;
          started_at: string | null;
          updated_at: string;
        };
        Insert: {
          allow_answer_changes?: boolean;
          code: string;
          created_at?: string;
          current_game_id?: string | null;
          current_round?: number;
          expires_at?: string;
          host_user_id: string;
          id?: string;
          max_players?: number;
          music_volume?: number;
          negative_points?: boolean;
          phase?: Database["public"]["Enums"]["room_phase"];
          phase_ends_at?: string | null;
          reveal_duration_seconds?: number;
          round_count?: number;
          round_duration_seconds?: number;
          song_pack?: string;
          started_at?: string | null;
          updated_at?: string;
        };
        Update: {
          allow_answer_changes?: boolean;
          code?: string;
          created_at?: string;
          current_game_id?: string | null;
          current_round?: number;
          expires_at?: string;
          host_user_id?: string;
          id?: string;
          max_players?: number;
          music_volume?: number;
          negative_points?: boolean;
          phase?: Database["public"]["Enums"]["room_phase"];
          phase_ends_at?: string | null;
          reveal_duration_seconds?: number;
          round_count?: number;
          round_duration_seconds?: number;
          song_pack?: string;
          started_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rooms_current_game_fk";
            columns: ["current_game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
        ];
      };
      rounds: {
        Row: {
          created_at: string;
          deadline_at: string | null;
          game_id: string;
          id: string;
          reveal_ends_at: string | null;
          room_id: string;
          round_number: number;
          starts_at: string | null;
          status: string;
        };
        Insert: {
          created_at?: string;
          deadline_at?: string | null;
          game_id: string;
          id?: string;
          reveal_ends_at?: string | null;
          room_id: string;
          round_number: number;
          starts_at?: string | null;
          status?: string;
        };
        Update: {
          created_at?: string;
          deadline_at?: string | null;
          game_id?: string;
          id?: string;
          reveal_ends_at?: string | null;
          room_id?: string;
          round_number?: number;
          starts_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rounds_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rounds_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      scores: {
        Row: {
          game_id: string;
          id: string;
          player_id: string;
          total_points: number;
          updated_at: string;
        };
        Insert: {
          game_id: string;
          id?: string;
          player_id: string;
          total_points?: number;
          updated_at?: string;
        };
        Update: {
          game_id?: string;
          id?: string;
          player_id?: string;
          total_points?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scores_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scores_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_list_tracks: { Args: never; Returns: Json };
      admin_upsert_track: {
        Args: {
          p_artist: string;
          p_audio_filename: string;
          p_correct_answer: Database["public"]["Enums"]["answer_choice"];
          p_duration_seconds: number;
          p_enabled: boolean;
          p_license_note: string;
          p_pack: string;
          p_public_id: string;
          p_reveal_description: string;
          p_source_type: string;
          p_title: string;
        };
        Returns: Json;
      };
      create_room: {
        Args: { p_nickname: string; p_settings?: Json };
        Returns: Json;
      };
      get_room_state: { Args: { p_code: string }; Returns: Json };
      heartbeat: { Args: { p_code: string }; Returns: Json };
      join_room: {
        Args: { p_code: string; p_nickname: string };
        Returns: Json;
      };
      leave_room: { Args: { p_code: string }; Returns: Json };
      play_again: { Args: { p_code: string }; Returns: Json };
      mark_round_audio_ready: {
        Args: { p_code: string; p_round_id: string };
        Returns: Json;
      };
      remove_player: {
        Args: { p_code: string; p_player_id: string };
        Returns: Json;
      };
      set_ready: { Args: { p_code: string; p_ready: boolean }; Returns: Json };
      start_game: { Args: { p_code: string }; Returns: Json };
      submit_answer: {
        Args: {
          p_choice: Database["public"]["Enums"]["answer_choice"];
          p_code: string;
        };
        Returns: Json;
      };
      update_settings: {
        Args: { p_code: string; p_settings: Json };
        Returns: Json;
      };
    };
    Enums: {
      answer_choice: "ai" | "real";
      room_phase:
        | "lobby"
        | "preparing"
        | "countdown"
        | "playing"
        | "reveal"
        | "intermission"
        | "finished";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      answer_choice: ["ai", "real"],
      room_phase: [
        "lobby",
        "preparing",
        "countdown",
        "playing",
        "reveal",
        "intermission",
        "finished",
      ],
    },
  },
} as const;
