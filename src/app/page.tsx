"use client";

import { useState } from "react";

const TARGET_DOLLARS = 120;
const COOK_NIGHT_DEPOSIT = 16;

function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function Home() {
  const [balance, setBalance] = useState(0);

  const progressPercent =
    TARGET_DOLLARS <= 0 ? 0 : Math.min((balance / TARGET_DOLLARS) * 100, 100);
  const targetMet = balance >= TARGET_DOLLARS;

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
            <span className="text-[32px] font-normal italic text-[#C28840]">
              {formatUsd(TARGET_DOLLARS)}
            </span>
          </p>
          <p className="mt-8 font-sans text-lg font-medium text-[#1F4D3A]">
            Stone Water Fund
          </p>

          <div
            className="mt-6 w-full overflow-hidden rounded-full border border-[#D9CDB0]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={TARGET_DOLLARS}
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

        <section className="mt-14">
          <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-[#0F1310]/65">
            Recent Cook Nights
          </h2>
          <div className="mt-4 rounded-lg border border-[#0F1310]/10 bg-[#F2EAD8] px-4 py-10 text-center">
            <p className="font-sans text-sm text-[#0F1310]/60">No deposits yet</p>
          </div>
        </section>

        <div className="mt-14">
          {targetMet ? (
            <div className="flex flex-col items-center gap-8 text-center [animation:celebration-fade-in_0.75s_ease-out_forwards]">
              <p className="max-w-md font-serif text-[32px] font-normal italic leading-snug text-[#0F1310]">
                You earned this. Stone Water is paid for.
              </p>
              <button
                type="button"
                onClick={() => setBalance(0)}
                className="rounded-[2px] bg-[#0F1310] px-6 py-2.5 font-sans text-xs font-medium text-[#F2EAD8] transition-colors duration-200 hover:bg-[#7A2A1E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4D3A]"
              >
                Start a new fund
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setBalance((b) => b + COOK_NIGHT_DEPOSIT)}
              className="w-full rounded-xl bg-[#0F1310] px-6 py-4 text-center font-sans text-lg font-semibold text-[#F2EAD8] transition-colors duration-200 hover:bg-[#C28840] hover:text-[#F2EAD8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4D3A]"
            >
              I Cooked Tonight
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
