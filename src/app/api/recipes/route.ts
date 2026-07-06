import { NextResponse, type NextRequest } from "next/server";
import type { PlanRecipe } from "@/lib/supabase/queries";
import { ALLERGEN_TO_SPOONACULAR, CUISINE_TO_SPOONACULAR } from "@/lib/external-api-maps";

export const dynamic = "force-dynamic";

interface SpoonacularSearchResult {
  id: number;
}

interface SpoonacularBulkInfo {
  id: number;
  title: string;
  image?: string;
  readyInMinutes?: number;
  servings?: number;
  pricePerServing?: number;
  extendedIngredients?: { original: string }[];
  analyzedInstructions?: { steps: { step: string }[] }[];
  instructions?: string;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

/**
 * GET /api/recipes?cuisines=soul food,italian&allergies=dairy,gluten&count=4
 * Spoonacular's `intolerances` param is the hard filter — recipes containing
 * a flagged allergen are excluded server-side before they ever reach the client.
 */
export async function GET(req: NextRequest) {
  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Spoonacular API key not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const cuisines = (searchParams.get("cuisines") ?? "").split(",").map((c) => c.trim()).filter(Boolean);
  const allergies = (searchParams.get("allergies") ?? "").split(",").map((a) => a.trim()).filter(Boolean);
  const count = Math.min(10, Math.max(1, Number(searchParams.get("count") ?? "4")));

  const cuisineParam = [...new Set(cuisines.map((c) => CUISINE_TO_SPOONACULAR[c]).filter(Boolean))].join(",");
  const intoleranceParam = [...new Set(allergies.map((a) => ALLERGEN_TO_SPOONACULAR[a]).filter(Boolean))].join(",");

  try {
    const searchUrl = new URL("https://api.spoonacular.com/recipes/complexSearch");
    searchUrl.searchParams.set("apiKey", apiKey);
    searchUrl.searchParams.set("number", String(count));
    searchUrl.searchParams.set("sort", "random");
    searchUrl.searchParams.set("type", "main course");
    searchUrl.searchParams.set("maxServings", "8");
    if (cuisineParam) searchUrl.searchParams.set("cuisine", cuisineParam);
    if (intoleranceParam) searchUrl.searchParams.set("intolerances", intoleranceParam);

    const searchRes = await fetch(searchUrl.toString());
    if (!searchRes.ok) {
      return NextResponse.json(
        { error: "Spoonacular search failed", detail: await searchRes.text() },
        { status: searchRes.status },
      );
    }
    const searchData = (await searchRes.json()) as { results: SpoonacularSearchResult[] };
    const ids = searchData.results.map((r) => r.id);
    if (ids.length === 0) return NextResponse.json({ recipes: [] as PlanRecipe[] });

    const bulkUrl = new URL("https://api.spoonacular.com/recipes/informationBulk");
    bulkUrl.searchParams.set("apiKey", apiKey);
    bulkUrl.searchParams.set("ids", ids.join(","));

    const bulkRes = await fetch(bulkUrl.toString());
    if (!bulkRes.ok) {
      return NextResponse.json(
        { error: "Spoonacular info failed", detail: await bulkRes.text() },
        { status: bulkRes.status },
      );
    }
    const bulkData = (await bulkRes.json()) as SpoonacularBulkInfo[];
    const fallbackCuisine = cuisines[0] ?? "soul food";

    const recipes: PlanRecipe[] = bulkData.map((r) => {
      const ready = r.readyInMinutes ?? 30;
      const prep = Math.max(5, Math.round(ready * 0.3));
      const cook = Math.max(5, ready - prep);
      const steps =
        r.analyzedInstructions?.[0]?.steps?.map((s) => s.step) ??
        (r.instructions ? [stripHtml(r.instructions)] : ["See full instructions at spoonacular.com."]);

      return {
        id: `sp-${r.id}`,
        title: r.title,
        cuisine: fallbackCuisine,
        image: r.image ?? "https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=1200&auto=format&fit=crop",
        prepMinutes: prep,
        cookMinutes: cook,
        baseServings: r.servings ?? 2,
        costPerServing: r.pricePerServing ? r.pricePerServing / 100 : 6,
        ingredients: r.extendedIngredients?.map((i) => i.original.replace(/^[•\-*\s]+/, "").trim()) ?? [],
        instructions: steps,
      };
    });

    return NextResponse.json({ recipes });
  } catch (err) {
    return NextResponse.json({ error: "Unexpected error calling Spoonacular", detail: String(err) }, { status: 500 });
  }
}
