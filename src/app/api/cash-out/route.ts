import { NextResponse } from "next/server";
import { computeBalance, errorMessage, toApiResponse } from "@/lib/bank-api";
import { withBankRedis as withBank } from "@/lib/bank-redis";

/** POST /api/cash-out — zero balance with a cash-out ledger row */
export async function POST() {
  try {
    const state = await withBank((bank) => {
      const balance = computeBalance(bank.deposits);
      if (balance <= 0) {
        throw new Error("Nothing to cash out");
      }
      bank.deposits.push({
        id: crypto.randomUUID(),
        date: new Date().toISOString().slice(0, 10),
        dish: "Cash out",
        amount: -balance,
      });
    });

    return NextResponse.json(toApiResponse(state));
  } catch (err) {
    const message = errorMessage(err);
    if (message === "Nothing to cash out") {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
