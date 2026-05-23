import Anthropic from "@anthropic-ai/sdk";

export type FeedCategory = "restaurant" | "event" | "nightlife";

export type FeedItem = {
  category: FeedCategory;
  name: string;
  /** Cuisine for restaurants, or the kind of event/venue otherwise. */
  kind: string;
  /** 4.0–5.0 for restaurants; omitted for events. */
  rating?: number;
  /** "$", "$$", "$$$", "$$$$" — approximate. */
  priceRange?: string;
  neighborhood?: string;
  /** ISO date (YYYY-MM-DD) for time-bound events. */
  date?: string;
  description: string;
  /** One sentence on why this fits Ty's tastes. */
  whyTy: string;
};

const MODEL = "claude-sonnet-4-6";

function clampRating(value: unknown): number | undefined {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? parseFloat(value)
        : NaN;
  if (!Number.isFinite(n)) return undefined;
  return Math.min(5, Math.max(0, Math.round(n * 10) / 10));
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeItem(raw: unknown): FeedItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const category =
    o.category === "restaurant" ||
    o.category === "event" ||
    o.category === "nightlife"
      ? o.category
      : "restaurant";

  const name = str(o.name);
  const description = str(o.description);
  const whyTy = str(o.whyTy);
  if (!name || !description) return null;

  const rating = clampRating(o.rating);
  // Enforce the 4.0+ rule for restaurants when a rating is present.
  if (category === "restaurant" && rating !== undefined && rating < 4.0) {
    return null;
  }

  const item: FeedItem = {
    category,
    name,
    kind: str(o.kind) || (category === "restaurant" ? "Restaurant" : "Event"),
    description,
    whyTy: whyTy || "A great fit for Ty's tastes.",
  };
  if (rating !== undefined) item.rating = rating;
  const priceRange = str(o.priceRange);
  if (priceRange) item.priceRange = priceRange;
  const neighborhood = str(o.neighborhood);
  if (neighborhood) item.neighborhood = neighborhood;
  const date = str(o.date);
  if (date) item.date = date;

  return item;
}

function parseFeedJson(text: string): FeedItem[] {
  const trimmed = text.trim();
  // Grab the first JSON array in the response.
  const match = trimmed.match(/\[[\s\S]*\]/);
  const raw = match ? match[0] : trimmed;
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error("Feed response was not an array");
  return parsed
    .map(normalizeItem)
    .filter((x): x is FeedItem => x !== null)
    .slice(0, 8);
}

/**
 * Use Claude + web search to build a curated "This Week in Dallas" feed
 * tailored to Ty's tastes. Throws on failure.
 */
export async function generateDallasFeed(weekOf: string): Promise<FeedItem[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const anthropic = new Anthropic({ apiKey });

  const system = `You are Ty's lifestyle strategist in Dallas, Texas. Use web search to find what is genuinely happening and well-reviewed in Dallas around the week of ${weekOf}.

Ty's tastes: soul food, Italian, and African cuisines; lounge culture, intimate vibes, unique dining and nightlife — not chains or generic picks. Monthly dining budget ~$400.

Curate 6 items mixing these categories:
- "restaurant": real Dallas restaurants rated 4.0 stars or higher (Google/Yelp). Prefer soul food, Italian, African, or distinctive spots.
- "event": concerts, food festivals, pop-ups, or unique experiences happening soon.
- "nightlife": lounges, bars, or nightlife with great atmosphere.

After searching, respond with ONLY a JSON array (no markdown, no code fences) of objects:
[{
  "category": "restaurant" | "event" | "nightlife",
  "name": "string",
  "kind": "string — cuisine for restaurants, or event/venue type",
  "rating": number (restaurants only, 4.0-5.0),
  "priceRange": "$" | "$$" | "$$$" | "$$$$",
  "neighborhood": "string — e.g. Bishop Arts, Deep Ellum, Oak Cliff",
  "date": "YYYY-MM-DD (events only, if known)",
  "description": "string — 1-2 elegant sentences",
  "whyTy": "string — one sentence on why Ty would love it"
}]`;

  // The server-side web_search tool isn't in this SDK version's typings,
  // but the API accepts it. Cast through unknown to satisfy TypeScript.
  const webSearchTool = {
    type: "web_search_20250305",
    name: "web_search",
    max_uses: 5,
  } as unknown as Anthropic.Messages.ToolUnion;

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2500,
    system,
    tools: [webSearchTool],
    messages: [
      {
        role: "user",
        content:
          "Find this week's best Dallas picks for Ty and return the JSON array only.",
      },
    ],
  });

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  if (!text.trim()) throw new Error("No text response from model");
  return parseFeedJson(text);
}
