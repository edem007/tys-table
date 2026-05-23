import Anthropic from "@anthropic-ai/sdk";
import type { FeedItem } from "./dallas-feed";

export type WeeklyRestaurantPick = {
  name: string;
  rating?: number;
  priceRange?: string;
  why: string;
};

export type WeeklyEntertainment = {
  name: string;
  kind: string;
  date?: string;
  note: string;
};

export type WeeklySummary = {
  theme: string;
  budget: {
    saved: number;
    target: number;
    note: string;
  };
  restaurantPicks: WeeklyRestaurantPick[];
  costComparison: {
    diningOut: number;
    cooking: number;
    savings: number;
    note: string;
  };
  entertainment: WeeklyEntertainment[];
  plan: string[];
};

export type WeeklySummaryInput = {
  balance: number;
  targetAmount: number;
  fundName: string;
  feed: FeedItem[];
};

const MODEL = "claude-sonnet-4-6";

function num(value: unknown, fallback = 0): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? parseFloat(value)
        : NaN;
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSummary(
  raw: unknown,
  input: WeeklySummaryInput,
): WeeklySummary {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;

  const budgetObj = (o.budget ?? {}) as Record<string, unknown>;
  const costObj = (o.costComparison ?? {}) as Record<string, unknown>;

  const restaurantPicks = Array.isArray(o.restaurantPicks)
    ? (o.restaurantPicks as unknown[])
        .map((p) => {
          const r = (p ?? {}) as Record<string, unknown>;
          const name = str(r.name);
          if (!name) return null;
          const pick: WeeklyRestaurantPick = {
            name,
            why: str(r.why) || "A standout pick for Ty this week.",
          };
          const rating = num(r.rating, NaN);
          if (Number.isFinite(rating) && rating > 0) {
            pick.rating = Math.min(5, rating);
          }
          const priceRange = str(r.priceRange);
          if (priceRange) pick.priceRange = priceRange;
          return pick;
        })
        .filter((x): x is WeeklyRestaurantPick => x !== null)
        .slice(0, 4)
    : [];

  const entertainment = Array.isArray(o.entertainment)
    ? (o.entertainment as unknown[])
        .map((e) => {
          const r = (e ?? {}) as Record<string, unknown>;
          const name = str(r.name);
          if (!name) return null;
          const item: WeeklyEntertainment = {
            name,
            kind: str(r.kind) || "Experience",
            note: str(r.note) || "",
          };
          const date = str(r.date);
          if (date) item.date = date;
          return item;
        })
        .filter((x): x is WeeklyEntertainment => x !== null)
        .slice(0, 3)
    : [];

  const plan = Array.isArray(o.plan)
    ? (o.plan as unknown[])
        .map((p) => str(p))
        .filter(Boolean)
        .slice(0, 7)
    : [];

  const diningOut = num(costObj.diningOut);
  const cooking = num(costObj.cooking);

  return {
    theme: str(o.theme) || "A Balanced Week",
    budget: {
      saved: num(budgetObj.saved, input.balance),
      target: num(budgetObj.target, input.targetAmount),
      note: str(budgetObj.note) || "",
    },
    restaurantPicks,
    costComparison: {
      diningOut,
      cooking,
      savings: num(costObj.savings, Math.max(0, diningOut - cooking)),
      note: str(costObj.note) || "",
    },
    entertainment,
    plan,
  };
}

function parseSummaryJson(
  text: string,
  input: WeeklySummaryInput,
): WeeklySummary {
  const trimmed = text.trim();
  const match = trimmed.match(/\{[\s\S]*\}/);
  const raw = match ? match[0] : trimmed;
  return normalizeSummary(JSON.parse(raw), input);
}

/** Generate Ty's weekly brief from her bank state and the Dallas feed. */
export async function generateWeeklySummary(
  input: WeeklySummaryInput,
): Promise<WeeklySummary> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const progressPct =
    input.targetAmount > 0
      ? Math.round((input.balance / input.targetAmount) * 100)
      : 0;

  const feedLines = input.feed
    .map((f) => {
      const bits = [
        f.category,
        f.name,
        f.kind,
        f.rating ? `${f.rating}★` : "",
        f.priceRange ?? "",
        f.neighborhood ?? "",
        f.date ?? "",
      ]
        .filter(Boolean)
        .join(" | ");
      return `- ${bits}`;
    })
    .join("\n");

  const anthropic = new Anthropic({ apiKey });

  const system = `You are Ty's lifestyle strategist in Dallas. Write her Sunday weekly brief.

Ty's tastes: soul food, Italian, African cuisines; lounge culture, intimate vibes, unique experiences. Monthly dining budget ~$400, planning 4 cook nights and 3 dine-out nights per week.

Savings fund "${input.fundName}": $${input.balance} of $${input.targetAmount} (${progressPct}%). Each logged cook night adds $16 to the fund.

This week's curated Dallas options:
${feedLines || "(none available — use your Dallas knowledge)"}

Respond with ONLY a JSON object (no markdown, no code fences):
{
  "theme": "string — a short evocative theme for the week, e.g. 'Soul Food & Slow Nights'",
  "budget": { "saved": ${input.balance}, "target": ${input.targetAmount}, "note": "string — one encouraging sentence on her progress" },
  "restaurantPicks": [ { "name": "string", "rating": number, "priceRange": "$$", "why": "string" } ],
  "costComparison": { "diningOut": number, "cooking": number, "savings": number, "note": "string — what the savings means for her fund" },
  "entertainment": [ { "name": "string", "kind": "string", "date": "YYYY-MM-DD", "note": "string" } ],
  "plan": [ "string — one line per day, e.g. 'Mon — Cook: jollof rice ($14)'. Mix 4 cook nights and 3 dine-out nights." ]
}

Pick 2-3 restaurantPicks and 2 entertainment items from the curated options when they fit. costComparison should reflect a realistic week: total dining-out spend vs. cooking those same nights at home.`;

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system,
    messages: [
      {
        role: "user",
        content: "Write Ty's weekly brief. Return the JSON object only.",
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from model");
  }

  return parseSummaryJson(textBlock.text, input);
}
