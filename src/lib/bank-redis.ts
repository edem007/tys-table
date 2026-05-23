import { Redis } from "@upstash/redis";
import type { BankState, Deposit } from "./bank-types";

const BANK_STATE_KEY = "bank_state";

const DEFAULT_BANK_STATE: BankState = {
  deposits: [],
  fundName: "Stone Water Fund",
  targetAmount: 120,
};

function getRedis(): Redis {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error("KV_REST_API_URL and KV_REST_API_TOKEN must be set");
  }
  return new Redis({ url, token });
}

function normalizeBank(raw: unknown): BankState {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_BANK_STATE };

  const o = raw as Record<string, unknown>;
  const deposits = Array.isArray(o.deposits) ? (o.deposits as Deposit[]) : [];

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

export async function readBankFromRedis(): Promise<BankState> {
  const redis = getRedis();
  const raw = await redis.get<string>(BANK_STATE_KEY);
  if (raw == null) return { ...DEFAULT_BANK_STATE, deposits: [] };
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  return normalizeBank(parsed);
}

export async function writeBankToRedis(state: BankState): Promise<void> {
  const redis = getRedis();
  await redis.set(BANK_STATE_KEY, JSON.stringify(state));
}

export async function withBankRedis(
  mutator: (state: BankState) => void,
): Promise<BankState> {
  const state = await readBankFromRedis();
  mutator(state);
  await writeBankToRedis(state);
  return state;
}
