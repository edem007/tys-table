"use client";

import { useState } from "react";
import { ALLERGEN_OPTIONS, CUISINE_OPTIONS, computeCookNightDeposit, type Preferences } from "@/lib/preferences";

type InitialValues = {
  name?: string;
  cuisines?: string[];
  monthlyBudget?: number;
  cookNights?: number;
  partySize?: number;
  allergies?: string[];
};

type OnboardingProps = {
  onComplete: (prefs: Preferences) => void;
  onClose?: () => void;          // present → settings mode (shows close button)
  initialValues?: InitialValues;
};

const PARTY_SIZE_OPTIONS = [
  { label: "Just me", value: 1, emoji: "🧑" },
  { label: "Two of us", value: 2, emoji: "👥" },
  { label: "3–4 people", value: 3, emoji: "👨‍👩‍👧" },
  { label: "5+ people", value: 5, emoji: "👨‍👩‍👧‍👦" },
] as const;

export default function Onboarding({ onComplete, onClose, initialValues }: OnboardingProps) {
  const isSettingsMode = !!onClose;

  const [name, setName] = useState(initialValues?.name ?? "");
  const [cuisines, setCuisines] = useState<string[]>(initialValues?.cuisines ?? []);
  const [budget, setBudget] = useState(String(initialValues?.monthlyBudget ?? 400));
  const [cookNights, setCookNights] = useState(initialValues?.cookNights ?? 4);
  const [partySize, setPartySize] = useState(initialValues?.partySize ?? 2);
  const [allergies, setAllergies] = useState<string[]>(initialValues?.allergies ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dineOutNights = Math.max(0, 7 - cookNights);

  // Live deposit preview
  const monthlyBudget = parseInt(budget.replace(/\D/g, ""), 10) || 400;
  const depositPreview = computeCookNightDeposit({
    monthlyBudget,
    dineOutNights,
    partySize,
  });

  function toggleCuisine(c: string) {
    setCuisines((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  function toggleAllergen(a: string) {
    setAllergies((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
    );
  }

  async function handleSubmit() {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }
    if (cuisines.length === 0) {
      setError("Pick at least one cuisine you love.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const prefsBody = {
        name: trimmedName,
        cuisines,
        monthlyBudget: Number.isFinite(monthlyBudget) ? monthlyBudget : 400,
        cookNights,
        dineOutNights,
        partySize,
        allergies,
        onboarded: true,
      };

      const prefsRes = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefsBody),
      });

      if (!prefsRes.ok) {
        throw new Error("Could not save your preferences. Please try again.");
      }
      const savedPrefs = (await prefsRes.json()) as Preferences;
      onComplete(savedPrefs);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0F1310]/40 px-4 py-8 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-xl bg-[#F2EAD8] p-6 shadow-xl min-[600px]:p-8 [animation:celebration-fade-in_0.5s_ease-out_forwards]">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#C28840]">
              {isSettingsMode ? "Your settings" : "Welcome to"}
            </p>
            <h1
              id="onboarding-title"
              className="mt-1 font-serif text-3xl font-medium italic text-[#0F1310]"
            >
              {isSettingsMode ? "Update your table" : "Ty’s Table"}
            </h1>
            {!isSettingsMode && (
              <p className="mt-2 font-sans text-sm text-[#0F1310]/75">
                A few details so your strategist knows your taste.
              </p>
            )}
          </div>
          {isSettingsMode && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close settings"
              className="ml-4 mt-1 flex h-8 w-8 items-center justify-center rounded-full text-[#0F1310]/50 transition-colors hover:bg-[#0F1310]/8 hover:text-[#0F1310]"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>

        <div className="mt-6 space-y-6">
          {/* Name */}
          <div>
            <label className="font-mono text-xs uppercase tracking-[0.16em] text-[#0F1310]/65">
              Your name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 40))}
              placeholder="e.g. Ty"
              className="mt-2 w-full border-0 border-b border-[#D9CDB0] bg-transparent pb-1 font-serif text-lg text-[#0F1310] outline-none focus:border-b-[#7A2A1E]"
            />
          </div>

          {/* Cuisines */}
          <div>
            <label className="font-mono text-xs uppercase tracking-[0.16em] text-[#0F1310]/65">
              Cuisines you love
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {CUISINE_OPTIONS.map((c) => {
                const selected = cuisines.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCuisine(c)}
                    className={`rounded-full border px-3 py-1.5 font-sans text-sm capitalize transition-colors ${
                      selected
                        ? "border-[#7A2A1E] bg-[#7A2A1E] text-[#F2EAD8]"
                        : "border-[#D9CDB0] text-[#0F1310]/75 hover:border-[#C28840]"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Allergies */}
          <div>
            <label className="font-mono text-xs uppercase tracking-[0.16em] text-[#0F1310]/65">
              Any food allergies?
            </label>
            <p className="mt-1 font-sans text-xs text-[#0F1310]/60">
              We&apos;ll never surface a recipe or restaurant dish that contains these.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALLERGEN_OPTIONS.map((a) => {
                const selected = allergies.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAllergen(a)}
                    className={`rounded-full border px-3 py-1.5 font-sans text-sm capitalize transition-colors ${
                      selected
                        ? "border-[#7A2A1E] bg-[#7A2A1E] text-[#F2EAD8]"
                        : "border-[#D9CDB0] text-[#0F1310]/75 hover:border-[#C28840]"
                    }`}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Who's eating */}
          <div>
            <label className="font-mono text-xs uppercase tracking-[0.16em] text-[#0F1310]/65">
              Who&apos;s at the table?
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {PARTY_SIZE_OPTIONS.map((opt) => {
                const selected = partySize === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPartySize(opt.value)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      selected
                        ? "border-[#7A2A1E] bg-[#7A2A1E]/8 text-[#0F1310]"
                        : "border-[#D9CDB0] text-[#0F1310]/75 hover:border-[#C28840]"
                    }`}
                  >
                    <span className="text-base leading-none">{opt.emoji}</span>
                    <span className="font-sans text-sm">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Monthly budget */}
          <div>
            <label className="font-mono text-xs uppercase tracking-[0.16em] text-[#0F1310]/65">
              Monthly dining budget
            </label>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-serif text-lg text-[#0F1310]/60">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={budget}
                onChange={(e) =>
                  setBudget(e.target.value.replace(/\D/g, "").slice(0, 5))
                }
                className="w-28 border-0 border-b border-[#D9CDB0] bg-transparent pb-1 font-serif text-lg text-[#0F1310] outline-none focus:border-b-[#7A2A1E]"
              />
            </div>
          </div>

          {/* Cook vs dine-out */}
          <div>
            <label className="font-mono text-xs uppercase tracking-[0.16em] text-[#0F1310]/65">
              Cook vs. dine-out (per week)
            </label>
            <p className="mt-2 font-serif text-base text-[#0F1310]">
              {cookNights} cook {cookNights === 1 ? "night" : "nights"} ·{" "}
              {dineOutNights} dine-out
            </p>
            <input
              type="range"
              min={0}
              max={7}
              value={cookNights}
              onChange={(e) => setCookNights(parseInt(e.target.value, 10))}
              className="mt-2 w-full accent-[#7A2A1E]"
            />
          </div>

          {/* Deposit preview */}
          <div className="rounded-lg border border-[#C28840]/40 bg-[#C28840]/6 px-4 py-3">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#C28840]">
              Your cook-night deposit
            </p>
            <p className="mt-1 font-serif text-2xl font-normal text-[#0F1310]">
              +${depositPreview}{" "}
              <span className="font-sans text-sm font-normal text-[#0F1310]/65">
                per night
              </span>
            </p>
            <p className="mt-1 font-sans text-xs text-[#0F1310]/65">
              Based on your budget, nights out, and party size — what you save
              by cooking instead.
            </p>
          </div>

          {error ? (
            <p role="alert" className="font-sans text-sm text-[#7A2A1E]">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => { void handleSubmit(); }}
            disabled={saving}
            className="w-full rounded-xl bg-[#0F1310] px-6 py-4 font-sans text-base font-semibold text-[#F2EAD8] transition-colors duration-200 hover:bg-[#C28840] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : isSettingsMode
                ? "Save changes"
                : "See this week's plan"}
          </button>
        </div>
      </div>
    </div>
  );
}
