import { NextResponse, type NextRequest } from "next/server";
import type { PlanRestaurantOption } from "@/lib/supabase/queries";
import { CUISINE_TO_SEARCH_KEYWORD, priceLevelToTier, priceLevelsForBudget } from "@/lib/external-api-maps";

export const dynamic = "force-dynamic";

interface PlacesResult {
  id: string;
  displayName?: { text: string };
  rating?: number;
  priceLevel?: string;
  formattedAddress?: string;
  editorialSummary?: { text: string };
  photos?: { name: string }[];
}

/**
 * GET /api/restaurants?cuisine=soul food&city=Dallas, TX&budgetPerPerson=35&minRating=4.3
 * Note: Google Places has no per-dish allergen data — this only guarantees
 * cuisine/rating/budget match, not allergy safety. The UI should say so.
 */
export async function GET(req: NextRequest) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Google Places API key not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const cuisine = searchParams.get("cuisine") ?? "soul food";
  const city = searchParams.get("city") ?? "Dallas, TX";
  const budgetPerPerson = Number(searchParams.get("budgetPerPerson") ?? "35");
  const minRating = Number(searchParams.get("minRating") ?? "4.3");

  const keyword = CUISINE_TO_SEARCH_KEYWORD[cuisine] ?? cuisine;
  const textQuery = `${keyword} restaurants in ${city}`;

  async function searchPlaces(priceLevels?: string[]): Promise<PlacesResult[] | Response> {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey!,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.rating,places.priceLevel,places.formattedAddress,places.editorialSummary,places.photos",
      },
      body: JSON.stringify({
        textQuery,
        minRating,
        ...(priceLevels ? { priceLevels } : {}),
        maxResultCount: 8,
      }),
    });
    if (!res.ok) return res;
    const data = (await res.json()) as { places?: PlacesResult[] };
    return data.places ?? [];
  }

  try {
    // Strict pass first (budget-matched price levels); some cuisine/city combos
    // have no 4.3+ places at the cheapest tier, so fall back to any price
    // rather than leaving the day with zero picks.
    let places = await searchPlaces(priceLevelsForBudget(budgetPerPerson));
    if (Array.isArray(places) && places.length === 0) {
      places = await searchPlaces(undefined);
    }

    if (!Array.isArray(places)) {
      return NextResponse.json(
        { error: "Google Places search failed", detail: await places.text() },
        { status: places.status },
      );
    }

    const restaurants: PlanRestaurantOption[] = places
      .filter((p) => (p.rating ?? 0) >= minRating)
      .map((p) => {
        const photoName = p.photos?.[0]?.name;
        return {
          id: p.id,
          name: p.displayName?.text ?? "Unnamed restaurant",
          cuisine,
          rating: p.rating ?? minRating,
          priceTier: priceLevelToTier(p.priceLevel),
          estCostPerPerson: budgetPerPerson,
          neighborhood: p.formattedAddress ?? city,
          image: photoName
            ? `/api/restaurants/photo?ref=${encodeURIComponent(photoName)}`
            : "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=1200&auto=format&fit=crop",
          blurb: p.editorialSummary?.text ?? "A highly-rated spot matched to your cuisine and budget.",
        } satisfies PlanRestaurantOption;
      });

    return NextResponse.json({ restaurants });
  } catch (err) {
    return NextResponse.json({ error: "Unexpected error calling Google Places", detail: String(err) }, { status: 500 });
  }
}
