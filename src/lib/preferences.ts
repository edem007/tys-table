export type Preferences = {
  name: string;
  /** Favorite cuisines, e.g. ["soul food", "Italian", "African"]. */
  cuisines: string[];
  /** Monthly dining budget in USD. */
  monthlyBudget: number;
  /** Planned cook nights per week. */
  cookNights: number;
  /** Planned dine-out nights per week. */
  dineOutNights: number;
  /** True once the onboarding wizard has been completed. */
  onboarded: boolean;
};

export const DEFAULT_PREFERENCES: Preferences = {
  name: "Ty",
  cuisines: ["soul food", "Italian", "African"],
  monthlyBudget: 400,
  cookNights: 4,
  dineOutNights: 3,
  onboarded: false,
};

export const CUISINE_OPTIONS = [
  "soul food",
  "Italian",
  "African",
  "Mexican",
  "Caribbean",
  "Mediterranean",
  "Japanese",
  "Thai",
  "Indian",
  "Southern BBQ",
] as const;

export function normalizePreferences(raw: unknown): Preferences {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PREFERENCES };
  const o = raw as Record<string, unknown>;

  const name =
    typeof o.name === "string" && o.name.trim()
      ? o.name.trim().slice(0, 40)
      : DEFAULT_PREFERENCES.name;

  const cuisines = Array.isArray(o.cuisines)
    ? o.cuisines
        .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
        .map((c) => c.trim().slice(0, 30))
        .slice(0, 8)
    : DEFAULT_PREFERENCES.cuisines;

  const monthlyBudget =
    typeof o.monthlyBudget === "number" && Number.isFinite(o.monthlyBudget)
      ? Math.min(5000, Math.max(0, Math.round(o.monthlyBudget)))
      : DEFAULT_PREFERENCES.monthlyBudget;

  const cookNights =
    typeof o.cookNights === "number" && Number.isFinite(o.cookNights)
      ? Math.min(7, Math.max(0, Math.round(o.cookNights)))
      : DEFAULT_PREFERENCES.cookNights;

  const dineOutNights =
    typeof o.dineOutNights === "number" && Number.isFinite(o.dineOutNights)
      ? Math.min(7, Math.max(0, Math.round(o.dineOutNights)))
      : DEFAULT_PREFERENCES.dineOutNights;

  return {
    name,
    cuisines: cuisines.length > 0 ? cuisines : DEFAULT_PREFERENCES.cuisines,
    monthlyBudget,
    cookNights,
    dineOutNights,
    onboarded: o.onboarded === true,
  };
}

/** Join cuisines into a natural-language list: "a, b, and c". */
export function cuisineList(cuisines: string[]): string {
  const list = cuisines.length > 0 ? cuisines : DEFAULT_PREFERENCES.cuisines;
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;
}

/**
 * Build the shared prompt fragment describing the person and their tastes,
 * used by the suggestion, feed, and weekly-summary generators.
 */
export function buildTasteProfile(prefs: Preferences): string {
  return `${prefs.name}'s tastes: ${cuisineList(
    prefs.cuisines,
  )} cuisines. ${prefs.name} loves lounge culture, intimate vibes, and unique dining experiences — not chains or generic picks. Monthly dining budget ~$${prefs.monthlyBudget}, planning ${prefs.cookNights} cook nights and ${prefs.dineOutNights} dine-out nights per week.`;
}
