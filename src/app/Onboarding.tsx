"use client";

import { useState } from "react";
import { CUISINE_OPTIONS, type Preferences } from "@/lib/preferences";

type OnboardingProps = {
  onComplete: (prefs: Preferences) => void;
};

const MIN_TARGET = 20;
const MAX_TARGET = 2000;

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [name, setName] = useState("");
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [budget, setBudget] = useState("400");
  const [cookNights, setCookNights] = useState(4);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("120");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dineOutNights = Math.max(0, 7 - cookNights);

  function toggleCuisine(c: string) {
    setCuisines((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  async function handleSubmit() {
    const trimmedName = name.trim();
    const trimmedGoal = goalName.trim();
    const target = parseInt(goalTarget.replace(/\D/g, ""), 10);
    const monthlyBudget = parseInt(budget.replace(/\D/g, ""), 10);

    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }
    if (cuisines.length === 0) {
      setError("Pick at least one cuisine you love.");
      return;
    }
    if (!trimmedGoal) {
      setError("Name your first savings goal.");
      return;
    }
    if (!Number.isFinite(target) || target < MIN_TARGET || target > MAX_TARGET) {
      setError(`Goal target must be between $${MIN_TARGET} and $${MAX_TARGET}.`);
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
        onboarded: true,
      };

      const [prefsRes] = await Promise.all([
        fetch("/api/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(prefsBody),
        }),
        fetch("/api/fund", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fundName: trimmedGoal, targetAmount: target }),
        }),
      ]);

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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0F1310]/40 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-[#F2EAD8] p-6 shadow-xl min-[600px]:p-8 [animation:celebration-fade-in_0.5s_ease-out_forwards]">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#C28840]">
          Welcome to
        </p>
        <h1 className="mt-1 font-serif text-3xl font-medium italic text-[#0F1310]">
          Ty&apos;s Table
        </h1>
        <p className="mt-2 font-sans text-sm text-[#0F1310]/70">
          A few details so your strategist knows your taste.
        </p>

        <div className="mt-6 space-y-6">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#0F1310]/55">
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

          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#0F1310]/55">
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
                        : "border-[#D9CDB0] text-[#0F1310]/70 hover:border-[#C28840]"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#0F1310]/55">
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

          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#0F1310]/55">
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

          <div className="rounded-lg border border-[#D9CDB0] p-4">
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#0F1310]/55">
              Your first savings goal
            </label>
            <input
              type="text"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value.slice(0, 40))}
              placeholder="e.g. Bishop Arts Dinner"
              className="mt-2 w-full border-0 border-b border-[#D9CDB0] bg-transparent pb-1 font-serif text-base text-[#0F1310] outline-none focus:border-b-[#7A2A1E]"
            />
            <div className="mt-3 flex items-baseline gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#0F1310]/55">
                Target $
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={goalTarget}
                onChange={(e) =>
                  setGoalTarget(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                className="w-24 border-0 border-b border-[#D9CDB0] bg-transparent pb-1 font-serif text-base text-[#0F1310] outline-none focus:border-b-[#7A2A1E]"
              />
            </div>
          </div>

          {error ? (
            <p role="alert" className="font-sans text-sm text-[#7A2A1E]">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => {
              void handleSubmit();
            }}
            disabled={saving}
            className="w-full rounded-xl bg-[#0F1310] px-6 py-4 font-sans text-base font-semibold text-[#F2EAD8] transition-colors duration-200 hover:bg-[#C28840] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Setting your table..." : "Start saving"}
          </button>
        </div>
      </div>
    </div>
  );
}
