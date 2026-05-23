import Anthropic from "@anthropic-ai/sdk";
import {
  buildTasteProfile,
  DEFAULT_PREFERENCES,
  type Preferences,
} from "./preferences";

export type HomeAlternative = {
  /** A cook-at-home dish approximating the dine-out experience. */
  title: string;
  /** Estimated grocery cost in USD. */
  estimatedCost: number;
};

export type SuggestionResponse = {
  type: "cook" | "dine_out";
  title: string;
  description: string;
  estimatedCost: number;
  reason: string;
  /** Present for dine_out picks: the cook-at-home comparison. */
  homeAlternative?: HomeAlternative;
};

export type SuggestInput = {
  balance: number;
  targetAmount: number;
  fundName: string;
  prefs: Preferences;
};

const MODEL = "claude-sonnet-4-6";

export function buildSystemPrompt(input: SuggestInput): string {
  const { balance, targetAmount, fundName, prefs } = input;
  const progressPct =
    targetAmount > 0 ? Math.round((balance / targetAmount) * 100) : 0;
  const lowBalance = progressPct < 30;
  const highBalance = progressPct > 80;

  let budgetGuidance =
    "Balance is mid-range — either cooking or dining out is fine; choose what feels special for tonight.";
  if (lowBalance) {
    budgetGuidance =
      "Balance is under 30% of the savings target — strongly prefer a cook-at-home suggestion with modest grocery cost.";
  } else if (highBalance) {
    budgetGuidance =
      "Balance is over 80% of the savings target — dining out at a lounge or unique Dallas spot is allowed if it fits the fund goal.";
  }

  return `You are ${prefs.name}'s personal food strategist in Dallas, Texas. ${prefs.name} is saving toward "${fundName}".

${buildTasteProfile(prefs)}

Current savings: $${balance} of $${targetAmount} target (${progressPct}% toward goal).
${budgetGuidance}

Respond with ONLY a single JSON object (no markdown, no code fences) matching this schema:
{
  "type": "cook" | "dine_out",
  "title": "string — dish name if cook, or venue/experience if dine_out",
  "description": "string — 1-2 elegant sentences",
  "estimatedCost": number — USD grocery estimate if cook, or estimated spend if dine_out,
  "reason": "string — one short sentence tying the pick to the fund and tonight",
  "homeAlternative": { "title": "string", "estimatedCost": number }
}

Include "homeAlternative" ONLY when type is "dine_out": propose a cook-at-home dish that captures the same craving/experience, with a realistic grocery cost (usually well below the restaurant spend). Omit "homeAlternative" entirely when type is "cook".`;
}

export function parseSuggestionJson(text: string): SuggestionResponse {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const raw = jsonMatch ? jsonMatch[0] : trimmed;
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  const type = parsed.type;
  if (type !== "cook" && type !== "dine_out") {
    throw new Error("Invalid suggestion type");
  }

  const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
  const description =
    typeof parsed.description === "string" ? parsed.description.trim() : "";
  const reason = typeof parsed.reason === "string" ? parsed.reason.trim() : "";
  const estimatedCost =
    typeof parsed.estimatedCost === "number"
      ? parsed.estimatedCost
      : typeof parsed.estimatedCost === "string"
        ? parseFloat(parsed.estimatedCost)
        : NaN;

  if (!title || !description || !reason || !Number.isFinite(estimatedCost)) {
    throw new Error("Incomplete suggestion from model");
  }

  const result: SuggestionResponse = {
    type,
    title,
    description,
    estimatedCost: Math.max(0, Math.round(estimatedCost)),
    reason,
  };

  // Parse the cook-at-home comparison, only meaningful for dine_out.
  if (type === "dine_out" && parsed.homeAlternative) {
    const alt = parsed.homeAlternative as Record<string, unknown>;
    const altTitle = typeof alt.title === "string" ? alt.title.trim() : "";
    const altCostRaw =
      typeof alt.estimatedCost === "number"
        ? alt.estimatedCost
        : typeof alt.estimatedCost === "string"
          ? parseFloat(alt.estimatedCost)
          : NaN;
    if (altTitle && Number.isFinite(altCostRaw)) {
      result.homeAlternative = {
        title: altTitle,
        estimatedCost: Math.max(0, Math.round(altCostRaw)),
      };
    }
  }

  return result;
}

/** Normalize loose request input into safe suggestion parameters. */
export function normalizeSuggestInput(
  body: {
    balance?: unknown;
    targetAmount?: unknown;
    fundName?: unknown;
  },
  prefs: Preferences = DEFAULT_PREFERENCES,
): SuggestInput {
  const balance =
    typeof body.balance === "number" && Number.isFinite(body.balance)
      ? body.balance
      : 0;
  const targetAmount =
    typeof body.targetAmount === "number" &&
    Number.isFinite(body.targetAmount) &&
    body.targetAmount > 0
      ? body.targetAmount
      : 120;
  const fundName =
    typeof body.fundName === "string" && body.fundName.trim()
      ? body.fundName.trim().slice(0, 40)
      : "Stone Water Fund";

  return { balance, targetAmount, fundName, prefs };
}

/** Call Claude and return a validated suggestion. Throws on failure. */
export async function generateSuggestion(
  input: SuggestInput,
): Promise<SuggestionResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const anthropic = new Anthropic({ apiKey });
  const system = buildSystemPrompt(input);

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system,
    messages: [
      {
        role: "user",
        content: `What should ${input.prefs.name} do tonight? Return JSON only.`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from model");
  }

  return parseSuggestionJson(textBlock.text);
}
