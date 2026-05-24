/**
 * Generated TypeScript types for the Ty's Table Supabase database.
 * Run `npx supabase gen types typescript --project-id YOUR_ID` to auto-generate
 * this file from your live schema, or update manually when the schema changes.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          subscription_tier: "free" | "pro";
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          city: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string;
          subscription_tier?: "free" | "pro";
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          city?: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string;
          subscription_tier?: "free" | "pro";
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          city?: string;
          avatar_url?: string | null;
          updated_at?: string;
        };
      };
      user_preferences: {
        Row: {
          user_id: string;
          cuisines: string[];
          monthly_budget: number;
          cook_nights: number;
          dine_out_nights: number;
          onboarded: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          cuisines?: string[];
          monthly_budget?: number;
          cook_nights?: number;
          dine_out_nights?: number;
          onboarded?: boolean;
          updated_at?: string;
        };
        Update: {
          cuisines?: string[];
          monthly_budget?: number;
          cook_nights?: number;
          dine_out_nights?: number;
          onboarded?: boolean;
          updated_at?: string;
        };
      };
      funds: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          target_amount: number;
          is_active: boolean;
          cashed_out: boolean;
          cashed_out_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          target_amount: number;
          is_active?: boolean;
          cashed_out?: boolean;
          cashed_out_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          target_amount?: number;
          is_active?: boolean;
          cashed_out?: boolean;
          cashed_out_at?: string | null;
          updated_at?: string;
        };
      };
      deposits: {
        Row: {
          id: string;
          user_id: string;
          fund_id: string;
          dish: string;
          amount: number;
          date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          fund_id: string;
          dish?: string;
          amount?: number;
          date?: string;
          created_at?: string;
        };
        Update: never;
      };
      suggestions: {
        Row: {
          id: string;
          user_id: string;
          fund_id: string | null;
          type: "cook" | "dine_out";
          title: string;
          description: string;
          estimated_cost: number | null;
          reason: string;
          was_accepted: boolean | null;
          generated_at: string;
          date: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          fund_id?: string | null;
          type: "cook" | "dine_out";
          title: string;
          description?: string;
          estimated_cost?: number | null;
          reason?: string;
          was_accepted?: boolean | null;
          generated_at?: string;
          date?: string;
        };
        Update: {
          was_accepted?: boolean | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
