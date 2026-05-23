import type { BankState, Deposit } from "./bank-types";

export const COOK_NIGHT_DEPOSIT = 16;
export const MIN_TARGET_AMOUNT = 20;
export const MAX_TARGET_AMOUNT = 2000;

export type BankApiResponse = {
  deposits: Deposit[];
  balance: number;
  fundName: string;
  targetAmount: number;
};

export function computeBalance(deposits: Deposit[]): number {
  return deposits.reduce((sum, d) => sum + d.amount, 0);
}

export function toApiResponse(state: BankState): BankApiResponse {
  return {
    deposits: state.deposits,
    balance: computeBalance(state.deposits),
    fundName: state.fundName,
    targetAmount: state.targetAmount,
  };
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}
