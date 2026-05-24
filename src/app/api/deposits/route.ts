import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveFund,
  getDepositsForFund,
  addDeposit,
  createFund,
  computeBalanceFromDeposits,
} from "@/lib/supabase/queries";
import { COOK_NIGHT_DEPOSIT, errorMessage } from "@/lib/bank-api";

export const dynamic = "force-dynamic";

/** POST /api/deposits — append a cook-night deposit */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    let fund = await getActiveFund(supabase, user.id);
    if (!fund) {
      fund = await createFund(supabase, user.id, "My First Goal", 120);
    }

    await addDeposit(supabase, user.id, fund.id, dish, COOK_NIGHT_DEPOSIT);

    const rawDeposits = await getDepositsForFund(supabase, fund.id, user.id);
    const deposits = rawDeposits.map((d) => ({
      id: d.id,
      date: d.date,
      dish: d.dish,
      amount: d.amount,
    }));
    const balance = computeBalanceFromDeposits(deposits);

    return NextResponse.json({
      deposits,
      balance,
      target_name: fund.name,
      target_amount: fund.target_amount,
      fundName: fund.name,
      targetAmount: fund.target_amount,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
