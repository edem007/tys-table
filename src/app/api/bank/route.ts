/**
 * Ty's Table — Savings Bank API (Supabase Postgres)
 *
 * GET  /api/bank — load the current user's active fund + deposits + balance
 * POST /api/bank — append a cook-night deposit to the active fund
 */
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

const DEFAULT_FUND_NAME = "My First Goal";
const DEFAULT_TARGET_AMOUNT = 120;

function toRouteResponse(
  deposits: { id: string; date: string; dish: string; amount: number }[],
  fundName: string,
  targetAmount: number,
) {
  const balance = computeBalanceFromDeposits(deposits);
  return {
    deposits,
    balance,
    target_name: fundName,
    target_amount: targetAmount,
    // Legacy aliases kept so the existing client keeps working
    fundName,
    targetAmount,
  };
}

/** GET /api/bank — load full bank snapshot */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let fund = await getActiveFund(supabase, user.id);

    // Auto-create a default fund if the user has none yet
    if (!fund) {
      fund = await createFund(
        supabase,
        user.id,
        DEFAULT_FUND_NAME,
        DEFAULT_TARGET_AMOUNT,
      );
    }

    const rawDeposits = await getDepositsForFund(supabase, fund.id, user.id);
    const deposits = rawDeposits.map((d) => ({
      id: d.id,
      date: d.date,
      dish: d.dish,
      amount: d.amount,
    }));

    return NextResponse.json(
      toRouteResponse(deposits, fund.name, fund.target_amount),
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

/** POST /api/bank — append a cook-night deposit */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { dish?: string; amount?: number };
    try {
      body = (await request.json()) as { dish?: string; amount?: number };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const dish = typeof body.dish === "string" ? body.dish.trim() : "";
    if (!dish) {
      return NextResponse.json({ error: "dish is required" }, { status: 400 });
    }

    const amount =
      typeof body.amount === "number" && Number.isFinite(body.amount)
        ? body.amount
        : COOK_NIGHT_DEPOSIT;

    let fund = await getActiveFund(supabase, user.id);
    if (!fund) {
      fund = await createFund(
        supabase,
        user.id,
        DEFAULT_FUND_NAME,
        DEFAULT_TARGET_AMOUNT,
      );
    }

    await addDeposit(supabase, user.id, fund.id, dish, amount);

    const rawDeposits = await getDepositsForFund(supabase, fund.id, user.id);
    const deposits = rawDeposits.map((d) => ({
      id: d.id,
      date: d.date,
      dish: d.dish,
      amount: d.amount,
    }));

    return NextResponse.json(
      toRouteResponse(deposits, fund.name, fund.target_amount),
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
