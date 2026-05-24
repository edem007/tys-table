import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPreferences, getActiveFund, getDepositsForFund, computeBalanceFromDeposits } from "@/lib/supabase/queries";
import { readDallasFeed } from "@/lib/dallas-feed-redis";
import { generateWeeklySummary } from "@/lib/weekly-summary";
import {
  dallasWeekStart,
  readWeeklySummary,
  writeWeeklySummary,
  type WeeklySummaryEntry,
} from "@/lib/weekly-summary-redis";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}

/**
 * GET /api/weekly-summary
 * Returns this week's brief from cache, or generates one from the user's
 * bank state and the cached Dallas feed. Pass ?refresh=1 to force regeneration.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const weekOf = dallasWeekStart();
    const force = new URL(request.url).searchParams.get("refresh") === "1";

    if (!force) {
      const cached = await readWeeklySummary();
      if (cached && cached.weekOf === weekOf) {
        return NextResponse.json({ fresh: false, ...cached });
      }
    }

    const [prefs, feed, fund] = await Promise.all([
      getPreferences(supabase, user.id),
      readDallasFeed(),
      getActiveFund(supabase, user.id),
    ]);

    let balance = 0;
    let targetAmount = 120;
    let fundName = "My Goal";

    if (fund) {
      const deposits = await getDepositsForFund(supabase, fund.id, user.id);
      balance = computeBalanceFromDeposits(deposits);
      targetAmount = fund.target_amount;
      fundName = fund.name;
    }

    const summary = await generateWeeklySummary({
      balance,
      targetAmount,
      fundName,
      feed: feed?.items ?? [],
      prefs,
    });

    const entry: WeeklySummaryEntry = {
      weekOf,
      summary,
      generatedAt: new Date().toISOString(),
    };
    await writeWeeklySummary(entry);

    return NextResponse.json({ fresh: true, ...entry });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
