import { NextResponse } from "next/server";
import { generateSuggestion, normalizeSuggestInput } from "@/lib/suggest";
import { readPreferences } from "@/lib/preferences-redis";

export type { SuggestionResponse } from "@/lib/suggest";

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}

/** POST /api/suggest — Ty's tonight recommendation via Claude */
export async function POST(request: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const prefs = await readPreferences();
    const input = normalizeSuggestInput(body, prefs);
    const suggestion = await generateSuggestion(input);
    return NextResponse.json(suggestion);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
