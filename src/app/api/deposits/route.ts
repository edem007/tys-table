import { NextResponse } from "next/server";
import {
  COOK_NIGHT_DEPOSIT,
  errorMessage,
  toApiResponse,
} from "@/lib/bank-api";
import { withBank } from "@/lib/bank-store";

/** POST /api/deposits — append a cook-night deposit */
export async function POST(request: Request) {
  try {
    let body: { dish?: string };
    try {
      body = (await request.json()) as { dish?: string };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const dish = typeof body.dish === "string" ? body.dish.trim() : "";
    if (!dish) {
      return NextResponse.json({ error: "dish is required" }, { status: 400 });
    }

    const state = await withBank((bank) => {
      bank.deposits.push({
        id: crypto.randomUUID(),
        date: new Date().toISOString().slice(0, 10),
        dish,
        amount: COOK_NIGHT_DEPOSIT,
      });
    });

    return NextResponse.json(toApiResponse(state));
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
