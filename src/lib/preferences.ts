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

  const partySize =
    typeof o.partySize === "number" && Number.isFinite(o.partySize)
      ? Math.min(20, Math.max(1, Math.round(o.partySize)))
      : DEFAULT_PREFERENCES.partySize;

  return {
    name,
    cuisines: cuisines.length > 0 ? cuisines : DEFAULT_PREFERENCES.cuisines,
    monthlyBudget,
    cookNights,
    dineOutNights,
    partySize,
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
  const partySizeLabel =
    prefs.partySize === 1 ? "cooking solo"
    : prefs.partySize === 2 ? "cooking for two"
    : `cooking for ${prefs.partySize}`;

  return `${prefs.name}'s tastes: ${cuisineList(
    prefs.cuisines,
  )} cuisines. ${prefs.name} loves lounge culture, intimate vibes, and unique dining experiences — not chains or generic picks. Monthly dining budget ~$${prefs.monthlyBudget}, planning ${prefs.cookNights} cook nights and ${prefs.dineOutNights} dine-out nights per week, ${partySizeLabel}.`;
}
