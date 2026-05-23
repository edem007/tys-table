"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_FUND_NAME = "Stone Water Fund";
const DEFAULT_TARGET_AMOUNT = 120;
const MIN_TARGET_AMOUNT = 20;
const MAX_TARGET_AMOUNT = 2000;

const EDITORIAL_FIELD_CLASS =
  "min-w-0 border-0 border-b border-[#D9CDB0] bg-transparent px-0 outline-none ring-0 transition-colors focus:border-b-[#7A2A1E] focus:ring-0";

const FUND_NAME_PRESETS = [
  { label: "Stone Water Sunday", amount: 120 },
  { label: "Date Night Out", amount: 90 },
  { label: "Bishop Arts Dinner", amount: 80 },
  { label: "Concert Night", amount: 150 },
] as const;

type Deposit = {
  id: string;
  date: string;
  dish: string;
  amount: number;
};

type BankGetResponse = {
  deposits: Deposit[];
  balance: number;
  fundName: string;
  targetAmount: number;
};

type ApiErrorResponse = {
  error: string;
};

function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMonthDay(isoDate: string) {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatPlusUsd(amount: number) {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
  return `+${formatted}`;
}

export default function Home() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [balance, setBalance] = useState(0);
  const [fundName, setFundName] = useState(DEFAULT_FUND_NAME);
  const [targetAmount, setTargetAmount] = useState(DEFAULT_TARGET_AMOUNT);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmittingDeposit, setIsSubmittingDeposit] = useState(false);
  const [isMutatingBank, setIsMutatingBank] = useState(false);
  const [editingFundName, setEditingFundName] = useState(false);
  const [fundNameDraft, setFundNameDraft] = useState("");
  const [editingTargetAmount, setEditingTargetAmount] = useState(false);
  const [targetAmountDraft, setTargetAmountDraft] = useState("");
  const [cookModalOpen, setCookModalOpen] = useState(false);
  const [dishInput, setDishInput] = useState("");
  const [depositListExpanded, setDepositListExpanded] = useState(false);
  const dishFieldRef = useRef<HTMLInputElement>(null);
  const fundNameInputRef = useRef<HTMLInputElement>(null);
  const targetAmountInputRef = useRef<HTMLInputElement>(null);

  function applyBankResponse(data: BankGetResponse) {
    setDeposits(data.deposits);
    setBalance(data.balance);
    setFundName(data.fundName);
    setTargetAmount(data.targetAmount);
    setErrorMessage(null);
  }

  async function patchFund(body: {
    fundName?: string;
    targetAmount?: number;
  }): Promise<BankGetResponse> {
    const res = await fetch("/api/fund", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as ApiErrorResponse;
      throw new Error(errBody.error ?? `Failed to update fund (${res.status})`);
    }
    const data = (await res.json()) as BankGetResponse;
    applyBankResponse(data);
    return data;
  }

  async function fetchBank(): Promise<BankGetResponse> {
    const res = await fetch("/api/bank");
    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as ApiErrorResponse;
      throw new Error(errBody.error ?? `Failed to load bank (${res.status})`);
    }
    const data = (await res.json()) as BankGetResponse;
    applyBankResponse(data);
    return data;
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/bank");
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as ApiErrorResponse;
          throw new Error(errBody.error ?? `Failed to load bank (${res.status})`);
        }
        const data = (await res.json()) as BankGetResponse;
        if (cancelled) return;
        applyBankResponse(data);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setErrorMessage(
            err instanceof Error ? err.message : "Failed to load bank",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const progressPercent =
    targetAmount <= 0 ? 0 : Math.min((balance / targetAmount) * 100, 100);
  const targetMet = balance >= targetAmount;

  async function commitFundName() {
    const trimmed = fundNameDraft.trim().slice(0, 40);
    setEditingFundName(false);
    if (!trimmed || trimmed === fundName) return;

    setIsMutatingBank(true);
    setErrorMessage(null);
    try {
      await patchFund({ fundName: trimmed });
    } catch (err) {
      console.error(err);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to update fund name",
      );
    } finally {
      setIsMutatingBank(false);
    }
  }

  async function commitTargetAmount() {
    const digits = targetAmountDraft.replace(/\D/g, "");
    const n = parseInt(digits, 10);
    setEditingTargetAmount(false);
    if (
      !Number.isFinite(n) ||
      n < MIN_TARGET_AMOUNT ||
      n > MAX_TARGET_AMOUNT ||
      n === targetAmount
    ) {
      return;
    }

    setIsMutatingBank(true);
    setErrorMessage(null);
    try {
      await patchFund({ targetAmount: n });
    } catch (err) {
      console.error(err);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to update target amount",
      );
    } finally {
      setIsMutatingBank(false);
    }
  }

  function beginEditFundName() {
    if (editingTargetAmount) void commitTargetAmount();
    setFundNameDraft(fundName);
    setEditingFundName(true);
    setEditingTargetAmount(false);
  }

  function beginEditTargetAmount() {
    if (editingFundName) void commitFundName();
    setTargetAmountDraft(String(targetAmount));
    setEditingTargetAmount(true);
    setEditingFundName(false);
  }

  async function applyFundPreset(label: string, amount: number) {
    setEditingFundName(false);
    setEditingTargetAmount(false);

    setIsMutatingBank(true);
    setErrorMessage(null);
    try {
      await patchFund({
        fundName: label.slice(0, 40),
        targetAmount: amount,
      });
    } catch (err) {
      console.error(err);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to apply preset",
      );
    } finally {
      setIsMutatingBank(false);
    }
  }

  const cookNightDeposits = deposits
    .map((d, index) => ({ d, index }))
    .filter(({ d }) => d.amount > 0)
    .sort((a, b) => {
      if (a.d.date !== b.d.date) return a.d.date < b.d.date ? 1 : -1;
      return b.index - a.index;
    })
    .map(({ d }) => d);

  const visibleCookNights = depositListExpanded
    ? cookNightDeposits
    : cookNightDeposits.slice(0, 7);
  const hasMoreCookNights = cookNightDeposits.length > 7;

  useEffect(() => {
    if (!cookModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCookModalOpen(false);
        setDishInput("");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cookModalOpen]);

  useEffect(() => {
    if (cookModalOpen) {
      dishFieldRef.current?.focus();
    }
  }, [cookModalOpen]);

  useEffect(() => {
    if (editingFundName) fundNameInputRef.current?.focus();
  }, [editingFundName]);

  useEffect(() => {
    if (editingTargetAmount) targetAmountInputRef.current?.focus();
  }, [editingTargetAmount]);

  function openCookModal() {
    setDishInput("");
    setCookModalOpen(true);
  }

  function closeCookModal() {
    setCookModalOpen(false);
    setDishInput("");
  }

  async function handleDeposit() {
    const dish = dishInput.trim();
    if (!dish || isSubmittingDeposit) return;

    setIsSubmittingDeposit(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dish }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as ApiErrorResponse;
        throw new Error(
          errBody.error ?? `Failed to save deposit (${res.status})`,
        );
      }
      const data = (await res.json()) as BankGetResponse;
      applyBankResponse(data);
      closeCookModal();
    } catch (err) {
      console.error(err);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to save deposit",
      );
    } finally {
      setIsSubmittingDeposit(false);
    }
  }

  async function cashOut() {
    if (isMutatingBank || balance <= 0) return;

    setIsMutatingBank(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/cash-out", { method: "POST" });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as ApiErrorResponse;
        throw new Error(
          errBody.error ?? `Failed to cash out (${res.status})`,
        );
      }
      const data = (await res.json()) as BankGetResponse;
      applyBankResponse(data);
    } catch (err) {
      console.error(err);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to cash out",
      );
    } finally {
      setIsMutatingBank(false);
    }
  }

  return (
    <div className="min-h-full min-h-[100dvh] bg-[#F2EAD8] text-[#0F1310]">
      <main
        className={`mx-auto w-full max-w-lg px-4 pt-8 pb-8 min-[600px]:px-8 min-[600px]:pt-14 min-[600px]:pb-12 ${
          !targetMet
            ? "max-[599px]:pb-[calc(5.75rem+env(safe-area-inset-bottom))]"
            : ""
        }`}
      >
        <header className="mb-12 text-center min-[600px]:mb-16">
          <p className="font-serif text-[2rem] font-medium italic leading-tight tracking-tight text-[#0F1310] min-[600px]:text-5xl min-[600px]:leading-none">
            Ty&apos;s Table
          </p>
          <p className="mt-3 font-mono text-[11px] font-normal uppercase tracking-[0.22em] text-[#0F1310]/70">
            Est. 2026 · Dallas
          </p>
        </header>

        {errorMessage ? (
          <p
            role="alert"
            className="mb-4 text-center font-sans text-sm text-[#7A2A1E]"
          >
            {errorMessage}
          </p>
        ) : null}

        <section className="flex w-full flex-col items-stretch text-center min-[600px]:items-center">
          <p
            className="font-serif flex w-full flex-wrap items-baseline justify-center gap-x-1.5 gap-y-1 leading-none min-[600px]:gap-x-2"
            aria-live="polite"
          >
            <span className="text-[64px] font-normal tracking-[-0.03em] text-[#7A2A1E] min-[600px]:text-[96px]">
              {isLoading ? "Loading..." : formatUsd(balance)}
            </span>
            <span
              className="translate-y-[-0.06em] px-0.5 font-normal text-[15px] text-[#0F1310]/30 min-[600px]:translate-y-[-0.08em] min-[600px]:text-[22px]"
              aria-hidden="true"
            >
              /
            </span>
            {editingTargetAmount ? (
              <input
                ref={targetAmountInputRef}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                aria-label="Savings target amount"
                value={targetAmountDraft}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setTargetAmountDraft(digits);
                }}
                onBlur={() => {
                  void commitTargetAmount();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void commitTargetAmount();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setEditingTargetAmount(false);
                  }
                }}
                className={`inline-block w-[5.5ch] max-w-full text-center font-serif text-[22px] font-normal italic tabular-nums text-[#C28840] min-[600px]:w-[6.5ch] min-[600px]:text-[32px] ${EDITORIAL_FIELD_CLASS}`}
              />
            ) : (
              <button
                type="button"
                onClick={beginEditTargetAmount}
                className="cursor-pointer border-0 bg-transparent p-0 text-[22px] font-normal italic leading-none text-[#C28840] underline decoration-transparent decoration-1 underline-offset-[0.12em] transition-colors hover:decoration-[#C28840]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4D3A] min-[600px]:text-[32px]"
                aria-label="Edit savings target amount"
              >
                {formatUsd(targetAmount)}
              </button>
            )}
          </p>
          <div className="mt-6 flex w-full max-w-none justify-center px-0 min-[600px]:mt-8 min-[600px]:max-w-md min-[600px]:px-2">
            {editingFundName ? (
              <input
                ref={fundNameInputRef}
                type="text"
                maxLength={40}
                autoComplete="off"
                aria-label="Fund name"
                value={fundNameDraft}
                onChange={(e) =>
                  setFundNameDraft(e.target.value.slice(0, 40))
                }
                onBlur={() => {
                  void commitFundName();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void commitFundName();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setEditingFundName(false);
                  }
                }}
                className={`w-full text-center font-sans text-base font-medium text-[#1F4D3A] min-[600px]:text-lg ${EDITORIAL_FIELD_CLASS}`}
              />
            ) : (
              <button
                type="button"
                onClick={beginEditFundName}
                className="cursor-pointer border-0 bg-transparent p-0 text-center font-sans text-base font-medium text-[#1F4D3A] underline decoration-transparent decoration-1 underline-offset-[0.15em] transition-colors hover:decoration-[#1F4D3A]/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4D3A] min-[600px]:text-lg"
                aria-label="Edit fund name"
              >
                {fundName}
              </button>
            )}
          </div>

          <div className="mt-3 flex w-full max-w-none flex-wrap justify-center gap-2 px-0 min-[600px]:mt-4 min-[600px]:max-w-md min-[600px]:px-2">
            {FUND_NAME_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  void applyFundPreset(preset.label, preset.amount);
                }}
                disabled={isMutatingBank}
                className="rounded-full border border-[#D9CDB0] bg-transparent px-[14px] py-[6px] font-sans text-[12px] font-medium leading-tight text-[#0F1310] transition-colors hover:border-[#0F1310] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4D3A]"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div
            className="mt-5 w-full overflow-hidden rounded-full border border-[#D9CDB0] min-[600px]:mt-6"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={targetAmount}
            aria-valuenow={balance}
            aria-label="Progress toward savings target"
          >
            {targetMet ? (
              <div
                className="h-[2px] w-full shrink-0 bg-[#C28840]"
                aria-hidden="true"
              />
            ) : null}
            <div className="relative h-2 w-full bg-[#E8DFCC]">
              <div
                className="absolute left-0 top-0 h-full bg-[#7A2A1E] transition-[width] duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </section>

        <section className="mt-8 w-full text-left min-[600px]:mt-10">
          {cookNightDeposits.length === 0 ? (
            <p className="text-center font-sans text-sm text-[#0F1310]/55">
              No cook nights yet. Tonight&apos;s the night.
            </p>
          ) : (
            <>
              <ul className="w-full divide-y divide-dashed divide-[#D9CDB0]">
                {visibleCookNights.map((d) => (
                  <li key={d.id} className="flex items-start justify-between gap-4 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-sans text-sm text-[#0F1310]/55">
                        {formatMonthDay(d.date)}
                      </p>
                      <p className="mt-1 font-serif text-base font-normal italic leading-snug text-[#0F1310]">
                        {d.dish}
                      </p>
                    </div>
                    <p className="shrink-0 pt-0.5 font-mono text-sm tabular-nums text-[#1F4D3A]">
                      {formatPlusUsd(d.amount)}
                    </p>
                  </li>
                ))}
              </ul>
              {hasMoreCookNights ? (
                <div className="mt-3 text-center">
                  <button
                    type="button"
                    onClick={() =>
                      setDepositListExpanded((expanded) => !expanded)
                    }
                    className="font-sans text-sm font-medium text-[#0F1310]/60 underline decoration-[#D9CDB0] underline-offset-4 transition-colors hover:text-[#0F1310]"
                  >
                    {depositListExpanded ? "See less" : "See all"}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>

        {targetMet ? (
          <div className="mt-10 min-[600px]:mt-14">
            <div className="flex flex-col items-center gap-6 text-center [animation:celebration-fade-in_0.75s_ease-out_forwards] min-[600px]:gap-8">
              <p className="max-w-md px-1 font-serif text-xl font-normal italic leading-snug text-[#0F1310] min-[600px]:px-0 min-[600px]:text-[32px]">
                You earned this. {fundName} is paid for.
              </p>
              <button
                type="button"
                onClick={() => {
                  void cashOut();
                }}
                disabled={isMutatingBank}
                className="rounded-[2px] bg-[#0F1310] px-6 py-2.5 font-sans text-xs font-medium text-[#F2EAD8] transition-colors duration-200 hover:bg-[#7A2A1E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4D3A] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isMutatingBank ? "Saving..." : "Start a new fund"}
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`max-[599px]:fixed max-[599px]:inset-x-0 max-[599px]:bottom-0 max-[599px]:z-40 max-[599px]:flex max-[599px]:justify-center border-t border-[#D9CDB0]/60 bg-[#F2EAD8]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm min-[600px]:relative min-[600px]:mt-14 min-[600px]:border-0 min-[600px]:bg-transparent min-[600px]:p-0 min-[600px]:backdrop-blur-none ${
              cookModalOpen ? "max-[599px]:hidden" : ""
            }`}
          >
            <div className="w-full max-w-lg">
              <button
                type="button"
                onClick={openCookModal}
                className="w-full rounded-[2px] bg-[#0F1310] px-8 py-4 text-center font-sans text-sm font-medium uppercase tracking-[0.04em] text-[#F2EAD8] transition-colors duration-200 hover:bg-[#7A2A1E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4D3A]"
              >
                I Cooked Tonight
              </button>
            </div>
          </div>
        )}
      </main>

      {cookModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex max-[599px]:flex-col max-[599px]:bg-[#F2EAD8] min-[600px]:items-center min-[600px]:justify-center min-[600px]:bg-[#0F1310]/40 min-[600px]:p-6"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeCookModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cook-modal-title"
            className="flex max-h-[100dvh] w-full max-w-[480px] flex-col overflow-hidden border-t-[3px] border-t-[#7A2A1E] bg-[#F2EAD8] shadow-xl max-[599px]:max-h-none max-[599px]:min-h-0 max-[599px]:max-w-none max-[599px]:flex-1 min-[600px]:max-h-[min(90vh,880px)] min-[600px]:rounded-none"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(e) => {
                e.preventDefault();
                void handleDeposit();
              }}
            >
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] min-[600px]:px-8 min-[600px]:pb-8 min-[600px]:pt-8">
                <h2
                  id="cook-modal-title"
                  className="text-center font-serif text-xl font-normal italic leading-snug text-[#0F1310] min-[600px]:text-2xl"
                >
                  What did you cook tonight?
                </h2>
                <label htmlFor="cook-dish-input" className="sr-only">
                  Dish name
                </label>
                <input
                  id="cook-dish-input"
                  ref={dishFieldRef}
                  type="text"
                  name="dish"
                  value={dishInput}
                  onChange={(e) => setDishInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") closeCookModal();
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleDeposit();
                    }
                  }}
                  placeholder="e.g. Red beans & rice"
                  autoComplete="off"
                  className="mt-6 w-full border-0 border-b border-[#D9CDB0] bg-transparent px-0 py-3 font-sans text-sm text-[#0F1310] outline-none ring-0 transition-colors placeholder:text-[#0F1310]/35 focus:border-b-[#7A2A1E] focus:ring-0 min-[600px]:mt-8"
                />
              </div>
              <div className="mt-auto flex w-full shrink-0 flex-col gap-3 border-t border-[#D9CDB0] bg-[#F2EAD8] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] min-[600px]:flex-row min-[600px]:items-center min-[600px]:justify-between min-[600px]:gap-4 min-[600px]:border-t-0 min-[600px]:bg-transparent min-[600px]:p-8 min-[600px]:pb-8 min-[600px]:pt-0">
                <button
                  type="button"
                  onClick={closeCookModal}
                  className="w-full bg-transparent py-3 text-center font-sans text-sm font-medium text-[#0F1310] transition-colors hover:text-[#7A2A1E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4D3A] min-[600px]:w-auto min-[600px]:px-2 min-[600px]:py-2 min-[600px]:text-left"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full rounded-[2px] bg-[#0F1310] py-3.5 text-center font-sans text-sm font-medium text-[#F2EAD8] transition-colors duration-200 hover:bg-[#7A2A1E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4D3A] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#0F1310] min-[600px]:w-auto min-[600px]:px-6 min-[600px]:py-2.5"
                  disabled={!dishInput.trim() || isSubmittingDeposit}
                >
                  {isSubmittingDeposit ? "Saving..." : "Add to Bank"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
