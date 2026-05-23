import { NextResponse } from "next/server";
import { normalizePreferences } from "@/lib/preferences";
import { readPreferences, writePreferences } from "@/lib/preferences-redis";

export const dynamic = "force-dynamic";

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}

/** GET /api/preferences — current preferences (defaults if unset). */
export async function GET() {
  try {
    const prefs = await readPreferences();
    return NextResponse.json(prefs);
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
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const current = await readPreferences();
    const merged = normalizePreferences({ ...current, ...body });
    await writePreferences(merged);
    return NextResponse.json(merged);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
