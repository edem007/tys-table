export type Deposit = {
  id: string;
  date: string;
  dish: string;
  amount: number;
};

export type BankState = {
  deposits: Deposit[];
  fundName: string;
  targetAmount: number;
};
