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
): Promise<Preferences & { display_name: string; subscription_tier: "free" | "pro" }> {
  const [profileRes, prefsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, subscription_tier")
      .eq("id", userId)
      .single(),
    supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", userId)
      .single(),
  ]);

  const name = profileRes.data?.display_name ?? DEFAULT_PREFERENCES.name;
  const subscription_tier =
    (profileRes.data?.subscription_tier as "free" | "pro" | null) ?? "free";

  if (prefsRes.error || !prefsRes.data) {
    // No preferences row yet — return defaults
    return { ...DEFAULT_PREFERENCES, name, display_name: name, subscription_tier };
  }

  const p = prefsRes.data;
  return {
    name,
    display_name: name,
    subscription_tier,
    cuisines: p.cuisines,
    monthlyBudget: p.monthly_budget,
    cookNights: p.cook_nights,
    dineOutNights: p.dine_out_nights,
    partySize: p.party_size ?? DEFAULT_PREFERENCES.partySize,
    allergies: p.allergies ?? DEFAULT_PREFERENCES.allergies,
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
      ...(prefs.partySize !== undefined && { party_size: prefs.partySize }),
      ...(prefs.allergies !== undefined && { allergies: prefs.allergies }),
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

// ── Weekly Plans (meal planning + restaurant matching) ────────────

export type PlanRecipe = {
  id: string;
  title: string;
  cuisine: string;
  image: string;
  prepMinutes: number;
  cookMinutes: number;
  baseServings: number;
  costPerServing: number;
  ingredients: string[];
  instructions: string[];
};

export type PlanRestaurantOption = {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  priceTier: 1 | 2 | 3 | 4;
  estCostPerPerson: number;
  neighborhood: string;
  image: string;
  blurb: string;
};

export type NewPlanDay = {
  date: string; // YYYY-MM-DD
  dayType: "cook" | "eat-out";
  recipe?: PlanRecipe;
  restaurantOptions?: PlanRestaurantOption[];
};

export async function getWeeklyPlan(
  supabase: Supabase,
  userId: string,
  weekStart: string,
) {
  const { data: plan, error: planError } = await supabase
    .from("weekly_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (planError) throw new Error(`getWeeklyPlan: ${planError.message}`);
  if (!plan) return null;

  const { data: days, error: daysError } = await supabase
    .from("plan_days")
    .select("*")
    .eq("weekly_plan_id", plan.id)
    .order("day_date", { ascending: true });

  if (daysError) throw new Error(`getWeeklyPlan days: ${daysError.message}`);

  return { plan, days: days ?? [] };
}

export async function createWeeklyPlan(
  supabase: Supabase,
  userId: string,
  weekStart: string,
  days: NewPlanDay[],
) {
  const { data: plan, error: planError } = await supabase
    .from("weekly_plans")
    .upsert(
      { user_id: userId, week_start: weekStart, saved_so_far: 0 },
      { onConflict: "user_id,week_start" },
    )
    .select()
    .single();

  if (planError) throw new Error(`createWeeklyPlan: ${planError.message}`);

  // Clear any existing days for this plan (re-generating the week)
  await supabase.from("plan_days").delete().eq("weekly_plan_id", plan.id);

  const { data: insertedDays, error: daysError } = await supabase
    .from("plan_days")
    .insert(
      days.map((d) => ({
        weekly_plan_id: plan.id,
        day_date: d.date,
        day_type: d.dayType,
        recipe: d.recipe ?? null,
        restaurant_options: d.restaurantOptions ?? null,
      })),
    )
    .select();

  if (daysError) throw new Error(`createWeeklyPlan days: ${daysError.message}`);

  return { plan, days: insertedDays ?? [] };
}

/** Marks a cook-night plan day complete and adds the savings to the week's running total. */
export async function markPlanDayCooked(
  supabase: Supabase,
  planDayId: string,
  weeklyPlanId: string,
  userId: string,
  amountSaved: number,
) {
  const { error: dayError } = await supabase
    .from("plan_days")
    .update({ completed: true })
    .eq("id", planDayId)
    .eq("weekly_plan_id", weeklyPlanId);

  if (dayError) throw new Error(`markPlanDayCooked: ${dayError.message}`);

  const { data: plan, error: planReadError } = await supabase
    .from("weekly_plans")
    .select("saved_so_far")
    .eq("id", weeklyPlanId)
    .eq("user_id", userId)
    .single();

  if (planReadError) throw new Error(`markPlanDayCooked: ${planReadError.message}`);

  const { error: planError } = await supabase
    .from("weekly_plans")
    .update({ saved_so_far: (plan?.saved_so_far ?? 0) + amountSaved })
    .eq("id", weeklyPlanId)
    .eq("user_id", userId);

  if (planError) throw new Error(`markPlanDayCooked: ${planError.message}`);
}

/** Records which restaurant the user picked for an eat-out night. */
export async function chooseRestaurantForDay(
  supabase: Supabase,
  planDayId: string,
  weeklyPlanId: string,
  restaurantId: string,
) {
  const { error } = await supabase
    .from("plan_days")
    .update({ chosen_restaurant_id: restaurantId, completed: true })
    .eq("id", planDayId)
    .eq("weekly_plan_id", weeklyPlanId);

  if (error) throw new Error(`chooseRestaurantForDay: ${error.message}`);
}
