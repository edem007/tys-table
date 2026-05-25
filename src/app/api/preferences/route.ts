import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPreferences, upsertPreferences } from "@/lib/supabase/queries";
import { normalizePreferences, computeCookNightDeposit } from "@/lib/preferences";

export const dynamic = "force-dynamic";

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}

/** GET /api/preferences — current user's preferences (defaults if unset). */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const prefs = await getPreferences(supabase, user.id);
    const depositAmount = computeCookNightDeposit(prefs);
    return NextResponse.json({ ...prefs, depositAmount });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

/**
 * PATCH /api/preferences — merge updates into stored preferences.
 * Used by the onboarding wizard (sends the full set + onboarded: true).
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Get current, merge, normalize, write
    const current = await getPreferences(supabase, user.id);
    const merged = normalizePreferences({ ...current, ...body });

    await upsertPreferences(supabase, user.id, {
      name: merged.name,
      cuisines: merged.cuisines,
      monthlyBudget: merged.monthlyBudget,
      cookNights: merged.cookNights,
      dineOutNights: merged.dineOutNights,
      onboarded: merged.onboarded,
    });

    return NextResponse.json(merged);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
