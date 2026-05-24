import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/supabase/queries";
import { generateSuggestion, normalizeSuggestInput } from "@/lib/suggest";

export type { SuggestionResponse } from "@/lib/suggest";

export const dynamic = "force-dynamic";

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}

/** POST /api/suggest — tonight's recommendation via Claude */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const prefs = await getPreferences(supabase, user.id);
    const input = normalizeSuggestInput(body, prefs);
    const suggestion = await generateSuggestion(input);
    return NextResponse.json(suggestion);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
