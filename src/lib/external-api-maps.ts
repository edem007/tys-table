// Maps this app's cuisine/allergy vocabulary (see src/lib/preferences.ts)
// onto the vocabularies expected by Spoonacular and Google Places.

export const CUISINE_TO_SPOONACULAR: Record<string, string> = {
  "soul food": "Southern",
  italian: "Italian",
  african: "African",
  mexican: "Mexican",
  caribbean: "Caribbean",
  mediterranean: "Mediterranean",
  japanese: "Japanese",
  thai: "Thai",
  indian: "Indian",
  "southern bbq": "Southern",
};

export const ALLERGEN_TO_SPOONACULAR: Record<string, string> = {
  peanuts: "Peanut",
  "tree nuts": "Tree Nut",
  shellfish: "Shellfish",
  dairy: "Dairy",
  gluten: "Gluten",
  eggs: "Egg",
  soy: "Soy",
  fish: "Seafood",
  sesame: "Sesame",
};

export const CUISINE_TO_SEARCH_KEYWORD: Record<string, string> = {
  "soul food": "soul food",
  italian: "Italian",
  african: "African",
  mexican: "Mexican",
  caribbean: "Caribbean",
  mediterranean: "Mediterranean",
  japanese: "Japanese",
  thai: "Thai",
  indian: "Indian",
  "southern bbq": "BBQ",
};

export function priceLevelsForBudget(budgetPerPerson: number): string[] {
  if (budgetPerPerson <= 20) return ["PRICE_LEVEL_INEXPENSIVE"];
  if (budgetPerPerson <= 35) return ["PRICE_LEVEL_INEXPENSIVE", "PRICE_LEVEL_MODERATE"];
  if (budgetPerPerson <= 60) return ["PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE"];
  return ["PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE"];
}

export function priceLevelToTier(level: string | undefined): 1 | 2 | 3 | 4 {
  switch (level) {
    case "PRICE_LEVEL_INEXPENSIVE":
      return 1;
    case "PRICE_LEVEL_MODERATE":
      return 2;
    case "PRICE_LEVEL_EXPENSIVE":
      return 3;
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return 4;
    default:
      return 2;
  }
}
