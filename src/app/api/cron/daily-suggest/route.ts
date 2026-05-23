import { NextResponse } from "next/server";
import { computeBalance } from "@/lib/bank-api";
import { readBankFromRedis } from "@/lib/bank-redis";
import {
  dallasToday,
  writeDailySuggestion,
  type DailySuggestion,
} from "@/lib/daily-suggestion-redis";
import { generateSuggestion } from "@/lib/suggest";

// Always run fresh; never cache the cron response.
export const dynamic = "force-dynamic";

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}

/**
 * GET /api/cron/daily-suggest
 * Triggered by Vercel Cron daily. Generates tonight's suggestion from the
 * current bank state and stores it in Redis under "daily_suggestion".
 *
 * SCHEDULE / DAYLIGHT-SAVING NOTE (see vercel.json):
 *   The cron schedule "0 23 * * *" is in UTC and does NOT shift with US DST.
 *     - Daylight saving (CDT, ~Mar–Nov): 23:00 UTC = 6:00 PM Dallas time. ✅
 *     - Standard time (CST, ~Nov–Mar):   23:00 UTC = 5:00 PM Dallas time.
 *   So in winter the daily pick lands an hour early. To keep it at 6 PM CST,
 *   change the schedule to "0 0 * * *" (00:00 UTC) during standard time.
 */
export async function GET(request: Request) {
  try {
    // If CRON_SECRET is configured, require Vercel's bearer token.
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const auth = request.headers.get("authorization");
      if (auth !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const state = await readBankFromRedis();
    const balance = computeBalance(state.deposits);

    const suggestion = await generateSuggestion({
      balance,
      targetAmount: state.targetAmount,
      fundName: state.fundName,
    });

    const entry: DailySuggestion = {
      date: dallasToday(),
      suggestion,
      generatedAt: new Date().toISOString(),
    };

    await writeDailySuggestion(entry);

    return NextResponse.json({ ok: true, ...entry });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
