import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/supabase/queries";
import { dallasToday } from "@/lib/daily-suggestion-redis";
import { generateDallasFeed } from "@/lib/dallas-feed";
import {
  readDallasFeed,
  writeDallasFeed,
  type DallasFeedEntry,
} from "@/lib/dallas-feed-redis";

export const dynamic = "force-dynamic";
// Web search can take a while; allow up to 60s.
export const maxDuration = 60;

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}

/**
 * GET /api/dallas-feed
 * Returns today's cached "This Week in Dallas" feed. If there is no fresh
 * feed for today, generates one via web search, caches it, and returns it.
 * Pass ?refresh=1 to force regeneration.
 *
 * Note: the feed is cached globally in Redis (shared across all users) since
 * it represents city-wide events. User preferences personalize the tone.
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

    const today = dallasToday();
    const force = new URL(request.url).searchParams.get("refresh") === "1";

    if (!force) {
      const cached = await readDallasFeed();
      if (cached && cached.date === today && cached.items.length > 0) {
        return NextResponse.json({ fresh: false, ...cached });
      }
    }

    const prefs = await getPreferences(supabase, user.id);
    const items = await generateDallasFeed(today, prefs);
    const entry: DallasFeedEntry = {
      date: today,
      items,
      generatedAt: new Date().toISOString(),
    };
    await writeDallasFeed(entry);

    return NextResponse.json({ fresh: true, ...entry });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
