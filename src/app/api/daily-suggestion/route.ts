import { NextResponse } from "next/server";
import { dallasToday, readDailySuggestion } from "@/lib/daily-suggestion-redis";

export const dynamic = "force-dynamic";

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}

/**
 * GET /api/daily-suggestion
 * Returns today's stored daily suggestion (Dallas time), or null if there
 * isn't one for today yet.
 */
export async function GET() {
  try {
    const entry = await readDailySuggestion();
    const isToday = entry != null && entry.date === dallasToday();

    return NextResponse.json({
      isToday,
      daily: isToday ? entry : null,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
