"use client";

import { useEffect, useRef, useState } from "react";

const COOK_NIGHT_DEPOSIT = 16;
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
  const [fundName, setFundName] = useState(DEFAULT_FUND_NAME);
  const [targetAmount, setTargetAmount] = useState(DEFAULT_TARGET_AMOUNT);
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

  const balance = deposits.reduce((sum, d) => sum + d.amount, 0);

  const progressPercent =
    targetAmount <= 0 ? 0 : Math.min((balance / targetAmount) * 100, 100);
  const targetMet = balance >= targetAmount;

  function commitFundName() {
    const trimmed = fundNameDraft.trim().slice(0, 40);
    if (trimmed) setFundName(trimmed);
    setEditingFundName(false);
  }

  function commitTargetAmount() {
    const digits = targetAmountDraft.replace(/\D/g, "");
    const n = parseInt(digits, 10);
    if (
      Number.isFinite(n) &&
      n >= MIN_TARGET_AMOUNT &&
      n <= MAX_TARGET_AMOUNT
    ) {
      setTargetAmount(n);
    }
    setEditingTargetAmount(false);
  }

  function beginEditFundName() {
    if (editingTargetAmount) commitTargetAmount();
    setFundNameDraft(fundName);
    setEditingFundName(true);
    setEditingTargetAmount(false);
  }

  function beginEditTargetAmount() {
    if (editingFundName) commitFundName();
    setTargetAmountDraft(String(targetAmount));
    setEditingTargetAmount(true);
    setEditingFundName(false);
  }

  function applyFundPreset(label: string, amount: number) {
    setEditingFundName(false);
    setEditingTargetAmount(false);
    setFundName(label.slice(0, 40));
    setTargetAmount(amount);
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

  function confirmCookNight() {
    const dish = dishInput.trim();
    if (!dish) return;

    const today = new Date().toISOString().slice(0, 10);
    setDeposits((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        date: today,
        dish,
        amount: COOK_NIGHT_DEPOSIT,
      },
    ]);
    closeCookModal();
  }

  function cashOut() {
    setDeposits((prev) => {
      const b = prev.reduce((s, d) => s + d.amount, 0);
      if (b <= 0) return prev;
      const today = new Date().toISOString().slice(0, 10);
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          date: today,
          dish: "Cash out",
          amount: -b,
        },
      ];
    });
  }

  return (
    <div className="min-h-full bg-[#F2EAD8] text-[#0F1310]">
      <main className="mx-auto w-full max-w-lg px-6 py-12 sm:py-16">
        <header className="mb-12 text-center sm:mb-16">
          <p className="font-serif text-4xl font-medium italic tracking-tight text-[#0F1310] sm:text-5xl">
            Ty&apos;s Table
          </p>
          <p className="mt-3 font-mono text-[11px] font-normal uppercase tracking-[0.22em] text-[#0F1310]/70">
            Est. 2026 · Dallas
          </p>
        </header>

        <section className="flex flex-col items-center text-center">
          <p
            className="font-serif flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 leading-none"
            aria-live="polite"
          >
            <span className="text-[96px] font-normal tracking-[-0.03em] text-[#7A2A1E]">
              {formatUsd(balance)}
            </span>
            <span
              className="translate-y-[-0.08em] px-0.5 font-normal text-[22px] text-[#0F1310]/30"
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
                onBlur={commitTargetAmount}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitTargetAmount();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setEditingTargetAmount(false);
                  }
                }}
                className={`inline-block w-[6.5ch] max-w-full text-center font-serif text-[32px] font-normal italic tabular-nums text-[#C28840] ${EDITORIAL_FIELD_CLASS}`}
              />
            ) : (
              <button
                type="button"
                onClick={beginEditTargetAmount}
                className="cursor-pointer border-0 bg-transparent p-0 text-[32px] font-normal italic leading-none text-[#C28840] underline decoration-transparent decoration-1 underline-offset-[0.12em] transition-colors hover:decoration-[#C28840]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4D3A]"
                aria-label="Edit savings target amount"
              >
                {formatUsd(targetAmount)}
              </button>
            )}
          </p>
          <div className="mt-8 flex w-full max-w-md justify-center px-2">
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
                onBlur={commitFundName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitFundName();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setEditingFundName(false);
                  }
                }}
                className={`w-full text-center font-sans text-lg font-medium text-[#1F4D3A] ${EDITORIAL_FIELD_CLASS}`}
              />
            ) : (
              <button
                type="button"
                onClick={beginEditFundName}
                className="cursor-pointer border-0 bg-transparent p-0 text-center font-sans text-lg font-medium text-[#1F4D3A] underline decoration-transparent decoration-1 underline-offset-[0.15em] transition-colors hover:decoration-[#1F4D3A]/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4D3A]"
                aria-label="Edit fund name"
              >
                {fundName}
              </button>
            )}
          </div>

          <div className="mt-4 flex w-full max-w-md flex-wrap justify-center gap-2 px-2">
            {FUND_NAME_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() =>
                  applyFundPreset(preset.label, preset.amount)
                }
                className="rounded-full border border-[#D9CDB0] bg-transparent px-[14px] py-[6px] font-sans text-[12px] font-medium leading-tight text-[#0F1310] transition-colors hover:border-[#0F1310] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4D3A]"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div
            className="mt-6 w-full overflow-hidden rounded-full border border-[#D9CDB0]"
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

        <section className="mt-10 w-full text-left">
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

        <div className="mt-14">
          {targetMet ? (
            <div className="flex flex-col items-center gap-8 text-center [animation:celebration-fade-in_0.75s_ease-out_forwards]">
              <p className="max-w-md font-serif text-[32px] font-normal italic leading-snug text-[#0F1310]">
                You earned this. {fundName} is paid for.
              </p>
              <button
                type="button"
                onClick={cashOut}
                className="rounded-[2px] bg-[#0F1310] px-6 py-2.5 font-sans text-xs font-medium text-[#F2EAD8] transition-colors duration-200 hover:bg-[#7A2A1E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4D3A]"
              >
                Start a new fund
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openCookModal}
              className="w-full rounded-[2px] bg-[#0F1310] px-8 py-4 text-center font-sans text-sm font-medium uppercase tracking-[0.04em] text-[#F2EAD8] transition-colors duration-200 hover:bg-[#7A2A1E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4D3A]"
            >
              I Cooked Tonight
            </button>
          )}
        </div>
      </main>

      {cookModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1310]/40 p-6"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeCookModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cook-modal-title"
            className="w-full max-w-[480px] border-t-[3px] border-t-[#7A2A1E] bg-[#F2EAD8] p-8 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2
              id="cook-modal-title"
              className="text-center font-serif text-2xl font-normal italic leading-snug text-[#0F1310]"
            >
              What did you cook tonight?
            </h2>
            <form
              className="mt-8"
              onSubmit={(e) => {
                e.preventDefault();
                confirmCookNight();
              }}
            >
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
                    confirmCookNight();
                  }
                }}
                placeholder="e.g. Red beans & rice"
                autoComplete="off"
                className="w-full border-0 border-b border-[#D9CDB0] bg-transparent px-0 py-3 font-sans text-sm text-[#0F1310] outline-none ring-0 transition-colors placeholder:text-[#0F1310]/35 focus:border-b-[#7A2A1E] focus:ring-0"
              />
              <div className="mt-10 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={closeCookModal}
                  className="bg-transparent px-2 py-2 font-sans text-sm font-medium text-[#0F1310] transition-colors hover:text-[#7A2A1E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4D3A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-[2px] bg-[#0F1310] px-6 py-2.5 font-sans text-sm font-medium text-[#F2EAD8] transition-colors duration-200 hover:bg-[#7A2A1E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4D3A] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#0F1310]"
                  disabled={!dishInput.trim()}
                >
                  Add to Bank
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
