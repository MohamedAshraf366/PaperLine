export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      paperline_comparisons: {
        Row: {
          created_at: string;
          created_by: string;
          document_a: string;
          document_b: string;
          id: string;
          result: Json;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          document_a: string;
          document_b: string;
          id?: string;
          result?: Json;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          document_a?: string;
          document_b?: string;
          id?: string;
          result?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "paperline_comparisons_document_a_fkey";
            columns: ["document_a"];
            isOneToOne: false;
            referencedRelation: "paperline_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "paperline_comparisons_document_b_fkey";
            columns: ["document_b"];
            isOneToOne: false;
            referencedRelation: "paperline_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "paperline_comparisons_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "paperline_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      paperline_document_chunks: {
        Row: {
          chunk_index: number;
          content: string;
          created_at: string;
          document_id: string;
          embedding: string | null;
          id: string;
          page_number: number | null;
          workspace_id: string;
        };
        Insert: {
          chunk_index: number;
          content: string;
          created_at?: string;
          document_id: string;
          embedding?: string | null;
          id?: string;
          page_number?: number | null;
          workspace_id: string;
        };
        Update: {
          chunk_index?: number;
          content?: string;
          created_at?: string;
          document_id?: string;
          embedding?: string | null;
          id?: string;
          page_number?: number | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "paperline_document_chunks_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "paperline_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "paperline_document_chunks_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "paperline_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      paperline_extractions: {
        Row: {
          created_at: string;
          created_by: string;
          document_id: string;
          fields: Json;
          id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          document_id: string;
          fields?: Json;
          id?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          document_id?: string;
          fields?: Json;
          id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "paperline_extractions_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "paperline_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "paperline_extractions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "paperline_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      paperline_invites: {
        Row: {
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          role: Database["public"]["Enums"]["member_role"];
          status: string;
          token: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by: string;
          role?: Database["public"]["Enums"]["member_role"];
          status?: string;
          token?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          role?: Database["public"]["Enums"]["member_role"];
          status?: string;
          token?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "paperline_invites_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "paperline_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      paperline_messages: {
        Row: {
          citations: Json;
          client_id: string | null;
          conversation_id: string;
          created_at: string;
          id: string;
          parts: Json;
          role: string;
          workspace_id: string;
        };
        Insert: {
          citations?: Json;
          client_id?: string | null;
          conversation_id: string;
          created_at?: string;
          id?: string;
          parts?: Json;
          role: string;
          workspace_id: string;
        };
        Update: {
          citations?: Json;
          client_id?: string | null;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          parts?: Json;
          role?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "paperline_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "paperline_conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "paperline_messages_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "paperline_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      paperline_conversations: {
        Row: {
          created_at: string;
          created_by: string;
          document_ids: string[];
          id: string;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          document_ids?: string[];
          id?: string;
          title?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          document_ids?: string[];
          id?: string;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "paperline_conversations_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "paperline_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      paperline_documents: {
        Row: {
          content: string | null;
          created_at: string;
          error_message: string | null;
          file_kind: string;
          id: string;
          mime_type: string | null;
          name: string;
          page_count: number | null;
          size_bytes: number;
          status: Database["public"]["Enums"]["doc_status"];
          storage_path: string;
          summary: string | null;
          updated_at: string;
          uploaded_by: string;
          word_count: number | null;
          workspace_id: string;
        };
        Insert: {
          content?: string | null;
          created_at?: string;
          error_message?: string | null;
          file_kind?: string;
          id?: string;
          mime_type?: string | null;
          name: string;
          page_count?: number | null;
          size_bytes?: number;
          status?: Database["public"]["Enums"]["doc_status"];
          storage_path: string;
          summary?: string | null;
          updated_at?: string;
          uploaded_by: string;
          word_count?: number | null;
          workspace_id: string;
        };
        Update: {
          content?: string | null;
          created_at?: string;
          error_message?: string | null;
          file_kind?: string;
          id?: string;
          mime_type?: string | null;
          name?: string;
          page_count?: number | null;
          size_bytes?: number;
          status?: Database["public"]["Enums"]["doc_status"];
          storage_path?: string;
          summary?: string | null;
          updated_at?: string;
          uploaded_by?: string;
          word_count?: number | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "paperline_documents_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "paperline_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      paperline_workspaces: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          owner_id: string;
          plan_id: string;
          suspended: boolean;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          owner_id: string;
          plan_id?: string;
          suspended?: boolean;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          owner_id?: string;
          plan_id?: string;
          suspended?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "paperline_workspaces_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "paperline_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      paperline_plans: {
        Row: {
          features: Json;
          id: string;
          max_documents: number;
          max_questions_month: number;
          max_seats: number;
          max_storage_bytes: number;
          name: string;
          price_cents: number;
          sort_order: number;
        };
        Insert: {
          features?: Json;
          id: string;
          max_documents: number;
          max_questions_month: number;
          max_seats: number;
          max_storage_bytes: number;
          name: string;
          price_cents?: number;
          sort_order?: number;
        };
        Update: {
          features?: Json;
          id?: string;
          max_documents?: number;
          max_questions_month?: number;
          max_seats?: number;
          max_storage_bytes?: number;
          name?: string;
          price_cents?: number;
          sort_order?: number;
        };
        Relationships: [];
      };
      paperline_profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      paperline_usage_events: {
        Row: {
          amount: number;
          created_at: string;
          document_id: string | null;
          id: string;
          kind: string;
          user_id: string | null;
          workspace_id: string;
        };
        Insert: {
          amount?: number;
          created_at?: string;
          document_id?: string | null;
          id?: string;
          kind: string;
          user_id?: string | null;
          workspace_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          document_id?: string | null;
          id?: string;
          kind?: string;
          user_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "paperline_usage_events_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "paperline_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      paperline_user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      paperline_workspace_members: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["member_role"];
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["member_role"];
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["member_role"];
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "paperline_workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "paperline_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_manager: {
        Args: { _user: string; _workspace: string };
        Returns: boolean;
      };
      is_member: {
        Args: { _user: string; _workspace: string };
        Returns: boolean;
      };
      match_chunks: {
        Args: {
          _document_ids?: string[];
          _workspace: string;
          match_count?: number;
          query_embedding: string;
        };
        Returns: {
          chunk_index: number;
          content: string;
          document_id: string;
          document_name: string;
          id: string;
          page_number: number;
          similarity: number;
        }[];
      };
    };
    Enums: {
      app_role: "admin" | "user";
      doc_status: "processing" | "ready" | "failed";
      member_role: "owner" | "admin" | "member";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
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
      app_role: ["admin", "user"],
      doc_status: ["processing", "ready", "failed"],
      member_role: ["owner", "admin", "member"],
    },
  },
} as const;
