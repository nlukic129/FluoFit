export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      applications: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          profile_id: string
          status: string
          wave_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          profile_id: string
          status?: string
          wave_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          profile_id?: string
          status?: string
          wave_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_wave_id_fkey"
            columns: ["wave_id"]
            isOneToOne: false
            referencedRelation: "intake_waves"
            referencedColumns: ["id"]
          },
        ]
      }
      attributions: {
        Row: {
          first_touch_at: string
          grace_until: string | null
          ref_code: string
          referrer_id: string
          subscription_id: string
        }
        Insert: {
          first_touch_at?: string
          grace_until?: string | null
          ref_code: string
          referrer_id: string
          subscription_id: string
        }
        Update: {
          first_touch_at?: string
          grace_until?: string | null
          ref_code?: string
          referrer_id?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attributions_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "referrers"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "attributions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: true
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_profile_id: string | null
          at: string
          id: string
          metadata: Json | null
          reason: string | null
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          at?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          at?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          unit_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          unit_count: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          unit_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      boxes: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          batch_id: string
          created_at: string
          human_code: string
          id: string
          opaque_token: string
          status: Database["public"]["Enums"]["box_status"]
          subscription_id: string | null
          void_reason: string | null
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          batch_id: string
          created_at?: string
          human_code: string
          id?: string
          opaque_token: string
          status?: Database["public"]["Enums"]["box_status"]
          subscription_id?: string | null
          void_reason?: string | null
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          batch_id?: string
          created_at?: string
          human_code?: string
          id?: string
          opaque_token?: string
          status?: Database["public"]["Enums"]["box_status"]
          subscription_id?: string | null
          void_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "boxes_activated_by_fkey"
            columns: ["activated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boxes_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boxes_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          amount: number
          cleared_at: string | null
          created_at: string
          hold_until: string | null
          id: string
          order_id: string | null
          referrer_id: string
          state: Database["public"]["Enums"]["commission_state"]
          subscription_id: string
        }
        Insert: {
          amount: number
          cleared_at?: string | null
          created_at?: string
          hold_until?: string | null
          id?: string
          order_id?: string | null
          referrer_id: string
          state?: Database["public"]["Enums"]["commission_state"]
          subscription_id: string
        }
        Update: {
          amount?: number
          cleared_at?: string | null
          created_at?: string
          hold_until?: string | null
          id?: string
          order_id?: string | null
          referrer_id?: string
          state?: Database["public"]["Enums"]["commission_state"]
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "referrers"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "commissions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      config_dials: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "config_dials_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      config_versions: {
        Row: {
          changed_by: string | null
          effective_from: string
          id: string
          key: string
          reason: string | null
          value: Json
        }
        Insert: {
          changed_by?: string | null
          effective_from?: string
          id?: string
          key: string
          reason?: string | null
          value: Json
        }
        Update: {
          changed_by?: string | null
          effective_from?: string
          id?: string
          key?: string
          reason?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "config_versions_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          client_profile_id: string
          granted_at: string
          id: string
          referrer_id: string
          revoked_at: string | null
        }
        Insert: {
          client_profile_id: string
          granted_at?: string
          id?: string
          referrer_id: string
          revoked_at?: string | null
        }
        Update: {
          client_profile_id?: string
          granted_at?: string
          id?: string
          referrer_id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "referrers"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      intake_waves: {
        Row: {
          city_focus: string | null
          closed_at: string | null
          id: string
          name: string
          niche_note: string | null
          opened_at: string
          soft_cap: number | null
          status: string
        }
        Insert: {
          city_focus?: string | null
          closed_at?: string | null
          id?: string
          name: string
          niche_note?: string | null
          opened_at?: string
          soft_cap?: number | null
          status?: string
        }
        Update: {
          city_focus?: string | null
          closed_at?: string | null
          id?: string
          name?: string
          niche_note?: string | null
          opened_at?: string
          soft_cap?: number | null
          status?: string
        }
        Relationships: []
      }
      level_perks: {
        Row: {
          level_id: string
          perk_id: string
        }
        Insert: {
          level_id: string
          perk_id: string
        }
        Update: {
          level_id?: string
          perk_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "level_perks_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "level_perks_perk_id_fkey"
            columns: ["perk_id"]
            isOneToOne: false
            referencedRelation: "perks"
            referencedColumns: ["id"]
          },
        ]
      }
      levels: {
        Row: {
          icon: string | null
          id: string
          name: string
          ordinal: number
          threshold_xp: number
        }
        Insert: {
          icon?: string | null
          id?: string
          name: string
          ordinal: number
          threshold_xp: number
        }
        Update: {
          icon?: string | null
          id?: string
          name?: string
          ordinal?: number
          threshold_xp?: number
        }
        Relationships: []
      }
      member_progress: {
        Row: {
          cumulative_xp: number
          current_level: number
          current_streak: number
          earning_scans_total: number
          last_earning_date: string | null
          longest_streak: number
          profile_id: string
          updated_at: string
        }
        Insert: {
          cumulative_xp?: number
          current_level?: number
          current_streak?: number
          earning_scans_total?: number
          last_earning_date?: string | null
          longest_streak?: number
          profile_id: string
          updated_at?: string
        }
        Update: {
          cumulative_xp?: number
          current_level?: number
          current_streak?: number
          earning_scans_total?: number
          last_earning_date?: string | null
          longest_streak?: number
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_progress_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_reward_snapshots: {
        Row: {
          level_id: string
          perk_id: string
          profile_id: string
          snapshotted_at: string
        }
        Insert: {
          level_id: string
          perk_id: string
          profile_id: string
          snapshotted_at?: string
        }
        Update: {
          level_id?: string
          perk_id?: string
          profile_id?: string
          snapshotted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_reward_snapshots_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_reward_snapshots_perk_id_fkey"
            columns: ["perk_id"]
            isOneToOne: false
            referencedRelation: "perks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_reward_snapshots_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number
          box_id: string | null
          charge_ref: string | null
          charge_status: Database["public"]["Enums"]["charge_status"]
          created_at: string
          id: string
          paid_at: string | null
          subscription_id: string
        }
        Insert: {
          amount: number
          box_id?: string | null
          charge_ref?: string | null
          charge_status?: Database["public"]["Enums"]["charge_status"]
          created_at?: string
          id?: string
          paid_at?: string | null
          subscription_id: string
        }
        Update: {
          amount?: number
          box_id?: string | null
          charge_ref?: string | null
          charge_status?: Database["public"]["Enums"]["charge_status"]
          created_at?: string
          id?: string
          paid_at?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          port: Database["public"]["Enums"]["port_name"]
          processed_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload: Json
          port: Database["public"]["Enums"]["port_name"]
          processed_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          port?: Database["public"]["Enums"]["port_name"]
          processed_at?: string | null
          status?: string
        }
        Relationships: []
      }
      partner_perks: {
        Row: {
          discount_tier: string | null
          level_id: string
          partner_id: string
          perk_id: string
        }
        Insert: {
          discount_tier?: string | null
          level_id: string
          partner_id: string
          perk_id: string
        }
        Update: {
          discount_tier?: string | null
          level_id?: string
          partner_id?: string
          perk_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_perks_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_perks_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_perks_perk_id_fkey"
            columns: ["perk_id"]
            isOneToOne: false
            referencedRelation: "perks"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          active: boolean
          contact: string | null
          created_at: string
          id: string
          kind: string | null
          name: string
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          contact?: string | null
          created_at?: string
          id?: string
          kind?: string | null
          name: string
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          contact?: string | null
          created_at?: string
          id?: string
          kind?: string | null
          name?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      perks: {
        Row: {
          cost_hint: number | null
          funding: Database["public"]["Enums"]["perk_funding"]
          id: string
          name: string
        }
        Insert: {
          cost_hint?: number | null
          funding: Database["public"]["Enums"]["perk_funding"]
          id?: string
          name: string
        }
        Update: {
          cost_hint?: number | null
          funding?: Database["public"]["Enums"]["perk_funding"]
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_timezone: string
          created_at: string
          display_name: string | null
          id: string
          roles: Database["public"]["Enums"]["app_role"][]
          updated_at: string
        }
        Insert: {
          account_timezone?: string
          created_at?: string
          display_name?: string | null
          id: string
          roles?: Database["public"]["Enums"]["app_role"][]
          updated_at?: string
        }
        Update: {
          account_timezone?: string
          created_at?: string
          display_name?: string | null
          id?: string
          roles?: Database["public"]["Enums"]["app_role"][]
          updated_at?: string
        }
        Relationships: []
      }
      referrers: {
        Row: {
          created_at: string
          current_tier: number | null
          eligibility_met_at: string | null
          fixed_pct: number | null
          profile_id: string
          ref_code: string
          status: Database["public"]["Enums"]["referrer_status"]
          type: Database["public"]["Enums"]["referrer_type"]
        }
        Insert: {
          created_at?: string
          current_tier?: number | null
          eligibility_met_at?: string | null
          fixed_pct?: number | null
          profile_id: string
          ref_code: string
          status?: Database["public"]["Enums"]["referrer_status"]
          type: Database["public"]["Enums"]["referrer_type"]
        }
        Update: {
          created_at?: string
          current_tier?: number | null
          eligibility_met_at?: string | null
          fixed_pct?: number | null
          profile_id?: string
          ref_code?: string
          status?: Database["public"]["Enums"]["referrer_status"]
          type?: Database["public"]["Enums"]["referrer_type"]
        }
        Relationships: [
          {
            foreignKeyName: "referrers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sachet_scans: {
        Row: {
          box_id: string | null
          client_idempotency_key: string
          earned: boolean
          id: string
          profile_id: string
          received_at: string
          scan_date_local: string
          scanned_at: string
        }
        Insert: {
          box_id?: string | null
          client_idempotency_key: string
          earned?: boolean
          id?: string
          profile_id: string
          received_at?: string
          scan_date_local: string
          scanned_at: string
        }
        Update: {
          box_id?: string | null
          client_idempotency_key?: string
          earned?: boolean
          id?: string
          profile_id?: string
          received_at?: string
          scan_date_local?: string
          scanned_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sachet_scans_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sachet_scans_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          delivered_at: string | null
          id: string
          order_id: string
          shipped_at: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_ref: string | null
          updated_at: string
        }
        Insert: {
          delivered_at?: string | null
          id?: string
          order_id: string
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_ref?: string | null
          updated_at?: string
        }
        Update: {
          delivered_at?: string | null
          id?: string
          order_id?: string
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          benefit_clock_expires_at: string | null
          buyer_discount_pct: number | null
          cadence_days: number | null
          created_at: string
          id: string
          last_paid_order_at: string | null
          owner_profile_id: string
          ref_code: string | null
          refill_mode: Database["public"]["Enums"]["refill_mode"]
          smart_substate: Database["public"]["Enums"]["smart_substate"] | null
          status: Database["public"]["Enums"]["sub_status"]
          updated_at: string
        }
        Insert: {
          benefit_clock_expires_at?: string | null
          buyer_discount_pct?: number | null
          cadence_days?: number | null
          created_at?: string
          id?: string
          last_paid_order_at?: string | null
          owner_profile_id: string
          ref_code?: string | null
          refill_mode: Database["public"]["Enums"]["refill_mode"]
          smart_substate?: Database["public"]["Enums"]["smart_substate"] | null
          status?: Database["public"]["Enums"]["sub_status"]
          updated_at?: string
        }
        Update: {
          benefit_clock_expires_at?: string | null
          buyer_discount_pct?: number | null
          cadence_days?: number | null
          created_at?: string
          id?: string
          last_paid_order_at?: string | null
          owner_profile_id?: string
          ref_code?: string | null
          refill_mode?: Database["public"]["Enums"]["refill_mode"]
          smart_substate?: Database["public"]["Enums"]["smart_substate"] | null
          status?: Database["public"]["Enums"]["sub_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          body: string | null
          created_at: string
          id: string
          profile_id: string | null
          status: string
          subject: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          profile_id?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          profile_id?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_coaching_consumption: {
        Row: {
          client_profile_id: string | null
          earned: boolean | null
          scan_date_local: string | null
        }
        Insert: {
          client_profile_id?: string | null
          earned?: boolean | null
          scan_date_local?: string | null
        }
        Update: {
          client_profile_id?: string | null
          earned?: boolean | null
          scan_date_local?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sachet_scans_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_coach: { Args: { client: string }; Returns: boolean }
      fn_activate_box: {
        Args: { p_code: string; p_scanner?: string }
        Returns: Json
      }
      fn_apply_config: {
        Args: { p_key: string; p_reason: string; p_value: Json }
        Returns: undefined
      }
      fn_create_subscription: {
        Args: {
          p_cadence: number
          p_discount?: number
          p_owner: string
          p_ref_code?: string
          p_refill_mode: Database["public"]["Enums"]["refill_mode"]
          p_smart_substate: Database["public"]["Enums"]["smart_substate"]
        }
        Returns: string
      }
      fn_log_audit: {
        Args: {
          p_action: string
          p_metadata?: Json
          p_reason: string
          p_target_id: string
          p_target_table: string
        }
        Returns: undefined
      }
      fn_mark_order_paid: {
        Args: { p_charge_ref: string; p_order: string }
        Returns: undefined
      }
      fn_place_order: {
        Args: { p_amount: number; p_subscription: string }
        Returns: string
      }
      fn_provision_batch: {
        Args: { p_count: number; p_name: string }
        Returns: string
      }
      fn_void_box: {
        Args: { p_box_id: string; p_reason: string }
        Returns: undefined
      }
      gen_box_token: { Args: never; Returns: string }
      gen_human_code: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "member" | "agent" | "affiliate" | "admin"
      box_status: "unbound" | "activated" | "void"
      charge_status:
        | "pending"
        | "authorized"
        | "captured"
        | "failed"
        | "refunded"
      commission_state:
        | "accrued"
        | "cleared"
        | "payable"
        | "paid"
        | "clawed_back"
      perk_funding: "partner" | "spend" | "zero"
      port_name: "payment" | "fulfillment" | "payout" | "notify"
      referrer_status: "active" | "paused" | "offboarded"
      referrer_type: "agent" | "affiliate"
      refill_mode: "smart" | "manual"
      shipment_status: "created" | "shipped" | "in_transit" | "delivered"
      smart_substate: "pending" | "active"
      sub_status: "active" | "paused" | "lapsed" | "cancelled"
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
      app_role: ["member", "agent", "affiliate", "admin"],
      box_status: ["unbound", "activated", "void"],
      charge_status: [
        "pending",
        "authorized",
        "captured",
        "failed",
        "refunded",
      ],
      commission_state: [
        "accrued",
        "cleared",
        "payable",
        "paid",
        "clawed_back",
      ],
      perk_funding: ["partner", "spend", "zero"],
      port_name: ["payment", "fulfillment", "payout", "notify"],
      referrer_status: ["active", "paused", "offboarded"],
      referrer_type: ["agent", "affiliate"],
      refill_mode: ["smart", "manual"],
      shipment_status: ["created", "shipped", "in_transit", "delivered"],
      smart_substate: ["pending", "active"],
      sub_status: ["active", "paused", "lapsed", "cancelled"],
    },
  },
} as const

