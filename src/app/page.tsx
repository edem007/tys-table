"use client";

import { useEffect, useRef, useState } from "react";
import type { FeedItem } from "@/lib/dallas-feed";
import type { WeeklySummary } from "@/lib/weekly-summary";
import Onboarding from "./Onboarding";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_FUND_NAME = "Stone Water Fund";
const DEFAULT_TARGET_AMOUNT = 120;
const MIN_TARGET_AMOUNT = 20;
const MAX_TARGET_AMOUNT = 2000;
const FOREST_GREEN = "#5C6B4F";
const BRASS_GOLD = "#C28840";

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
  fundName?: string;
  targetAmount?: number;
  target_name?: string;
  target_amount?: number;
};

type ApiErrorResponse = {
  error: string;
};

type Suggestion = {
  type: "cook" | "dine_out";
  title: string;
  description: string;
  estimatedCost: number;
  reason: string;
  homeAlternative?: {
    title: string;
    estimatedCost: number;
  };
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
  const [savingFundName, setSavingFundName] = useState(false);
  const [savingTargetAmount, setSavingTargetAmount] = useState(false);
  const [editingFundName, setEditingFundName] = useState(false);
  const [fundNameDraft, setFundNameDraft] = useState("");
  const [editingTargetAmount, setEditingTargetAmount] = useState(false);
  const [targetAmountDraft, setTargetAmountDraft] = useState("");
  const [cookModalOpen, setCookModalOpen] = useState(false);
  const [dishInput, setDishInput] = useState("");
  const [depositListExpanded, setDepositListExpanded] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [dailySuggestion, setDailySuggestion] = useState<Suggestion | null>(
    null,
  );
  const [dailyDismissed, setDailyDismissed] = useState(false);
  const [dallasFeed, setDallasFeed] = useState<FeedItem[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userName, setUserName] = useState("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<"free" | "pro">("free");
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [depositAmount, setDepositAmount] = useState(16);
  const dishFieldRef = useRef<HTMLInputElement>(null);
  const fundNameInputRef = useRef<HTMLInputElement>(null);
  const targetAmountInputRef = useRef<HTMLInputElement>(null);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  async function handleUpgrade() {
    setIsUpgrading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
      else setErrorMessage(data.error ?? "Upgrade failed. Try again.");
    } catch {
      setErrorMessage("Upgrade failed. Try again.");
    } finally {
      setIsUpgrading(false);
    }
  }

  async function handleManageBilling() {
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
    } catch {
      setErrorMessage("Could not open billing portal.");
    }
  }

  function applyBankResponse(data: BankGetResponse) {
    setDeposits(data.deposits);
    setBalance(data.balance);
    setFundName(data.fundName ?? data.target_name ?? DEFAULT_FUND_NAME);
    setTargetAmount(
      data.targetAmount ?? data.target_amount ?? DEFAULT_TARGET_AMOUNT,
    );
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

    async function loadDaily() {
      try {
        const res = await fetch("/api/daily-suggestion");
        if (!res.ok) return;
        const data = (await res.json()) as {
          isToday: boolean;
          daily: { suggestion: Suggestion } | null;
        };
        if (cancelled) return;
        if (data.isToday && data.daily) {
          setDailySuggestion(data.daily.suggestion);
        }
      } catch (err) {
        console.error(err);
      }
    }

    async function loadFeed() {
      setIsLoadingFeed(true);
      try {
        const res = await fetch("/api/dallas-feed");
        if (!res.ok) return;
        const data = (await res.json()) as { items?: FeedItem[] };
        if (cancelled) return;
        if (Array.isArray(data.items)) setDallasFeed(data.items);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setIsLoadingFeed(false);
      }
    }

    async function loadPrefs() {
      try {
        const res = await fetch("/api/preferences");
        if (!res.ok) return;
        const data = (await res.json()) as {
          onboarded?: boolean;
          name?: string;
          subscription_tier?: "free" | "pro";
          depositAmount?: number;
        };
        if (cancelled) return;
        if (!data.onboarded) setShowOnboarding(true);
        if (data.name) setUserName(data.name);
        if (data.subscription_tier) setSubscriptionTier(data.subscription_tier);
        if (data.depositAmount) setDepositAmount(data.depositAmount);
      } catch (err) {
        console.error(err);
      }
    }

    load();
    loadDaily();
    loadFeed();
    loadPrefs();
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

    if (!trimmed) {
      setErrorMessage("Fund name must be 1–40 characters.");
      return;
    }
    if (trimmed === fundName) return;

    setSavingFundName(true);
    setErrorMessage(null);
    try {
      await patchFund({ fundName: trimmed });
    } catch (err) {
      console.error(err);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to update fund name",
      );
    } finally {
      setSavingFundName(false);
    }
  }

  async function commitTargetAmount() {
    const digits = targetAmountDraft.replace(/\D/g, "");
    const n = parseInt(digits, 10);
    setEditingTargetAmount(false);

    if (!Number.isFinite(n) || n < MIN_TARGET_AMOUNT || n > MAX_TARGET_AMOUNT) {
      setErrorMessage(
        `Target amount must be between ${formatUsd(MIN_TARGET_AMOUNT)} and ${formatUsd(MAX_TARGET_AMOUNT)}.`,
      );
      return;
    }
    if (n === targetAmount) return;

    setSavingTargetAmount(true);
    setErrorMessage(null);
    try {
      await patchFund({ targetAmount: n });
    } catch (err) {
      console.error(err);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to update target amount",
      );
    } finally {
      setSavingTargetAmount(false);
    }
  }

  function beginEditFundName() {
    if (isLoading || savingFundName || savingTargetAmount) return;
    if (editingTargetAmount) void commitTargetAmount();
    setFundNameDraft(fundName);
    setEditingFundName(true);
    setEditingTargetAmount(false);
  }

  function beginEditTargetAmount() {
    if (isLoading || savingFundName || savingTargetAmount) return;
    if (editingFundName) void commitFundName();
    setTargetAmountDraft(String(targetAmount));
    setEditingTargetAmount(true);
    setEditingFundName(false);
  }

  function cancelEditFundName() {
    setFundNameDraft(fundName);
    setEditingFundName(false);
  }

  function cancelEditTargetAmount() {
    setTargetAmountDraft(String(targetAmount));
    setEditingTargetAmount(false);
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

  const ledgerDeposits = deposits
    .map((d, index) => ({ d, index }))
    .sort((a, b) => {
      if (a.d.date !== b.d.date) return a.d.date < b.d.date ? 1 : -1;
      return b.index - a.index;
    })
    .map(({ d }) => d);

  const visibleLedger = depositListExpanded
    ? ledgerDeposits
    : ledgerDeposits.slice(0, 7);
  const hasMoreLedger = ledgerDeposits.length > 7;

  // --- Insights (computed from cook-night deposits) ---
  const cookNights = deposits.filter((d) => d.amount > 0);
  const totalCookNights = cookNights.length;
  const totalBanked = cookNights.reduce((sum, d) => sum + d.amount, 0);

  const topDishes = (() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const d of cookNights) {
      const key = d.dish.trim().toLowerCase();
      if (!key) continue;
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { label: d.dish.trim(), count: 1 });
    }
    return [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  })();

  const monthlyCookNights = (() => {
    const counts = new Map<string, number>();
    for (const d of cookNights) {
      const month = d.date.slice(0, 7); // YYYY-MM
      counts.set(month, (counts.get(month) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) =>
      a[0] < b[0] ? -1 : 1,
    );
    const recent = sorted.slice(-6);
    const max = recent.reduce((m, [, n]) => Math.max(m, n), 0);
    return recent.map(([month, count]) => {
      const d = new Date(`${month}-01T12:00:00`);
      const label = Number.isNaN(d.getTime())
        ? month
        : d.toLocaleDateString("en-US", { month: "short" });
      return { month, label, count, pct: max > 0 ? (count / max) * 100 : 0 };
    });
  })();

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

  async function fetchSuggestion() {
    if (isLoadingSuggestion || isLoading || targetMet) return;

    setIsLoadingSuggestion(true);
    setErrorMessage(null);
    setSuggestion(null);
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ balance, targetAmount, fundName }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as ApiErrorResponse;
        throw new Error(
          errBody.error ?? `Failed to get suggestion (${res.status})`,
        );
      }
      const data = (await res.json()) as Suggestion;
      setSuggestion(data);
    } catch (err) {
      console.error(err);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to get suggestion",
      );
    } finally {
      setIsLoadingSuggestion(false);
    }
  }

  async function fetchWeeklySummary() {
    setSummaryOpen(true);
    if (weeklySummary || isLoadingSummary) return;

    setIsLoadingSummary(true);
    try {
      const res = await fetch("/api/weekly-summary");
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as ApiErrorResponse;
        throw new Error(
          errBody.error ?? `Failed to load weekly brief (${res.status})`,
        );
      }
      const data = (await res.json()) as { summary?: WeeklySummary };
      if (data.summary) setWeeklySummary(data.summary);
    } catch (err) {
      console.error(err);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to load weekly brief",
      );
    } finally {
      setIsLoadingSummary(false);
    }
  }

  async function cashOut() {
    if (isMutatingBank || !targetMet) return;

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
    <>
      {showOnboarding ? (
        <Onboarding
          onComplete={(prefs) => {
            setShowOnboarding(false);
            if (prefs.name) setUserName(prefs.name);
            void fetchBank();
          }}
        />
      ) : null}
      <div className="min-h-full min-h-[100dvh] bg-[#F2EAD8] text-[#0F1310]">
      <main
        className={`mx-auto w-full max-w-lg px-4 pt-8 pb-8 min-[600px]:px-8 min-[600px]:pt-14 min-[600px]:pb-12 ${
          targetMet
            ? "max-[599px]:pb-[calc(5.75rem+env(safe-area-inset-bottom))]"
            : "max-[599px]:pb-[calc(10.5rem+env(safe-area-inset-bottom))]"
        }`}
      >
        <header className="mb-12 min-[600px]:mb-16">
          <div className="flex items-start justify-between">
            <div className="flex-1 text-center">
              <p className="font-serif text-[2rem] font-medium italic leading-tight tracking-tight text-[#0F1310] min-[600px]:text-5xl min-[600px]:leading-none">
                Ty&apos;s Table
              </p>
              <p className="mt-3 font-mono text-[11px] font-normal uppercase tracking-[0.22em] text-[#0F1310]/70">
                Est. 2026 · Dallas
              </p>
            </div>
            {/* Profile / Sign-out menu */}
            <div className="relative ml-2 mt-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((o) => !o)}
                aria-label="Account menu"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0F1310] font-sans text-xs font-semibold text-[#F2EAD8] transition-colors hover:bg-[#C28840]"
              >
                {userName ? userName.charAt(0).toUpperCase() : "?"}
              </button>
              {profileMenuOpen ? (
                <div className="absolute right-0 top-10 z-50 min-w-[180px] rounded-xl border border-[#D9CDB0] bg-[#F2EAD8] p-2 shadow-lg">
                  {userName ? (
                    <div className="flex items-center gap-2 px-3 py-1.5">
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#0F1310]/50">
                        {userName}
                      </p>
                      {subscriptionTier === "pro" ? (
                        <span className="rounded-full bg-[#C28840] px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[#F2EAD8]">
                          Pro
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {subscriptionTier === "free" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        void handleUpgrade();
                      }}
                      disabled={isUpgrading}
                      className="w-full rounded-lg px-3 py-2 text-left font-sans text-sm font-medium text-[#C28840] transition-colors hover:bg-[#C28840]/10 disabled:opacity-50"
                    >
                      {isUpgrading ? "Redirecting…" : "Upgrade to Pro"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        void handleManageBilling();
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left font-sans text-sm text-[#0F1310]/70 transition-colors hover:bg-[#0F1310]/5"
                    >
                      Manage Billing
                    </button>
                  )}
                  <div className="my-1 border-t border-[#D9CDB0]" />
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      void handleSignOut();
                    }}
                    className="w-full rounded-lg px-3 py-2 text-left font-sans text-sm text-[#7A2A1E] hover:bg-[#7A2A1E]/10"
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {dailySuggestion && !dailyDismissed ? (
          <section
            aria-label="Tonight's suggestion"
            className="mb-10 rounded-lg border border-[#C28840]/40 bg-[#C28840]/8 px-5 py-5 text-left [animation:celebration-fade-in_0.6s_ease-out_forwards]"
          >
            <div className="flex items-start justify-between gap-4">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-[#C28840]">
                Tonight&apos;s Pick
              </p>
              <button
                type="button"
                onClick={() => setDailyDismissed(true)}
                aria-label="Dismiss tonight's suggestion"
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#0F1310]/45 transition-colors hover:text-[#7A2A1E]"
              >
                Dismiss
              </button>
            </div>
            <div className="mt-3 flex items-start gap-3">
              <span className="text-xl leading-none" aria-hidden="true">
                {dailySuggestion.type === "cook" ? "🍳" : "🍽️"}
              </span>
              <div className="min-w-0">
                <p className="font-serif text-[22px] font-normal italic leading-snug text-[#0F1310]">
                  {dailySuggestion.title}
                </p>
                <p className="mt-2 font-sans text-sm leading-relaxed text-[#0F1310]/75">
                  {dailySuggestion.description}
                </p>
                <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[#0F1310]/55">
                  {dailySuggestion.type === "cook"
                    ? `Est. groceries ${formatUsd(dailySuggestion.estimatedCost)}`
                    : `Est. ${formatUsd(dailySuggestion.estimatedCost)}`}
                </p>
                {dailySuggestion.type === "dine_out" &&
                dailySuggestion.homeAlternative ? (
                  <p className="mt-2 font-sans text-[11px] text-[#7A2A1E]">
                    Or cook in: {dailySuggestion.homeAlternative.title} (
                    {formatUsd(dailySuggestion.homeAlternative.estimatedCost)})
                    {dailySuggestion.estimatedCost >
                    dailySuggestion.homeAlternative.estimatedCost
                      ? ` — save ${formatUsd(dailySuggestion.estimatedCost - dailySuggestion.homeAlternative.estimatedCost)}`
                      : ""}
                  </p>
                ) : null}
                <p className="mt-3 font-serif text-sm italic text-[#1F4D3A]">
                  {dailySuggestion.reason}
                </p>
              </div>
            </div>
          </section>
        ) : null}

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
              {isLoading ? (
                <span
                  className="inline-block h-[0.72em] w-[2.2em] animate-pulse rounded-lg bg-[#E8DFCC] align-middle"
                  aria-hidden="true"
                />
              ) : (
                formatUsd(balance)
              )}
            </span>
            <span
              className="translate-y-[-0.06em] px-0.5 font-normal text-[15px] text-[#0F1310]/30 min-[600px]:translate-y-[-0.08em] min-[600px]:text-[22px]"
              aria-hidden="true"
            >
              /
            </span>
            {savingTargetAmount ? (
              <span
                className="text-[22px] font-normal italic leading-none text-[#C28840]/55 min-[600px]:text-[32px]"
                aria-live="polite"
              >
                Saving...
              </span>
            ) : editingTargetAmount ? (
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
                    cancelEditTargetAmount();
                  }
                }}
                className={`inline-block w-[5.5ch] max-w-full text-center font-serif text-[22px] font-normal italic tabular-nums text-[#C28840] min-[600px]:w-[6.5ch] min-[600px]:text-[32px] ${EDITORIAL_FIELD_CLASS}`}
              />
            ) : (
              <button
                type="button"
                onClick={beginEditTargetAmount}
                disabled={isLoading}
                className="cursor-pointer border-0 bg-transparent p-0 text-[22px] font-normal italic leading-none text-[#C28840] underline decoration-transparent decoration-1 underline-offset-[0.12em] transition-colors hover:decoration-[#C28840]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4D3A] disabled:cursor-default disabled:opacity-60 min-[600px]:text-[32px]"
                aria-label="Edit savings target amount"
              >
                {formatUsd(targetAmount)}
              </button>
            )}
          </p>
          <div className="mt-6 flex w-full max-w-none justify-center px-0 min-[600px]:mt-8 min-[600px]:max-w-md min-[600px]:px-2">
            {savingFundName ? (
              <p
                className="font-sans text-base font-medium text-[#1F4D3A]/55 min-[600px]:text-lg"
                aria-live="polite"
              >
                Saving...
              </p>
            ) : editingFundName ? (
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
                    cancelEditFundName();
                  }
                }}
                className={`w-full text-center font-sans text-base font-medium text-[#1F4D3A] min-[600px]:text-lg ${EDITORIAL_FIELD_CLASS}`}
              />
            ) : (
              <button
                type="button"
                onClick={beginEditFundName}
                disabled={isLoading}
                className="cursor-pointer border-0 bg-transparent p-0 text-center font-sans text-base font-medium text-[#1F4D3A] underline decoration-transparent decoration-1 underline-offset-[0.15em] transition-colors hover:decoration-[#1F4D3A]/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4D3A] disabled:cursor-default disabled:opacity-60 min-[600px]:text-lg"
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
                disabled={
                  isMutatingBank || savingFundName || savingTargetAmount
                }
                className="rounded-full border border-[#D9CDB0] bg-transparent px-[14px] py-[6px] font-sans text-[12px] font-medium leading-tight text-[#0F1310] transition-colors hover:border-[#0F1310] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4D3A] disabled:opacity-50"
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
            aria-label={
              targetMet ? "Savings target reached" : "Progress toward savings target"
            }
          >
            <div className="relative h-2 w-full bg-[#E8DFCC]">
              <div
                className={`absolute left-0 top-0 h-full transition-[width] duration-500 ease-out ${
                  targetMet ? "w-full" : ""
                }`}
                style={
                  targetMet
                    ? { backgroundColor: BRASS_GOLD }
                    : {
                        width: `${progressPercent}%`,
                        backgroundColor: "#7A2A1E",
                      }
                }
              />
            </div>
          </div>

          {targetMet ? (
            <p
              className="mt-8 max-w-md px-2 font-serif text-xl font-normal italic leading-snug min-[600px]:mt-10 min-[600px]:px-0 min-[600px]:text-[28px] [animation:celebration-fade-in_0.75s_ease-out_forwards]"
              style={{ color: FOREST_GREEN }}
            >
              You earned it! Time to enjoy your {fundName}.
            </p>
          ) : null}
        </section>

        {suggestion ? (
          <section
            className="mt-8 w-full border border-[#D9CDB0] bg-[#F2EAD8] px-5 py-6 min-[600px]:mt-10 min-[600px]:px-6 [animation:celebration-fade-in_0.75s_ease-out_forwards]"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none" aria-hidden="true">
                {suggestion.type === "cook" ? "🍳" : "🍽️"}
              </span>
              <div className="min-w-0 flex-1 text-left">
                <p className="font-serif text-lg font-normal italic leading-snug text-[#0F1310] min-[600px]:text-xl">
                  {suggestion.title}
                </p>
                <p className="mt-2 font-sans text-sm leading-relaxed text-[#0F1310]/80">
                  {suggestion.description}
                </p>
                <p className="mt-3 font-mono text-xs uppercase tracking-[0.12em] text-[#1F4D3A]">
                  {suggestion.type === "cook"
                    ? `Est. groceries ${formatUsd(suggestion.estimatedCost)}`
                    : `Est. ${formatUsd(suggestion.estimatedCost)}`}
                </p>
                {suggestion.type === "dine_out" && suggestion.homeAlternative ? (
                  <div className="mt-4 rounded-md border border-[#D9CDB0] bg-[#F2EAD8] p-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#0F1310]/45">
                      Or cook it at home
                    </p>
                    <div className="mt-2 flex items-baseline justify-between gap-3">
                      <p className="min-w-0 font-serif text-sm font-normal italic text-[#0F1310]">
                        {suggestion.homeAlternative.title}
                      </p>
                      <p className="shrink-0 font-mono text-xs tabular-nums text-[#1F4D3A]">
                        {formatUsd(suggestion.homeAlternative.estimatedCost)}
                      </p>
                    </div>
                    {suggestion.estimatedCost >
                    suggestion.homeAlternative.estimatedCost ? (
                      <p className="mt-2 font-sans text-xs text-[#7A2A1E]">
                        Save{" "}
                        {formatUsd(
                          suggestion.estimatedCost -
                            suggestion.homeAlternative.estimatedCost,
                        )}{" "}
                        by cooking in.
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <p className="mt-3 font-serif text-sm font-normal italic text-[#0F1310]/55">
                  {suggestion.reason}
                </p>
              </div>
            </div>
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => setSuggestion(null)}
                className="font-sans text-sm font-medium text-[#0F1310]/60 underline decoration-[#D9CDB0] underline-offset-4 transition-colors hover:text-[#0F1310]"
              >
                Dismiss
              </button>
            </div>
          </section>
        ) : null}

        <section className="mt-8 w-full text-left min-[600px]:mt-10">
          {ledgerDeposits.length === 0 ? (
            <p className="text-center font-sans text-sm text-[#0F1310]/55">
              No cook nights yet. Tonight&apos;s the night.
            </p>
          ) : (
            <>
              <ul className="w-full divide-y divide-dashed divide-[#D9CDB0]">
                {visibleLedger.map((d) => (
                  <li key={d.id} className="flex items-start justify-between gap-4 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-sans text-sm text-[#0F1310]/55">
                        {formatMonthDay(d.date)}
                      </p>
                      <p
                        className={`mt-1 font-serif text-base font-normal italic leading-snug ${
                          d.amount < 0 ? "text-[#0F1310]/70" : "text-[#0F1310]"
                        }`}
                      >
                        {d.dish}
                      </p>
                    </div>
                    <p
                      className={`shrink-0 pt-0.5 font-mono text-sm tabular-nums ${
                        d.amount < 0 ? "text-[#0F1310]/55" : "text-[#1F4D3A]"
                      }`}
                    >
                      {d.amount < 0 ? formatUsd(d.amount) : formatPlusUsd(d.amount)}
                    </p>
                  </li>
                ))}
              </ul>
              {hasMoreLedger ? (
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

        {totalCookNights > 0 ? (
          <section className="mt-16 w-full text-left">
            <div className="mb-5 flex items-baseline justify-between gap-3 border-b border-[#D9CDB0] pb-2">
              <h2 className="font-serif text-xl font-normal italic text-[#0F1310]">
                Insights
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#0F1310]/45">
                Your Cooking
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-[#0F1310]/10 px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#0F1310]/50">
                  Cook Nights
                </p>
                <p className="mt-1 font-serif text-3xl font-normal text-[#0F1310]">
                  {totalCookNights}
                </p>
              </div>
              <div className="rounded-lg border border-[#0F1310]/10 px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#0F1310]/50">
                  Total Banked
                </p>
                <p className="mt-1 font-serif text-3xl font-normal text-[#1F4D3A]">
                  {formatUsd(totalBanked)}
                </p>
              </div>
            </div>

            {topDishes.length > 0 ? (
              <div className="mt-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#0F1310]/50">
                  Most Cooked
                </p>
                <ul className="mt-2 space-y-1.5">
                  {topDishes.map((d) => (
                    <li
                      key={d.label}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <span className="min-w-0 truncate font-serif text-base italic text-[#0F1310]">
                        {d.label}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-[#0F1310]/55">
                        {d.count}×
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {monthlyCookNights.length > 1 ? (
              <div className="mt-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#0F1310]/50">
                  Cook Nights by Month
                </p>
                <div className="mt-3 flex items-end justify-between gap-2">
                  {monthlyCookNights.map((m) => (
                    <div
                      key={m.month}
                      className="flex flex-1 flex-col items-center gap-1.5"
                    >
                      <span className="font-mono text-[10px] text-[#0F1310]/55">
                        {m.count}
                      </span>
                      <div className="flex h-20 w-full items-end">
                        <div
                          className="w-full rounded-t-sm bg-[#7A2A1E] transition-[height] duration-300"
                          style={{ height: `${Math.max(m.pct, 6)}%` }}
                        />
                      </div>
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#0F1310]/50">
                        {m.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="mt-16 w-full text-left">
          <div className="mb-5 flex items-baseline justify-between gap-3 border-b border-[#D9CDB0] pb-2">
            <h2 className="font-serif text-xl font-normal italic text-[#0F1310]">
              This Week in Dallas
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#0F1310]/45">
              Curated for Ty
            </span>
          </div>

          {isLoadingFeed && dallasFeed.length === 0 ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-24 w-full animate-pulse rounded-lg bg-[#E8DFCC]"
                />
              ))}
            </div>
          ) : dallasFeed.length === 0 ? (
            <p className="font-sans text-sm text-[#0F1310]/55">
              No picks just yet — check back this evening.
            </p>
          ) : (
            <ul className="space-y-4">
              {dallasFeed.map((item, i) => (
                <li
                  key={`${item.name}-${i}`}
                  className="rounded-lg border border-[#0F1310]/10 bg-[#F2EAD8] px-5 py-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#C28840]">
                      {item.category === "restaurant"
                        ? "Restaurant"
                        : item.category === "nightlife"
                          ? "Nightlife"
                          : "Event"}
                    </span>
                    {item.rating !== undefined ? (
                      <span className="font-mono text-[10px] tracking-[0.08em] text-[#1F4D3A]">
                        ★ {item.rating.toFixed(1)}
                      </span>
                    ) : null}
                    {item.priceRange ? (
                      <span className="font-mono text-[10px] tracking-[0.08em] text-[#0F1310]/45">
                        {item.priceRange}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 font-serif text-lg font-normal italic leading-snug text-[#0F1310]">
                    {item.name}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#0F1310]/50">
                    {item.kind}
                    {item.neighborhood ? ` · ${item.neighborhood}` : ""}
                    {item.date ? ` · ${formatMonthDay(item.date)}` : ""}
                  </p>
                  <p className="mt-2.5 font-sans text-sm leading-relaxed text-[#0F1310]/75">
                    {item.description}
                  </p>
                  <p className="mt-2 font-serif text-sm italic text-[#1F4D3A]">
                    {item.whyTy}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-16 w-full text-left">
          <div className="mb-5 flex items-baseline justify-between gap-3 border-b border-[#D9CDB0] pb-2">
            <h2 className="font-serif text-xl font-normal italic text-[#0F1310]">
              Weekly Brief
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#0F1310]/45">
              Every Sunday
            </span>
          </div>

          {!summaryOpen ? (
            <button
              type="button"
              onClick={() => {
                void fetchWeeklySummary();
              }}
              className="w-full rounded-lg border border-[#0F1310]/15 bg-[#F2EAD8] px-5 py-4 text-left font-sans text-sm text-[#0F1310]/70 transition-colors hover:border-[#C28840]/50 hover:text-[#0F1310]"
            >
              Read this week&apos;s brief →
            </button>
          ) : isLoadingSummary && !weeklySummary ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-16 w-full animate-pulse rounded-lg bg-[#E8DFCC]"
                />
              ))}
            </div>
          ) : weeklySummary ? (
            <div className="space-y-6 [animation:celebration-fade-in_0.6s_ease-out_forwards]">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#C28840]">
                  This Week&apos;s Theme
                </p>
                <p className="mt-1 font-serif text-2xl font-normal italic text-[#0F1310]">
                  {weeklySummary.theme}
                </p>
              </div>

              <div className="rounded-lg border border-[#0F1310]/10 px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#0F1310]/50">
                  Fund Status
                </p>
                <p className="mt-1 font-serif text-lg text-[#0F1310]">
                  {formatUsd(weeklySummary.budget.saved)} of{" "}
                  {formatUsd(weeklySummary.budget.target)}
                </p>
                {weeklySummary.budget.note ? (
                  <p className="mt-1 font-sans text-sm text-[#0F1310]/70">
                    {weeklySummary.budget.note}
                  </p>
                ) : null}
              </div>

              {weeklySummary.restaurantPicks.length > 0 ? (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#0F1310]/50">
                    Top Picks
                  </p>
                  <ul className="mt-2 space-y-3">
                    {weeklySummary.restaurantPicks.map((p, i) => (
                      <li key={`${p.name}-${i}`}>
                        <div className="flex items-baseline gap-2">
                          <span className="font-serif text-base italic text-[#0F1310]">
                            {p.name}
                          </span>
                          {p.rating !== undefined ? (
                            <span className="font-mono text-[10px] text-[#1F4D3A]">
                              ★ {p.rating.toFixed(1)}
                            </span>
                          ) : null}
                          {p.priceRange ? (
                            <span className="font-mono text-[10px] text-[#0F1310]/45">
                              {p.priceRange}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 font-sans text-sm text-[#0F1310]/70">
                          {p.why}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="rounded-lg border border-[#D9CDB0] bg-[#F2EAD8] px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#0F1310]/50">
                  Cook vs. Dine Out
                </p>
                <div className="mt-2 flex items-baseline justify-between gap-3 font-mono text-sm tabular-nums">
                  <span className="text-[#0F1310]/70">
                    Dining out {formatUsd(weeklySummary.costComparison.diningOut)}
                  </span>
                  <span className="text-[#1F4D3A]">
                    Cooking {formatUsd(weeklySummary.costComparison.cooking)}
                  </span>
                </div>
                {weeklySummary.costComparison.savings > 0 ? (
                  <p className="mt-2 font-serif text-base italic text-[#7A2A1E]">
                    Save {formatUsd(weeklySummary.costComparison.savings)} this
                    week
                  </p>
                ) : null}
                {weeklySummary.costComparison.note ? (
                  <p className="mt-1 font-sans text-sm text-[#0F1310]/70">
                    {weeklySummary.costComparison.note}
                  </p>
                ) : null}
              </div>

              {weeklySummary.entertainment.length > 0 ? (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#0F1310]/50">
                    Entertainment
                  </p>
                  <ul className="mt-2 space-y-2">
                    {weeklySummary.entertainment.map((e, i) => (
                      <li key={`${e.name}-${i}`} className="font-sans text-sm">
                        <span className="font-serif italic text-[#0F1310]">
                          {e.name}
                        </span>
                        <span className="text-[#0F1310]/55">
                          {" "}
                          — {e.kind}
                          {e.date ? ` · ${formatMonthDay(e.date)}` : ""}
                        </span>
                        {e.note ? (
                          <span className="block text-[#0F1310]/70">
                            {e.note}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {weeklySummary.plan.length > 0 ? (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#0F1310]/50">
                    Your Week
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {weeklySummary.plan.map((line, i) => (
                      <li
                        key={i}
                        className="font-sans text-sm leading-relaxed text-[#0F1310]/80"
                      >
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setSummaryOpen(false)}
                className="font-sans text-sm font-medium text-[#0F1310]/60 underline decoration-[#D9CDB0] underline-offset-4 transition-colors hover:text-[#0F1310]"
              >
                Hide brief
              </button>
            </div>
          ) : (
            <p className="font-sans text-sm text-[#0F1310]/55">
              Couldn&apos;t load the brief. Try again later.
            </p>
          )}
        </section>

        <div
          className={`max-[599px]:fixed max-[599px]:inset-x-0 max-[599px]:bottom-0 max-[599px]:z-40 max-[599px]:flex max-[599px]:justify-center border-t border-[#D9CDB0]/60 bg-[#F2EAD8]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm min-[600px]:relative min-[600px]:mt-14 min-[600px]:border-0 min-[600px]:bg-transparent min-[600px]:p-0 min-[600px]:backdrop-blur-none ${
            !targetMet && cookModalOpen ? "max-[599px]:hidden" : ""
          }`}
        >
          <div className="w-full max-w-lg">
            {targetMet ? (
              <button
                type="button"
                onClick={() => {
                  void cashOut();
                }}
                disabled={
                  isMutatingBank ||
                  savingFundName ||
                  savingTargetAmount ||
                  isLoading
                }
                className="w-full rounded-[2px] bg-[#5C6B4F] px-8 py-4 text-center font-sans text-sm font-medium uppercase tracking-[0.04em] text-[#F2EAD8] transition-colors duration-200 hover:bg-[#4d5a43] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5C6B4F] disabled:cursor-not-allowed disabled:opacity-50 min-[600px]:mx-auto min-[600px]:block min-[600px]:max-w-xs"
              >
                {isMutatingBank ? "Cashing out..." : "Cash Out"}
              </button>
            ) : (
              <div className="flex w-full flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    void fetchSuggestion();
                  }}
                  disabled={
                    isLoadingSuggestion ||
                    isLoading ||
                    isSubmittingDeposit ||
                    savingFundName ||
                    savingTargetAmount
                  }
                  className="w-full rounded-[2px] border border-[#C28840] bg-transparent px-6 py-3.5 text-center font-sans text-sm font-medium text-[#0F1310] transition-colors duration-200 hover:border-[#7A2A1E] hover:text-[#7A2A1E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C28840] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoadingSuggestion
                    ? "Thinking..."
                    : "What Should I Do Tonight?"}
                </button>
                <button
                  type="button"
                  onClick={openCookModal}
                  disabled={isLoadingSuggestion}
                  className="w-full rounded-[2px] bg-[#0F1310] px-8 py-4 text-center font-sans text-sm font-medium uppercase tracking-[0.04em] text-[#F2EAD8] transition-colors duration-200 hover:bg-[#7A2A1E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4D3A] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  I Cooked Tonight
                </button>
              </div>
            )}
          </div>
        </div>
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
                <p className="mt-1.5 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-[#1F4D3A]">
                  You&apos;ll bank +${depositAmount} tonight
                </p>
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
    </>
  );
}
