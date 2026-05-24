/**
 * Supabase data access layer.
 * These functions replace the Redis-based bank-redis.ts / preferences-redis.ts
 * for multi-user support. Each function requires an authenticated Supabase client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { DEFAULT_PREFERENCES, type Preferences } from "@/lib/preferences";

type Supabase = SupabaseClient<Database>;

// ── Profile ──────────────────────────────────────────────────────

export async function getProfile(supabase: Supabase, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw new Error(`getProfile: ${error.message}`);
  return data;
}

export async function updateProfile(
  supabase: Supabase,
  userId: string,
  updates: { display_name?: string; city?: string; avatar_url?: string },
) {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();
  if (error) throw new Error(`updateProfile: ${error.message}`);
  return data;
}

// ── Preferences ──────────────────────────────────────────────────

export async function getPreferences(
  supabase: Supabase,
  userId: string,
): Promise<Preferences & { display_name: string }> {
  const [profileRes, prefsRes] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).single(),
    supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", userId)
      .single(),
  ]);

  const name = profileRes.data?.display_name ?? DEFAULT_PREFERENCES.name;

  if (prefsRes.error || !prefsRes.data) {
    // No preferences row yet — return defaults
    return { ...DEFAULT_PREFERENCES, name, display_name: name };
  }

  const p = prefsRes.data;
  return {
    name,
    display_name: name,
    cuisines: p.cuisines,
    monthlyBudget: p.monthly_budget,
    cookNights: p.cook_nights,
    dineOutNights: p.dine_out_nights,
    onboarded: p.onboarded,
  };
}

export async function upsertPreferences(
  supabase: Supabase,
  userId: string,
  prefs: Partial<Preferences> & { name?: string },
) {
  // Update display_name in profiles if provided
  if (prefs.name) {
    await supabase
      .from("profiles")
      .update({ display_name: prefs.name })
      .eq("id", userId);
  }

  // Upsert preferences row
  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: userId,
      ...(prefs.cuisines !== undefined && { cuisines: prefs.cuisines }),
      ...(prefs.monthlyBudget !== undefined && {
        monthly_budget: prefs.monthlyBudget,
      }),
      ...(prefs.cookNights !== undefined && { cook_nights: prefs.cookNights }),
      ...(prefs.dineOutNights !== undefined && {
        dine_out_nights: prefs.dineOutNights,
      }),
      ...(prefs.onboarded !== undefined && { onboarded: prefs.onboarded }),
    },
    { onConflict: "user_id" },
  );

  if (error) throw new Error(`upsertPreferences: ${error.message}`);
}

// ── Funds ────────────────────────────────────────────────────────

export async function getActiveFund(supabase: Supabase, userId: string) {
  const { data, error } = await supabase
    .from("funds")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("cashed_out", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`getActiveFund: ${error.message}`);
  return data;
}

export async function getAllFunds(supabase: Supabase, userId: string) {
  const { data, error } = await supabase
    .from("funds")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`getAllFunds: ${error.message}`);
  return data ?? [];
}

export async function createFund(
  supabase: Supabase,
  userId: string,
  name: string,
  targetAmount: number,
) {
  // Deactivate any current active fund first
  await supabase
    .from("funds")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("is_active", true);

  const { data, error } = await supabase
    .from("funds")
    .insert({ user_id: userId, name, target_amount: targetAmount })
    .select()
    .single();

  if (error) throw new Error(`createFund: ${error.message}`);
  return data;
}

export async function updateFund(
  supabase: Supabase,
  fundId: string,
  userId: string,
  updates: { name?: string; target_amount?: number },
) {
  const { data, error } = await supabase
    .from("funds")
    .update(updates)
    .eq("id", fundId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(`updateFund: ${error.message}`);
  return data;
}

export async function cashOutFund(
  supabase: Supabase,
  fundId: string,
  userId: string,
) {
  const { error } = await supabase
    .from("funds")
    .update({
      cashed_out: true,
      cashed_out_at: new Date().toISOString(),
      is_active: false,
    })
    .eq("id", fundId)
    .eq("user_id", userId);

  if (error) throw new Error(`cashOutFund: ${error.message}`);
}

// ── Deposits ─────────────────────────────────────────────────────

export async function getDepositsForFund(
  supabase: Supabase,
  fundId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("deposits")
    .select("*")
    .eq("fund_id", fundId)
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (error) throw new Error(`getDepositsForFund: ${error.message}`);
  return data ?? [];
}

export async function addDeposit(
  supabase: Supabase,
  userId: string,
  fundId: string,
  dish: string,
  amount = 16,
) {
  const { data, error } = await supabase
    .from("deposits")
    .insert({
      user_id: userId,
      fund_id: fundId,
      dish,
      amount,
      date: new Date().toISOString().split("T")[0],
    })
    .select()
    .single();

  if (error) throw new Error(`addDeposit: ${error.message}`);
  return data;
}

// ── Balance Helper ────────────────────────────────────────────────

export function computeBalanceFromDeposits(
  deposits: { amount: number }[],
): number {
  return deposits.reduce((sum, d) => sum + d.amount, 0);
}
