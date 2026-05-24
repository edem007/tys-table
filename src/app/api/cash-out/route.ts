import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveFund,
  getDepositsForFund,
  cashOutFund,
  createFund,
  computeBalanceFromDeposits,
} from "@/lib/supabase/queries";
import { errorMessage } from "@/lib/bank-api";

export const dynamic = "force-dynamic";

/**
 * POST /api/cash-out — mark the active fund as cashed out and start fresh.
 * The old fund is locked (cashed_out = true). A new default fund is NOT
 * auto-created here — the client will prompt the user to name their next goal.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fund = await getActiveFund(supabase, user.id);
    if (!fund) {
      return NextResponse.json(
        { error: "No active fund to cash out" },
        { status: 400 },
      );
    }

    const deposits = await getDepositsForFund(supabase, fund.id, user.id);
    const balance = computeBalanceFromDeposits(deposits);
    if (balance <= 0) {
      return NextResponse.json(
        { error: "Nothing to cash out" },
        { status: 400 },
      );
    }

    // Mark fund as cashed out
    await cashOutFund(supabase, fund.id, user.id);

    // Create a fresh placeholder fund so the dashboard doesn't error
    const newFund = await createFund(supabase, user.id, "My Next Goal", 120);

    return NextResponse.json({
      deposits: [],
      balance: 0,
      target_name: newFund.name,
      target_amount: newFund.target_amount,
      fundName: newFund.name,
      targetAmount: newFund.target_amount,
      cashedOut: true,
      cashedOutAmount: balance,
    });
  } catch (err) {
    const message = errorMessage(err);
    if (message === "Nothing to cash out") {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
