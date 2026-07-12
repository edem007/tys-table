"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Onboarding from "./Onboarding";
import type { PlanRecipe, PlanRestaurantOption } from "@/lib/supabase/queries";

type PlanDay = {
  id: string;
  weekly_plan_id: string;
  day_date: string;
  day_type: "cook" | "eat-out";
  recipe: PlanRecipe | null;
  restaurant_options: PlanRestaurantOption[] | null;
  chosen_restaurant_id: string | null;
  completed: boolean;
};

type WeeklyPlanRow = {
  id: string;
  saved_so_far: number;
};

type LoadedPrefs = {
  name?: string;
  cuisines?: string[];
  monthlyBudget?: number;
  cookNights?: number;
  partySize?: number;
  allergies?: string[];
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayLabelFromDate(dateStr: string): string {
  const idx = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return DAY_LABELS[idx === 0 ? 6 : idx - 1];
}

function isSameDay(dateStr: string) {
  const today = new Date().toISOString().slice(0, 10);
  return dateStr === today;
}

export default function Home() {
  const [plan, setPlan] = useState<WeeklyPlanRow | null>(null);
  const [days, setDays] = useState<PlanDay[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loadedPrefs, setLoadedPrefs] = useState<LoadedPrefs | null>(null);
  const [userName, setUserName] = useState("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  async function handleSignOut() {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  async function loadPlan() {
    const res = await fetch("/api/weekly-plan");
    if (!res.ok) return null;
    return (await res.json()) as { plan: WeeklyPlanRow | null; days: PlanDay[] };
  }

  async function generatePlan() {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/weekly-plan", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Could not plan your week (${res.status}). Please try again.`);
      }
      const data = (await res.json()) as { plan: WeeklyPlanRow; days: PlanDay[] };
      setPlan(data.plan);
      setDays(data.days);
      const todayIdx = data.days.findIndex((d) => isSameDay(d.day_date));
      setSelectedIdx(todayIdx >= 0 ? todayIdx : 0);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not plan your week.");
    } finally {
      setIsGenerating(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadPrefs() {
      try {
        const res = await fetch("/api/preferences");
        if (!res.ok) return;
        const data = (await res.json()) as {
          onboarded?: boolean;
          name?: string;
          cuisines?: string[];
          monthlyBudget?: number;
          cookNights?: number;
          partySize?: number;
          allergies?: string[];
        };
        if (cancelled) return;
        if (!data.onboarded) {
          setShowOnboarding(true);
          setIsLoading(false);
          return;
        }
        if (data.name) setUserName(data.name);
        setLoadedPrefs(data);

        const existing = await loadPlan();
        if (cancelled) return;
        if (existing?.plan) {
          setPlan(existing.plan);
          setDays(existing.days);
          const todayIdx = existing.days.findIndex((d) => isSameDay(d.day_date));
          setSelectedIdx(todayIdx >= 0 ? todayIdx : 0);
          setIsLoading(false);
        } else {
          setIsLoading(false);
          await generatePlan();
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setIsLoading(false);
      }
    }

    loadPrefs();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function markCooked(day: PlanDay) {
    if (!plan || !day.recipe) return;
    const res = await fetch("/api/weekly-plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "cook",
        planDayId: day.id,
        weeklyPlanId: plan.id,
        recipeCostPerServing: day.recipe.costPerServing,
      }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { amountSaved: number };
    setPlan((p) => (p ? { ...p, saved_so_far: p.saved_so_far + data.amountSaved } : p));
    setDays((prev) => prev.map((d) => (d.id === day.id ? { ...d, completed: true } : d)));
  }

  async function chooseRestaurant(day: PlanDay, restaurantId: string) {
    if (!plan) return;
    const res = await fetch("/api/weekly-plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "choose-restaurant",
        planDayId: day.id,
        weeklyPlanId: plan.id,
        restaurantId,
      }),
    });
    if (!res.ok) return;
    setDays((prev) =>
      prev.map((d) => (d.id === day.id ? { ...d, chosen_restaurant_id: restaurantId, completed: true } : d)),
    );
  }

  const selectedDay = days[selectedIdx];
  const initials = userName ? userName.charAt(0).toUpperCase() : "?";

  return (
    <>
      {showOnboarding ? (
        <Onboarding
          initialValues={loadedPrefs ?? undefined}
          onClose={loadedPrefs ? () => setShowOnboarding(false) : undefined}
          onComplete={(prefs) => {
            setShowOnboarding(false);
            if (prefs.name) setUserName(prefs.name);
            void generatePlan();
          }}
        />
      ) : null}

      <div className="min-h-[100dvh] bg-[#FDF9F7] text-[#2E2A27]">
        <main className="mx-auto w-full max-w-md px-5 pb-16 pt-8">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#8A8178]">
                {userName ? `Hi ${userName} 👋` : "Welcome"}
              </p>
              <h1 className="text-2xl font-bold text-[#2E2A27]">This week&rsquo;s table</h1>
            </div>
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((o) => !o)}
                aria-label="Account menu"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2E2A27] text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#2E2A27]/90"
              >
                {initials}
              </button>
              {profileMenuOpen ? (
                <div className="absolute right-0 top-12 z-50 min-w-[190px] rounded-2xl border border-[#F0E6D8] bg-white p-2 shadow-xl">
                  {userName ? (
                    <div className="px-3 py-1.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-[#8A8178]">{userName}</p>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setShowOnboarding(true);
                    }}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm text-[#2E2A27]/80 transition-colors hover:bg-[#FDF9F7]"
                  >
                    Settings
                  </button>
                  <div className="my-1 border-t border-[#F0E6D8]" />
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      void handleSignOut();
                    }}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm text-[#B5533E] hover:bg-[#FBF1EC]"
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {errorMessage ? (
            <p role="alert" className="mb-4 text-sm text-[#B5533E]">
              {errorMessage}
            </p>
          ) : null}

          {isLoading || isGenerating ? (
            <div className="flex flex-col items-center gap-3 rounded-3xl bg-white py-16 shadow-sm">
              <p className="text-sm text-[#8A8178]">
                {isGenerating ? "Matching restaurants & recipes…" : "Setting your table…"}
              </p>
            </div>
          ) : (
            <>
              {/* Savings banner */}
              <div className="flex items-center justify-between rounded-3xl bg-[#E4EFDF] px-6 py-5 shadow-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#89B87E]">
                    Saved by cooking this week
                  </p>
                  <p className="mt-1 text-3xl font-bold text-[#2E2A27]">${plan?.saved_so_far ?? 0}</p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
                  🌱
                </div>
              </div>

              {/* Day strip */}
              <div className="mt-6 flex gap-2.5 overflow-x-auto pb-1">
                {days.map((d, i) => {
                  const isCook = d.day_type === "cook";
                  const active = i === selectedIdx;
                  return (
                    <button
                      key={d.id}
                      onClick={() => setSelectedIdx(i)}
                      className={[
                        "flex min-w-[64px] flex-col items-center gap-1.5 rounded-2xl px-3 py-3 transition-all",
                        active ? "bg-[#2E2A27] shadow-md" : "bg-white shadow-sm",
                      ].join(" ")}
                    >
                      <span
                        className={`text-[11px] font-semibold uppercase tracking-wide ${active ? "text-white/60" : "text-[#8A8178]"}`}
                      >
                        {dayLabelFromDate(d.day_date)}
                      </span>
                      <span className={`text-lg ${active ? "text-white" : "text-[#2E2A27]"}`}>
                        {isCook ? "🍳" : "🍽️"}
                      </span>
                      <span
                        className={[
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          isCook
                            ? active
                              ? "bg-[#89B87E]/30 text-white"
                              : "bg-[#E4EFDF] text-[#89B87E]"
                            : active
                              ? "bg-[#8FC7D3]/30 text-white"
                              : "bg-[#DCEEF2] text-[#8FC7D3]",
                        ].join(" ")}
                      >
                        {isCook ? "Cook" : "Eat out"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Selected day detail */}
              {selectedDay ? (
                <div className="mt-6">
                  {selectedDay.day_type === "cook" && selectedDay.recipe ? (
                    <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
                      <div className="relative h-48 w-full">
                        <Image
                          src={selectedDay.recipe.image}
                          alt={selectedDay.recipe.title}
                          fill
                          className="object-cover"
                        />
                        <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[#89B87E]">
                          {dayLabelFromDate(selectedDay.day_date)} · Cook night
                        </div>
                      </div>
                      <div className="p-6">
                        <h2 className="text-xl font-bold text-[#2E2A27]">{selectedDay.recipe.title}</h2>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#8A8178]">
                          <span>⏱ {selectedDay.recipe.prepMinutes + selectedDay.recipe.cookMinutes} min</span>
                          <span>🍽 Serves {selectedDay.recipe.baseServings}</span>
                          <span className="capitalize">🌍 {selectedDay.recipe.cuisine}</span>
                        </div>
                        <span className="mt-3 inline-block rounded-full bg-[#E4EFDF] px-3 py-1 text-xs font-medium text-[#89B87E]">
                          Matches your allergy preferences ✓
                        </span>

                        <h3 className="mb-2 mt-6 font-semibold text-[#2E2A27]">Ingredients</h3>
                        <ul className="space-y-1.5 text-sm text-[#2E2A27]/80">
                          {selectedDay.recipe.ingredients.map((ing, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="text-[#E5A78D]">•</span>
                              {ing}
                            </li>
                          ))}
                        </ul>

                        <h3 className="mb-2 mt-6 font-semibold text-[#2E2A27]">Instructions</h3>
                        <ol className="space-y-3 text-sm text-[#2E2A27]/80">
                          {selectedDay.recipe.instructions.map((step, i) => (
                            <li key={i} className="flex gap-3">
                              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#FBF1EC] text-xs font-semibold text-[#E5A78D]">
                                {i + 1}
                              </span>
                              <span className="pt-0.5">{step}</span>
                            </li>
                          ))}
                        </ol>

                        <div className="mt-6">
                          {selectedDay.completed ? (
                            <div className="rounded-2xl bg-[#E4EFDF] py-4 text-center font-semibold text-[#89B87E]">
                              Cooked! 🎉
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void markCooked(selectedDay)}
                              className="w-full rounded-2xl bg-[#E5A78D] py-4 text-base font-semibold text-white shadow-md transition-transform active:scale-[0.98]"
                            >
                              Mark as cooked
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {selectedDay.day_type === "eat-out" && selectedDay.restaurant_options ? (
                    <div>
                      <h2 className="mb-1 text-2xl font-bold text-[#2E2A27]">
                        {dayLabelFromDate(selectedDay.day_date)}&rsquo;s picks
                      </h2>
                      <p className="mb-4 text-sm text-[#8A8178]">
                        4.3+ rated and matched to your budget. Restaurant menus aren&rsquo;t
                        allergy-verified — always mention your allergies when you order.
                      </p>
                      {selectedDay.restaurant_options.length === 0 ? (
                        <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
                          <p className="text-sm text-[#8A8178]">
                            We couldn&rsquo;t find restaurants matching your preferences for
                            this night. Try adjusting your cuisines or budget in Settings,
                            then your plan will refresh.
                          </p>
                        </div>
                      ) : null}
                      <div className="space-y-3">
                        {selectedDay.restaurant_options.map((r) => (
                          <div key={r.id} className="overflow-hidden rounded-3xl bg-white shadow-sm">
                            <div className="relative h-36 w-full">
                              {/* eslint-disable-next-line @next/next/no-img-element -- proxied dynamic Google Places photo, already sized server-side */}
                              <img src={r.image} alt={r.name} className="h-full w-full object-cover" />
                            </div>
                            <div className="p-5">
                              <h3 className="font-bold text-[#2E2A27]">{r.name}</h3>
                              <p className="text-xs text-[#8A8178]">
                                ★ {r.rating} · {"$".repeat(r.priceTier)} · ~${r.estCostPerPerson}/person
                              </p>
                              <p className="text-xs text-[#8A8178]">{r.neighborhood}</p>
                              <p className="mt-2 text-sm text-[#2E2A27]/80">{r.blurb}</p>
                              <div className="mt-4">
                                {selectedDay.chosen_restaurant_id === r.id ? (
                                  <div className="rounded-2xl bg-[#E4EFDF] py-3 text-center text-sm font-semibold text-[#89B87E]">
                                    Chosen ✓
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => void chooseRestaurant(selectedDay, r.id)}
                                    className={[
                                      "w-full rounded-2xl py-3 text-sm font-semibold transition-transform active:scale-[0.98]",
                                      selectedDay.chosen_restaurant_id
                                        ? "border border-[#2E2A27]/20 text-[#2E2A27]/70"
                                        : "bg-[#2E2A27] text-white shadow-md",
                                    ].join(" ")}
                                  >
                                    Choose this
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </main>
      </div>
    </>
  );
}
