import { NextResponse } from "next/server";
import {
  dallasToday,
  writeDailySuggestion,
  type DailySuggestion,
} from "@/lib/daily-suggestion-redis";
import { generateSuggestion } from "@/lib/suggest";
import { generateDallasFeed } from "@/lib/dallas-feed";
import {
  readDallasFeed,
  writeDallasFeed,
  type DallasFeedEntry,
} from "@/lib/dallas-feed-redis";
import { generateWeeklySummary } from "@/lib/weekly-summary";
import {
  dallasWeekStart,
  writeWeeklySummary,
  type WeeklySummaryEntry,
} from "@/lib/weekly-summary-redis";
import { DEFAULT_PREFERENCES } from "@/lib/preferences";

// Always run fresh; never cache the cron response.
export const dynamic = "force-dynamic";
// Multiple AI calls — allow extra time.
export const maxDuration = 60;

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://prince-ai-projects-murex.vercel.app";

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}

/**
 * GET /api/cron/daily-suggest
 * Triggered by Vercel Cron daily at 23:00 UTC (6 PM CDT / 5 PM CST).
 *
 * 1. Generates a global daily suggestion using default preferences
 * 2. Pre-warms the Dallas feed via web search
 * 3. On Sundays: generates the weekly brief + sends digest emails to all users
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

    const today = dallasToday();

    // Use default preferences for the global daily suggestion.
    // (Per-user suggestions are a Pro tier feature on the roadmap.)
    const prefs = DEFAULT_PREFERENCES;

    // Generate today's suggestion with a placeholder balance
    const suggestion = await generateSuggestion({
      balance: 64,
      targetAmount: 120,
      fundName: "tonight",
      prefs,
    });

    const entry: DailySuggestion = {
      date: today,
      suggestion,
      generatedAt: new Date().toISOString(),
    };
    await writeDailySuggestion(entry);

    // Pre-warm the Dallas feed
    let feedCount = 0;
    try {
      const items = await generateDallasFeed(today, prefs);
      const feed: DallasFeedEntry = {
        date: today,
        items,
        generatedAt: new Date().toISOString(),
      };
      await writeDallasFeed(feed);
      feedCount = items.length;
    } catch (feedErr) {
      console.error("Dallas feed refresh failed:", feedErr);
    }

    // On Sundays: generate weekly brief + send digest emails
    let weeklyGenerated = false;
    let emailResult: Record<string, unknown> = {};

    if (today === dallasWeekStart()) {
      // Generate weekly summary
      try {
        const feedEntry = await readDallasFeed();
        const summary = await generateWeeklySummary({
          balance: 64,
          targetAmount: 120,
          fundName: "your goal",
          feed: feedEntry?.items ?? [],
          prefs,
        });
        const weekly: WeeklySummaryEntry = {
          weekOf: today,
          summary,
          generatedAt: new Date().toISOString(),
        };
        await writeWeeklySummary(weekly);
        weeklyGenerated = true;
      } catch (weeklyErr) {
        console.error("Weekly summary generation failed:", weeklyErr);
      }

      // Send weekly digest emails to all users
      try {
        const emailRes = await fetch(
          `${APP_URL}/api/email/weekly-digest`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(cronSecret ? { authorization: `Bearer ${cronSecret}` } : {}),
            },
          },
        );
        emailResult = (await emailRes.json()) as Record<string, unknown>;
      } catch (emailErr) {
        console.error("Weekly digest email failed:", emailErr);
      }
    }

    return NextResponse.json({
      ok: true,
      feedCount,
      weeklyGenerated,
      emailResult,
      ...entry,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
