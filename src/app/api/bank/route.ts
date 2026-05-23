import { NextResponse } from "next/server";
import { errorMessage, toApiResponse } from "@/lib/bank-api";
import { readBank } from "@/lib/bank-store";

/** GET /api/bank — full bank snapshot */
export async function GET() {
  try {
    const state = await readBank();
    return NextResponse.json(toApiResponse(state));
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
