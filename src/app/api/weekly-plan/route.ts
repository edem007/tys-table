import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  chooseRestaurantForDay,
  createWeeklyPlan,
  getWeeklyPlan,
  markPlanDayCooked,
  type NewPlanDay,
  type PlanRecipe,
  type PlanRestaurantOption,
} from "@/lib/supabase/queries";
import { getPreferences } from "@/lib/supabase/queries";
import { computeCookNightDeposit } from "@/lib/preferences";
import { currentWeekStart, DAY_LABELS } from "@/lib/plan-week";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}

function distributeDayTypes(cookNights: number): ("cook" | "eat-out")[] {
  const total = 7;
  const eatOutNights = total - cookNights;
  const days: ("cook" | "eat-out")[] = new Array(total).fill("cook");
  if (eatOutNights <= 0) return days;
  const step = total / eatOutNights;
  for (let i = 0; i < eatOutNights; i++) {
    const idx = Math.min(total - 1, Math.round(i * step));
    days[idx] = "eat-out";
  }
  return days;
}

/** GET /api/weekly-plan — the authenticated user's plan for the current week. */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const weekStart = currentWeekStart();
    const result = await getWeeklyPlan(supabase, user.id, weekStart);
    return NextResponse.json({ weekStart, plan: result?.plan ?? null, days: result?.days ?? [] });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

/** POST /api/weekly-plan — generate (or regenerate) this week's plan from stored preferences. */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const prefs = await getPreferences(supabase, user.id);
    const { data: profile } = await supabase.from("profiles").select("city").eq("id", user.id).single();
    const city = profile?.city ?? "Dallas";

    const cookNights = Math.max(0, Math.min(7, prefs.cookNights));
    const dayTypes = distributeDayTypes(cookNights);
    const cookCount = dayTypes.filter((d) => d === "cook").length;
    const eatOutCount = 7 - cookCount;
    const perNightBudget = prefs.monthlyBudget / 4.33 / Math.max(1, 7) * (eatOutCount > 0 ? 7 / eatOutCount : 1);
    const perPersonBudget = perNightBudget / Math.max(1, prefs.partySize);

    const origin = req.nextUrl.origin;
    // Internal server-to-server calls don't carry the browser's session
    // cookies by default — forward them so proxy.ts's auth check passes.
    const cookieHeader = req.headers.get("cookie") ?? "";
    const cuisineParam = prefs.cuisines.join(",");
    const allergyParam = prefs.allergies.join(",");

    let recipes: PlanRecipe[] = [];
    if (cookCount > 0) {
      const recipesRes = await fetch(
        `${origin}/api/recipes?cuisines=${encodeURIComponent(cuisineParam)}&allergies=${encodeURIComponent(allergyParam)}&count=${cookCount}`,
        { headers: { cookie: cookieHeader } },
      );
      if (recipesRes.ok) {
        const data = (await recipesRes.json()) as { recipes: PlanRecipe[] };
        recipes = data.recipes ?? [];
      }
    }

    const cuisinesForRotation = prefs.cuisines.length ? prefs.cuisines : ["soul food"];
    // Rotate by eat-out ordinal, not day-of-week index — indexing by day made
    // different eat-out days collide on the same cuisine and skip others.
    let eatOutOrdinal = 0;
    const restaurantOptionsPerDay = await Promise.all(
      dayTypes.map(async (type) => {
        if (type !== "eat-out") return null;
        const cuisine = cuisinesForRotation[eatOutOrdinal++ % cuisinesForRotation.length];
        const res = await fetch(
          `${origin}/api/restaurants?cuisine=${encodeURIComponent(cuisine)}&city=${encodeURIComponent(city)}&budgetPerPerson=${Math.round(perPersonBudget)}&minRating=4.3`,
          { headers: { cookie: cookieHeader } },
        );
        if (!res.ok) return [] as PlanRestaurantOption[];
        const data = (await res.json()) as { restaurants: PlanRestaurantOption[] };
        return data.restaurants ?? [];
      }),
    );

    const weekStart = currentWeekStart();
    const weekStartDate = new Date(`${weekStart}T00:00:00Z`);
    let recipeCursor = 0;

    const days: NewPlanDay[] = dayTypes.map((type, i) => {
      const date = new Date(weekStartDate);
      date.setUTCDate(date.getUTCDate() + i);
      const dateStr = date.toISOString().slice(0, 10);

      if (type === "cook") {
        const recipe = recipes.length > 0 ? recipes[recipeCursor % recipes.length] : undefined;
        recipeCursor += 1;
        return { date: dateStr, dayType: "cook", recipe };
      }
      return { date: dateStr, dayType: "eat-out", restaurantOptions: restaurantOptionsPerDay[i] ?? [] };
    });

    const result = await createWeeklyPlan(supabase, user.id, weekStart, days);
    return NextResponse.json({ weekStart, plan: result.plan, days: result.days, dayLabels: DAY_LABELS });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

/**
 * PATCH /api/weekly-plan
 * Body: { action: "cook", planDayId, weeklyPlanId, recipeCostPerServing }
 *    or { action: "choose-restaurant", planDayId, weeklyPlanId, restaurantId }
 */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json()) as {
      action: "cook" | "choose-restaurant";
      planDayId: string;
      weeklyPlanId: string;
      recipeCostPerServing?: number;
      restaurantId?: string;
    };

    if (body.action === "cook") {
      const prefs = await getPreferences(supabase, user.id);
      const perNightBudget = prefs.monthlyBudget / (Math.max(1, 7 - prefs.cookNights) * 4.33);
      const cookCost = (body.recipeCostPerServing ?? 6) * prefs.partySize;
      const amountSaved = Math.max(4, Math.round(perNightBudget - cookCost));

      await markPlanDayCooked(supabase, body.planDayId, body.weeklyPlanId, user.id, amountSaved);
      return NextResponse.json({ ok: true, amountSaved });
    }

    if (body.action === "choose-restaurant" && body.restaurantId) {
      await chooseRestaurantForDay(supabase, body.planDayId, body.weeklyPlanId, body.restaurantId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
