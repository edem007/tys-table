import { promises as fs } from "node:fs";
import path from "node:path";
import type { BankState } from "./bank-types";

const DATA_DIR = path.join(process.cwd(), "data");
const BANK_FILE = path.join(DATA_DIR, "bank.json");

const DEFAULT_BANK_STATE: BankState = {
  deposits: [],
  fundName: "Stone Water Fund",
  targetAmount: 120,
};

function normalizeBank(raw: unknown): BankState {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_BANK_STATE };

  const o = raw as Record<string, unknown>;
  const deposits = Array.isArray(o.deposits) ? o.deposits : [];

  const fundNameRaw =
    typeof o.fundName === "string"
      ? o.fundName
      : typeof o.target_name === "string"
        ? o.target_name
        : DEFAULT_BANK_STATE.fundName;

  const targetAmountRaw =
    typeof o.targetAmount === "number" && Number.isFinite(o.targetAmount)
      ? o.targetAmount
      : typeof o.target_amount === "number" && Number.isFinite(o.target_amount)
        ? o.target_amount
        : DEFAULT_BANK_STATE.targetAmount;

  return {
    deposits,
    fundName: fundNameRaw.trim() || DEFAULT_BANK_STATE.fundName,
    targetAmount: targetAmountRaw,
  };
}

/** Load bank state from disk, or defaults if the file is missing. */
export async function readBank(): Promise<BankState> {
  try {
    const text = await fs.readFile(BANK_FILE, "utf8");
    return normalizeBank(JSON.parse(text));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { ...DEFAULT_BANK_STATE, deposits: [] };
    throw err;
  }
}

/** Persist bank state to data/bank.json (creates data/ if needed). */
export async function writeBank(state: BankState): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${BANK_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
  await fs.rename(tmp, BANK_FILE);
}

/** Read, apply a synchronous mutator, and write back atomically. */
export async function withBank(
  mutator: (state: BankState) => void,
): Promise<BankState> {
  const state = await readBank();
  mutator(state);
  await writeBank(state);
  return state;
}
