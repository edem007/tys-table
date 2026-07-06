export type WeeklySummaryRestaurant = {
  name: string;
  dayLabel: string;
};

export type WeeklySummary = {
  cookNightsCompleted: number;
  cookNightsPlanned: number;
  savedThisWeek: number;
  restaurantsChosen: WeeklySummaryRestaurant[];
  headline: string;
};

export type PlanDayRow = {
  day_type: "cook" | "eat-out";
  completed: boolean;
  recipe: { title?: string } | null;
  chosen_restaurant_id: string | null;
  restaurant_options: { id: string; name: string }[] | null;
  day_date: string;
};

function dayLabelFor(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

/** Builds a deterministic weekly recap from a user's plan_days — no LLM call needed. */
export function summarizeWeeklyPlan(
  days: PlanDayRow[],
  savedSoFar: number,
): WeeklySummary {
  const cookDays = days.filter((d) => d.day_type === "cook");
  const cookNightsCompleted = cookDays.filter((d) => d.completed).length;

  const restaurantsChosen: WeeklySummaryRestaurant[] = days
    .filter((d) => d.day_type === "eat-out" && d.chosen_restaurant_id)
    .map((d) => {
      const match = d.restaurant_options?.find((r) => r.id === d.chosen_restaurant_id);
      return { name: match?.name ?? "A chosen spot", dayLabel: dayLabelFor(d.day_date) };
    });

  const headline =
    cookNightsCompleted === 0
      ? "A quiet week on the stove — next week's a fresh start."
      : cookNightsCompleted === cookDays.length && cookDays.length > 0
        ? `Perfect week — all ${cookDays.length} cook nights done.`
        : `${cookNightsCompleted} of ${cookDays.length} cook nights done this week.`;

  return {
    cookNightsCompleted,
    cookNightsPlanned: cookDays.length,
    savedThisWeek: savedSoFar,
    restaurantsChosen,
    headline,
  };
}
