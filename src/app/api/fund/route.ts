import { NextResponse } from "next/server";
import {
  errorMessage,
  MAX_TARGET_AMOUNT,
  MIN_TARGET_AMOUNT,
  toApiResponse,
} from "@/lib/bank-api";
import { withBankRedis as withBank } from "@/lib/bank-redis";

/** PATCH /api/fund — update fund name and/or target amount */
export async function PATCH(request: Request) {
  try {
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

    const state = await withBank((bank) => {
      if (hasFundName && typeof body.fundName === "string") {
        bank.fundName = body.fundName.trim().slice(0, 40);
      }
      if (hasTargetAmount && typeof body.targetAmount === "number") {
        bank.targetAmount = body.targetAmount;
      }
    });

    return NextResponse.json(toApiResponse(state));
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
