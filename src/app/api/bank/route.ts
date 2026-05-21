/**
 * Ty's Table — Savings Bank API (Stage 2)
 *
 * Persists state in Vercel KV:
 *   - deposits      → Deposit[]
 *   - target_name   → string
 *   - target_amount → number
 *
 * Requires KV_REST_API_URL and KV_REST_API_TOKEN (linked KV store on Vercel).
 */
import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

export interface Deposit {
  id: string;
  date: string;
  dish: string;
  amount: number;
}

export interface BankGetResponse {
  balance: number;
  target_name: string;
  target_amount: number;
  deposits: Deposit[];
}

export interface DepositPostBody {
  dish: string;
  amount?: number;
}

export interface DepositPostResponse {
  success: true;
  deposit: Deposit;
}

const KV_KEY_DEPOSITS = "deposits";
const KV_KEY_TARGET_NAME = "target_name";
const KV_KEY_TARGET_AMOUNT = "target_amount";

const DEFAULT_TARGET_NAME = "Stone Water Fund";
const DEFAULT_TARGET_AMOUNT = 120;
const DEFAULT_DEPOSIT_AMOUNT = 16;

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}

function computeBalance(deposits: Deposit[]): number {
  return deposits.reduce((sum, d) => sum + d.amount, 0);
}

/** GET /api/bank — load full bank snapshot from KV */
export async function GET() {
  try {
    const [rawDeposits, rawTargetName, rawTargetAmount] = await Promise.all([
      kv.get<Deposit[]>(KV_KEY_DEPOSITS),
      kv.get<string>(KV_KEY_TARGET_NAME),
      kv.get<number>(KV_KEY_TARGET_AMOUNT),
    ]);

    const deposits = Array.isArray(rawDeposits) ? rawDeposits : [];
    const target_name =
      typeof rawTargetName === "string" && rawTargetName.trim()
        ? rawTargetName
        : DEFAULT_TARGET_NAME;
    const target_amount =
      typeof rawTargetAmount === "number" && Number.isFinite(rawTargetAmount)
        ? rawTargetAmount
        : DEFAULT_TARGET_AMOUNT;

    const body: BankGetResponse = {
      balance: computeBalance(deposits),
      target_name,
      target_amount,
      deposits,
    };

    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json(
      { error: errorMessage(err) },
      { status: 500 },
    );
  }
}

/** POST /api/bank — append a cook-night deposit */
export async function POST(request: Request) {
  try {
    let body: DepositPostBody;
    try {
      body = (await request.json()) as DepositPostBody;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const dish = typeof body.dish === "string" ? body.dish.trim() : "";
    if (!dish) {
      return NextResponse.json(
        { error: "dish is required" },
        { status: 400 },
      );
    }

    const amount =
      typeof body.amount === "number" && Number.isFinite(body.amount)
        ? body.amount
        : DEFAULT_DEPOSIT_AMOUNT;

    const deposit: Deposit = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      dish,
      amount,
    };

    const rawDeposits = await kv.get<Deposit[]>(KV_KEY_DEPOSITS);
    const deposits = Array.isArray(rawDeposits) ? rawDeposits : [];
    const updatedDeposits = [...deposits, deposit];

    await kv.set(KV_KEY_DEPOSITS, updatedDeposits);

    const response: DepositPostResponse = {
      success: true,
      deposit,
    };

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      { error: errorMessage(err) },
      { status: 500 },
    );
  }
}
