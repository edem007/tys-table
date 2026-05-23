import { NextResponse } from "next/server";
import { computeBalance } from "@/lib/bank-api";
import { readBankFromRedis } from "@/lib/bank-redis";
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
 * Returns this week's brief from cache, or generates one from the bank state
 * and the cached Dallas feed. Pass ?refresh=1 to force regeneration.
 */
export async function GET(request: Request) {
  try {
    const weekOf = dallasWeekStart();
    const force = new URL(request.url).searchParams.get("refresh") === "1";

    if (!force) {
      const cached = await readWeeklySummary();
      if (cached && cached.weekOf === weekOf) {
        return NextResponse.json({ fresh: false, ...cached });
      }
    }

    const [state, feed] = await Promise.all([
      readBankFromRedis(),
      readDallasFeed(),
    ]);

    const summary = await generateWeeklySummary({
      balance: computeBalance(state.deposits),
      targetAmount: state.targetAmount,
      fundName: state.fundName,
      feed: feed?.items ?? [],
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
