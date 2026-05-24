import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveFund,
  updateFund,
  createFund,
  getDepositsForFund,
  computeBalanceFromDeposits,
} from "@/lib/supabase/queries";
import {
  errorMessage,
  MAX_TARGET_AMOUNT,
  MIN_TARGET_AMOUNT,
} from "@/lib/bank-api";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/fund — update fund name and/or target amount.
 * Also used by the onboarding wizard to create the first savings goal.
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { fundName?: string; targetAmount?: number };
    try {
      body = (await request.json()) as { fundName?: string; targetAmount?: number };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const hasFundName = body.fundName !== undefined;
    const hasTargetAmount = body.targetAmount !== undefined;
    if (!hasFundName && !hasTargetAmount) {
      return NextResponse.json(
        { error: "fundName or targetAmount is required" },
        { status: 400 },
      );
    }

    if (hasFundName) {
      const trimmed =
        typeof body.fundName === "string" ? body.fundName.trim() : "";
      if (!trimmed || trimmed.length > 40) {
        return NextResponse.json(
          { error: "fundName must be 1–40 characters" },
          { status: 400 },
        );
      }
    }

    if (hasTargetAmount) {
      const n = body.targetAmount;
      if (
        typeof n !== "number" ||
        !Number.isFinite(n) ||
        n < MIN_TARGET_AMOUNT ||
        n > MAX_TARGET_AMOUNT
      ) {
        return NextResponse.json(
          {
            error: `targetAmount must be between ${MIN_TARGET_AMOUNT} and ${MAX_TARGET_AMOUNT}`,
          },
          { status: 400 },
        );
      }
    }

    let fund = await getActiveFund(supabase, user.id);

    if (!fund) {
      // Onboarding path: create the first fund
      const name =
        typeof body.fundName === "string"
          ? body.fundName.trim()
          : "My First Goal";
      const target =
        typeof body.targetAmount === "number" ? body.targetAmount : 120;
      fund = await createFund(supabase, user.id, name, target);
    } else {
      // Update the existing active fund
      const updates: { name?: string; target_amount?: number } = {};
      if (hasFundName && typeof body.fundName === "string") {
        updates.name = body.fundName.trim().slice(0, 40);
      }
      if (hasTargetAmount && typeof body.targetAmount === "number") {
        updates.target_amount = body.targetAmount;
      }
      fund = await updateFund(supabase, fund.id, user.id, updates);
    }

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
