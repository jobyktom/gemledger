// Generated from the gemledger-mumbai Supabase project. Do not edit by hand;
// regenerate with `supabase gen types typescript --project-id rikpwgvbnrbyaolfduug`.
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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      documents: {
        Row: {
          created_at: string
          id: string
          item_id: string
          kind: Database["public"]["Enums"]["document_kind"]
          sha256: string | null
          shop_id: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          kind: Database["public"]["Enums"]["document_kind"]
          sha256?: string | null
          shop_id: string
          storage_path: string
          uploaded_by?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          kind?: Database["public"]["Enums"]["document_kind"]
          sha256?: string | null
          shop_id?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      grading_reports: {
        Row: {
          checked_at: string | null
          created_at: string
          id: string
          item_id: string
          lab: Database["public"]["Enums"]["grading_lab"]
          lab_fields: Json | null
          report_number: string
          shop_id: string
          status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          checked_at?: string | null
          created_at?: string
          id?: string
          item_id: string
          lab: Database["public"]["Enums"]["grading_lab"]
          lab_fields?: Json | null
          report_number: string
          shop_id: string
          status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          checked_at?: string | null
          created_at?: string
          id?: string
          item_id?: string
          lab?: Database["public"]["Enums"]["grading_lab"]
          lab_fields?: Json | null
          report_number?: string
          shop_id?: string
          status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "grading_reports_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grading_reports_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      item_huids: {
        Row: {
          huid: string
          item_id: string
          shop_id: string
        }
        Insert: {
          huid: string
          item_id: string
          shop_id: string
        }
        Update: {
          huid?: string
          item_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_huids_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_huids_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          gross_weight_g: number
          id: string
          karat: number | null
          metal: Database["public"]["Enums"]["metal"]
          net_weight_g: number | null
          price_paise: number | null
          shop_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          description?: string | null
          gross_weight_g: number
          id?: string
          karat?: number | null
          metal: Database["public"]["Enums"]["metal"]
          net_weight_g?: number | null
          price_paise?: number | null
          shop_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          gross_weight_g?: number
          id?: string
          karat?: number | null
          metal?: Database["public"]["Enums"]["metal"]
          net_weight_g?: number | null
          price_paise?: number | null
          shop_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      passports: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          id: string
          issued_at: string
          issued_by: string
          item_id: string
          public_id: string
          revoked_at: string | null
          shop_id: string
          status: Database["public"]["Enums"]["passport_status"]
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          id?: string
          issued_at?: string
          issued_by?: string
          item_id: string
          public_id: string
          revoked_at?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["passport_status"]
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          id?: string
          issued_at?: string
          issued_by?: string
          item_id?: string
          public_id?: string
          revoked_at?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["passport_status"]
        }
        Relationships: [
          {
            foreignKeyName: "passports_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passports_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_members: {
        Row: {
          created_at: string
          display_name: string | null
          invited_by: string | null
          role: Database["public"]["Enums"]["shop_role"]
          shop_id: string
          status: Database["public"]["Enums"]["member_status"]
          status_changed_at: string | null
          status_changed_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          invited_by?: string | null
          role?: Database["public"]["Enums"]["shop_role"]
          shop_id: string
          status?: Database["public"]["Enums"]["member_status"]
          status_changed_at?: string | null
          status_changed_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          invited_by?: string | null
          role?: Database["public"]["Enums"]["shop_role"]
          shop_id?: string
          status?: Database["public"]["Enums"]["member_status"]
          status_changed_at?: string | null
          status_changed_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_members_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          by_platform_admin: boolean
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          display_name: string
          email: string | null
          expires_at: string
          for_user_id: string | null
          id: string
          invited_by: string | null
          phone: string | null
          replaces_user_id: string | null
          role: Database["public"]["Enums"]["shop_role"]
          shop_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          by_platform_admin?: boolean
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          display_name: string
          email?: string | null
          expires_at?: string
          for_user_id?: string | null
          id?: string
          invited_by?: string | null
          phone?: string | null
          replaces_user_id?: string | null
          role: Database["public"]["Enums"]["shop_role"]
          shop_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          by_platform_admin?: boolean
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          expires_at?: string
          for_user_id?: string | null
          id?: string
          invited_by?: string | null
          phone?: string | null
          replaces_user_id?: string | null
          role?: Database["public"]["Enums"]["shop_role"]
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_invites_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          city: string
          created_at: string
          created_by: string
          gstin: string | null
          id: string
          legal_name: string | null
          name: string
          phone: string | null
          state: string
          status: Database["public"]["Enums"]["shop_status"]
        }
        Insert: {
          city: string
          created_at?: string
          created_by?: string
          gstin?: string | null
          id?: string
          legal_name?: string | null
          name: string
          phone?: string | null
          state: string
          status?: Database["public"]["Enums"]["shop_status"]
        }
        Update: {
          city?: string
          created_at?: string
          created_by?: string
          gstin?: string | null
          id?: string
          legal_name?: string | null
          name?: string
          phone?: string | null
          state?: string
          status?: Database["public"]["Enums"]["shop_status"]
        }
        Relationships: []
      }
      staff_activity_log: {
        Row: {
          action: string
          actor_id: string | null
          by_platform_admin: boolean
          created_at: string
          details: Json
          id: number
          shop_id: string
          target_name: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          by_platform_admin?: boolean
          created_at?: string
          details?: Json
          id?: number
          shop_id: string
          target_name?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          by_platform_admin?: boolean
          created_at?: string
          details?: Json
          id?: number
          shop_id?: string
          target_name?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_activity_log_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_shop_members: {
        Args: { p_shop: string }
        Returns: {
          email: string | null
          joined_at: string
          last_sign_in_at: string | null
          phone: string | null
          role: Database["public"]["Enums"]["shop_role"]
          user_id: string
          display_name: string | null
          status: Database["public"]["Enums"]["member_status"]
        }[]
      }
      accept_staff_invite: { Args: { p_invite: string }; Returns: undefined }
      accept_staff_invites: {
        Args: never
        Returns: { role: Database["public"]["Enums"]["shop_role"]; shop_id: string; shop_name: string }[]
      }
      admin_invite_shop_admin: {
        Args: { p_email: string | null; p_name: string; p_phone: string | null; p_shop: string }
        Returns: string
      }
      admin_set_member_status: {
        Args: { p_shop: string; p_status: Database["public"]["Enums"]["member_status"]; p_user: string }
        Returns: undefined
      }
      admin_shop_stats: {
        Args: never
        Returns: {
          city: string
          created_at: string
          gstin: string | null
          issued_this_month: number
          items: number
          last_activity_at: string
          members: number
          name: string
          passports_claimed: number
          passports_issued: number
          passports_revoked: number
          phone: string | null
          shop_id: string
          state: string
          status: Database["public"]["Enums"]["shop_status"]
        }[]
      }
      admin_weekly_passports: {
        Args: { p_shop?: string; p_weeks?: number }
        Returns: { claimed: number; issued: number; week_start: string }[]
      }
      am_platform_admin: { Args: never; Returns: boolean }
      create_item: {
        Args: {
          p_description: string | null
          p_gross_weight_g: number
          p_huids?: string[]
          p_karat: number | null
          p_metal: Database["public"]["Enums"]["metal"]
          p_net_weight_g: number | null
          p_price_paise: number | null
          p_reports?: Json
          p_shop_id: string
          p_title: string
        }
        Returns: string
      }
      my_pending_invites: {
        Args: never
        Returns: {
          expires_at: string
          id: string
          invited_by_name: string
          role: Database["public"]["Enums"]["shop_role"]
          shop_id: string
          shop_name: string
        }[]
      }
      staff_cancel_invite: { Args: { p_invite: string }; Returns: undefined }
      staff_change_login: {
        Args: { p_email: string | null; p_phone: string | null; p_shop: string; p_user: string }
        Returns: string
      }
      staff_change_role: {
        Args: { p_role: Database["public"]["Enums"]["shop_role"]; p_shop: string; p_user: string }
        Returns: undefined
      }
      staff_invite: {
        Args: { p_email: string | null; p_name: string; p_phone: string | null; p_role: Database["public"]["Enums"]["shop_role"]; p_shop: string }
        Returns: string
      }
      staff_list: {
        Args: { p_include_removed?: boolean; p_shop: string }
        Returns: {
          contact: string | null
          display_name: string | null
          is_me: boolean
          joined_at: string
          last_sign_in_at: string | null
          role: Database["public"]["Enums"]["shop_role"]
          status: Database["public"]["Enums"]["member_status"]
          user_id: string
        }[]
      }
      staff_offer_admin: { Args: { p_shop: string; p_user: string }; Returns: string }
      staff_rename: { Args: { p_name: string; p_shop: string; p_user: string }; Returns: undefined }
      staff_set_status: {
        Args: { p_shop: string; p_status: Database["public"]["Enums"]["member_status"]; p_user: string }
        Returns: undefined
      }
      get_public_passport: {
        Args: { p_public_id: string }
        Returns: {
          gross_weight_g: number
          huids: string[]
          issued_at: string
          item_title: string
          karat: number
          metal: Database["public"]["Enums"]["metal"]
          public_id: string
          reports: Json
          shop_city: string
          shop_name: string
          status: Database["public"]["Enums"]["passport_status"]
        }[]
      }
      wallet_apple_device_passes: {
        Args: { p_device: string; p_since?: string }
        Returns: { public_id: string; updated_at: string }[]
      }
      wallet_apple_push_tokens: { Args: { p_public_id: string }; Returns: { push_token: string }[] }
      wallet_apple_register: {
        Args: { p_device: string; p_public_id: string; p_push_token: string; p_token: string }
        Returns: string
      }
      wallet_apple_unregister: {
        Args: { p_device: string; p_public_id: string; p_token: string }
        Returns: boolean
      }
      wallet_pass_meta: {
        Args: { p_public_id: string }
        Returns: { token: string; updated_at: string }[]
      }
    }
    Enums: {
      document_kind:
        | "photo"
        | "invoice"
        | "warranty"
        | "lab_report"
        | "hallmark"
        | "other"
      grading_lab: "GIA" | "IGI" | "HRD" | "SGL" | "other"
      member_status: "active" | "suspended" | "removed"
      metal: "gold" | "silver" | "platinum" | "other"
      passport_status: "issued" | "claimed" | "transferred" | "revoked"
      shop_role: "owner" | "manager" | "staff"
      shop_status: "pending" | "approved" | "suspended"
      verification_status:
        | "uploaded"
        | "jeweller_attested"
        | "lab_matched"
        | "mismatch"
        | "not_checkable"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      document_kind: [
        "photo",
        "invoice",
        "warranty",
        "lab_report",
        "hallmark",
        "other",
      ],
      grading_lab: ["GIA", "IGI", "HRD", "SGL", "other"],
      member_status: ["active", "suspended", "removed"],
      metal: ["gold", "silver", "platinum", "other"],
      passport_status: ["issued", "claimed", "transferred", "revoked"],
      shop_role: ["owner", "manager", "staff"],
      shop_status: ["pending", "approved", "suspended"],
      verification_status: [
        "uploaded",
        "jeweller_attested",
        "lab_matched",
        "mismatch",
        "not_checkable",
      ],
    },
  },
} as const
