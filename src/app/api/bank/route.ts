/**
 * Ty's Table — Savings Bank API (Upstash Redis)
 *
 * Stores full BankState JSON under Redis key "bank_state".
 * Env: KV_REST_API_URL, KV_REST_API_TOKEN
 */
import { NextResponse } from "next/server";
import { COOK_NIGHT_DEPOSIT, computeBalance, errorMessage } from "@/lib/bank-api";
import type { Deposit } from "@/lib/bank-types";
import {
  readBankFromRedis,
  withBankRedis,
} from "@/lib/bank-redis";

export type BankRouteResponse = {
  deposits: Deposit[];
  balance: number;
  target_name: string;
  target_amount: number;
  /** @deprecated Use target_name — kept so existing clients keep working */
  fundName: string;
  /** @deprecated Use target_amount — kept so existing clients keep working */
  targetAmount: number;
};

function toRouteResponse(state: {
  deposits: Deposit[];
  fundName: string;
  targetAmount: number;
}): BankRouteResponse {
  const balance = computeBalance(state.deposits);
  return {
    deposits: state.deposits,
    balance,
    target_name: state.fundName,
    target_amount: state.targetAmount,
    fundName: state.fundName,
    targetAmount: state.targetAmount,
  };
}

/** GET /api/bank — load full bank snapshot from Redis */
export async function GET() {
  try {
    const state = await readBankFromRedis();
    return NextResponse.json(toRouteResponse(state));
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

/** POST /api/bank — append a cook-night deposit */
export async function POST(request: Request) {
  try {
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

    const state = await withBankRedis((bank) => {
      bank.deposits.push({
        id: crypto.randomUUID(),
        date: new Date().toISOString().slice(0, 10),
        dish,
        amount,
      });
    });

    return NextResponse.json(toRouteResponse(state));
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
