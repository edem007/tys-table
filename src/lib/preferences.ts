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
  /** Number of people cooking/dining together (1, 2, 3–4, 5+). */
  partySize: number;
  /** Food allergies to hard-filter out of recipe and restaurant matches. */
  allergies: string[];
  /** True once the onboarding wizard has been completed. */
  onboarded: boolean;
};

export const DEFAULT_PREFERENCES: Preferences = {
  name: "Ty",
  cuisines: ["soul food", "Italian", "African"],
  monthlyBudget: 400,
  cookNights: 4,
  dineOutNights: 3,
  partySize: 2,
  allergies: [],
  onboarded: false,
};

export const ALLERGEN_OPTIONS = [
  "peanuts",
  "tree nuts",
  "shellfish",
  "dairy",
  "gluten",
  "eggs",
  "soy",
  "fish",
  "sesame",
] as const;

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

  const partySize =
    typeof o.partySize === "number" && Number.isFinite(o.partySize)
      ? Math.min(20, Math.max(1, Math.round(o.partySize)))
      : DEFAULT_PREFERENCES.partySize;

  const allergies = Array.isArray(o.allergies)
    ? o.allergies
        .filter((a): a is string => typeof a === "string" && a.trim().length > 0)
        .map((a) => a.trim().toLowerCase().slice(0, 20))
        .slice(0, 9)
    : DEFAULT_PREFERENCES.allergies;

  return {
    name,
    cuisines: cuisines.length > 0 ? cuisines : DEFAULT_PREFERENCES.cuisines,
    monthlyBudget,
    cookNights,
    dineOutNights,
    partySize,
    allergies,
    onboarded: o.onboarded === true,
  };
}

/**
 * Calculate how much to bank per cook night based on the user's preferences.
 *
 * Logic: the deposit = what they would have spent dining out minus the
 * estimated cost of cooking the same meal at home.
 *
 * Cooking cost ratio by party size:
 *   1 person  → ~25% of dining-out cost (solo cooking is very cheap)
 *   2 people  → ~35%
 *   3–4 people → ~45%
 *   5+ people  → ~50%
 */
export function computeCookNightDeposit(prefs: {
  monthlyBudget: number;
  dineOutNights: number;
  partySize: number;
}): number {
  const { monthlyBudget, dineOutNights, partySize } = prefs;

  // Avoid divide-by-zero if they never dine out
  if (dineOutNights <= 0 || monthlyBudget <= 0) return 10;

  // Average dine-out nights per month (4.33 weeks/month)
  const dineOutPerMonth = dineOutNights * 4.33;
  const dineOutCostPerNight = monthlyBudget / dineOutPerMonth;

  // Fraction of dine-out cost that cooking costs
  const cookingRatio =
    partySize <= 1 ? 0.25
    : partySize === 2 ? 0.35
    : partySize <= 4 ? 0.45
    : 0.50;

  const savings = dineOutCostPerNight * (1 - cookingRatio);

  // Round to nearest dollar, minimum $5
  return Math.max(5, Math.round(savings));
}
