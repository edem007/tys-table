import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readDallasFeed } from "@/lib/dallas-feed-redis";
import { readWeeklySummary } from "@/lib/weekly-summary-redis";
import { sendWeeklyDigest } from "@/lib/email";
import { computeBalanceFromDeposits } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://prince-ai-projects-murex.vercel.app";

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}

// Returns deposits from the last 7 days
function depositsThisWeek(deposits: { date: string; amount: number }[]) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return deposits.filter((d) => d.date >= cutoffStr && d.amount > 0);
}

/**
 * POST /api/email/weekly-digest
 * Sends the weekly digest to all onboarded users.
 * Protected by CRON_SECRET — called by the Sunday cron job.
 */
export async function POST(request: Request) {
  try {
    // Require CRON_SECRET
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const auth = request.headers.get("authorization");
      if (auth !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const supabase = createAdminClient();

    // Get all onboarded users with their email addresses
    const { data: onboardedUsers, error: prefsError } = await supabase
      .from("user_preferences")
      .select("user_id")
      .eq("onboarded", true);

    if (prefsError) throw new Error(prefsError.message);
    if (!onboardedUsers || onboardedUsers.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, message: "No onboarded users" });
    }

    // Get auth emails via admin API
    const { data: authUsers, error: authError } =
      await supabase.auth.admin.listUsers();
    if (authError) throw new Error(authError.message);

    const emailMap = new Map(
      authUsers.users.map((u) => [u.id, u.email ?? ""]),
    );

    // Get shared weekly summary + Dallas feed (same for all users)
    const [weeklySummaryEntry, feedEntry] = await Promise.all([
      readWeeklySummary(),
      readDallasFeed(),
    ]);

    const weeklySummaryText = weeklySummaryEntry?.summary?.headline ?? "";
    const dallasFeedItems = (feedEntry?.items ?? []).map((item) => ({
      title: item.name,
      date: item.date,
      description: item.description,
    }));

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const { user_id } of onboardedUsers) {
      try {
        const email = emailMap.get(user_id);
        if (!email) continue;

        // Get profile + active fund + deposits
        const [profileRes, fundRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("display_name")
            .eq("id", user_id)
            .single(),
          supabase
            .from("funds")
            .select("id, name, target_amount")
            .eq("user_id", user_id)
            .eq("is_active", true)
            .eq("cashed_out", false)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        const userName = profileRes.data?.display_name || "there";
        const fund = fundRes.data;
        if (!fund) continue;

        const { data: deposits } = await supabase
          .from("deposits")
          .select("date, amount")
          .eq("fund_id", fund.id)
          .eq("user_id", user_id)
          .order("date", { ascending: false });

        const allDeposits = deposits ?? [];
        const balance = computeBalanceFromDeposits(allDeposits);
        const weekDeposits = depositsThisWeek(allDeposits);
        const savedThisWeek = weekDeposits.reduce((s, d) => s + d.amount, 0);
        const depositCount = weekDeposits.length;

        await sendWeeklyDigest({
          userName,
          email,
          fundName: fund.name,
          balance,
          targetAmount: fund.target_amount,
          depositCount,
          savedThisWeek,
          weeklySummaryText,
          dallasFeedItems,
          appUrl: APP_URL,
        });

        sent++;
      } catch (userErr) {
        failed++;
        errors.push(
          `${user_id}: ${userErr instanceof Error ? userErr.message : "unknown"}`,
        );
      }
    }

    return NextResponse.json({ ok: true, sent, failed, errors });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
