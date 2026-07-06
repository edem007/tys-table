import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWeeklyPlan } from "@/lib/supabase/queries";
import { summarizeWeeklyPlan, type PlanDayRow } from "@/lib/weekly-summary";
import { currentWeekStart } from "@/lib/plan-week";
import { sendWeeklyDigest } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://tystable.app";

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}

/**
 * POST /api/email/weekly-digest
 * Sends each onboarded user their own weekly recap — cook nights completed,
 * $ saved, restaurants chosen. Protected by CRON_SECRET, called Sunday.
 */
export async function POST(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const auth = request.headers.get("authorization");
      if (auth !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const supabase = createAdminClient();
    const weekStart = currentWeekStart();

    const { data: onboardedUsers, error: prefsError } = await supabase
      .from("user_preferences")
      .select("user_id")
      .eq("onboarded", true);

    if (prefsError) throw new Error(prefsError.message);
    if (!onboardedUsers || onboardedUsers.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, message: "No onboarded users" });
    }

    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) throw new Error(authError.message);
    const emailMap = new Map(authUsers.users.map((u) => [u.id, u.email ?? ""]));

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const { user_id } of onboardedUsers) {
      try {
        const email = emailMap.get(user_id);
        if (!email) continue;

        const [profileRes, planResult] = await Promise.all([
          supabase.from("profiles").select("display_name").eq("id", user_id).single(),
          getWeeklyPlan(supabase, user_id, weekStart),
        ]);

        if (!planResult) continue; // no plan generated this week — nothing to summarize

        const userName = profileRes.data?.display_name || "there";
        const summary = summarizeWeeklyPlan(
          planResult.days as unknown as PlanDayRow[],
          planResult.plan.saved_so_far,
        );

        await sendWeeklyDigest({
          userName,
          email,
          headline: summary.headline,
          cookNightsCompleted: summary.cookNightsCompleted,
          cookNightsPlanned: summary.cookNightsPlanned,
          savedThisWeek: summary.savedThisWeek,
          restaurantsChosen: summary.restaurantsChosen,
          appUrl: APP_URL,
        });

        sent++;
      } catch (userErr) {
        failed++;
        errors.push(`${user_id}: ${userErr instanceof Error ? userErr.message : "unknown"}`);
      }
    }

    return NextResponse.json({ ok: true, sent, failed, errors });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
