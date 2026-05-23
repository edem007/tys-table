import { Redis } from "@upstash/redis";
import type { SuggestionResponse } from "./suggest";

const DAILY_SUGGESTION_KEY = "daily_suggestion";

export type DailySuggestion = {
  /** Local date in Dallas, format YYYY-MM-DD. */
  date: string;
  suggestion: SuggestionResponse;
  /** ISO timestamp of when it was generated. */
  generatedAt: string;
};

function getRedis(): Redis {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error("KV_REST_API_URL and KV_REST_API_TOKEN must be set");
  }
  return new Redis({ url, token });
}

/** Current date in Dallas (America/Chicago) as YYYY-MM-DD. */
export function dallasToday(): string {
  // en-CA locale yields YYYY-MM-DD formatting.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function readDailySuggestion(): Promise<DailySuggestion | null> {
  const redis = getRedis();
  const raw = await redis.get<string>(DAILY_SUGGESTION_KEY);
  if (raw == null) return null;
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!parsed || typeof parsed !== "object") return null;
  return parsed as DailySuggestion;
}

export async function writeDailySuggestion(
  entry: DailySuggestion,
): Promise<void> {
  const redis = getRedis();
  await redis.set(DAILY_SUGGESTION_KEY, JSON.stringify(entry));
}
