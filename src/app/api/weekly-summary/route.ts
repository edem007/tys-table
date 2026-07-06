import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWeeklyPlan } from "@/lib/supabase/queries";
import { summarizeWeeklyPlan, type PlanDayRow } from "@/lib/weekly-summary";
import { currentWeekStart } from "@/lib/plan-week";

export const dynamic = "force-dynamic";

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}

/**
 * GET /api/weekly-summary
 * Deterministic recap of the current week's plan — no LLM call, just reads
 * plan_days for the authenticated user's active weekly_plan.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const weekStart = currentWeekStart();
    const result = await getWeeklyPlan(supabase, user.id, weekStart);

    if (!result) {
      return NextResponse.json({ summary: null, weekStart });
    }

    const summary = summarizeWeeklyPlan(result.days as unknown as PlanDayRow[], result.plan.saved_so_far);
    return NextResponse.json({ summary, weekStart });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
