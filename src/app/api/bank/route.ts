/**
 * Ty's Table — Savings Bank API (local file storage)
 *
 * Persists state in data/bank.json:
 *   - deposits      → Deposit[]
 *   - target_name   → string
 *   - target_amount → number
 */
import { promises as fs } from "node:fs";
import path from "node:path";
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

export type DepositPostResponse = BankGetResponse;

interface BankFile {
  deposits: Deposit[];
  target_name: string;
  target_amount: number;
}

const DATA_DIR = path.join(process.cwd(), "data");
const BANK_FILE = path.join(DATA_DIR, "bank.json");

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

function defaultBank(): BankFile {
  return {
    deposits: [],
    target_name: DEFAULT_TARGET_NAME,
    target_amount: DEFAULT_TARGET_AMOUNT,
  };
}

function normalizeBank(raw: unknown): BankFile {
  if (!raw || typeof raw !== "object") return defaultBank();
  const o = raw as Partial<BankFile>;
  const deposits = Array.isArray(o.deposits) ? o.deposits : [];
  const target_name =
    typeof o.target_name === "string" && o.target_name.trim()
      ? o.target_name
      : DEFAULT_TARGET_NAME;
  const target_amount =
    typeof o.target_amount === "number" && Number.isFinite(o.target_amount)
      ? o.target_amount
      : DEFAULT_TARGET_AMOUNT;
  return { deposits, target_name, target_amount };
}

async function readBank(): Promise<BankFile> {
  try {
    const text = await fs.readFile(BANK_FILE, "utf8");
    return normalizeBank(JSON.parse(text));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return defaultBank();
    throw err;
  }
}

async function writeBank(bank: BankFile): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${BANK_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(bank, null, 2), "utf8");
  await fs.rename(tmp, BANK_FILE);
}

/** GET /api/bank — load full bank snapshot from disk */
export async function GET() {
  try {
    const bank = await readBank();
    const body: BankGetResponse = {
      balance: computeBalance(bank.deposits),
      target_name: bank.target_name,
      target_amount: bank.target_amount,
      deposits: bank.deposits,
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

    const bank = await readBank();
    bank.deposits = [...bank.deposits, deposit];
    await writeBank(bank);

    const response: DepositPostResponse = {
      balance: computeBalance(bank.deposits),
      target_name: bank.target_name,
      target_amount: bank.target_amount,
      deposits: bank.deposits,
    };

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      { error: errorMessage(err) },
      { status: 500 },
    );
  }
}
