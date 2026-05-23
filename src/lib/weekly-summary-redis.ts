import { Redis } from "@upstash/redis";
import type { WeeklySummary } from "./weekly-summary";

const WEEKLY_SUMMARY_KEY = "weekly_summary";

export type WeeklySummaryEntry = {
  /** Sunday (week start) date in Dallas, YYYY-MM-DD. */
  weekOf: string;
  summary: WeeklySummary;
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

/** YYYY-MM-DD of the most recent Sunday in Dallas (week start). */
export function dallasWeekStart(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const y = parseInt(get("year"), 10);
  const m = parseInt(get("month"), 10);
  const d = parseInt(get("day"), 10);
  const dow = weekdayMap[get("weekday")] ?? 0;

  // Subtract the day-of-week to land on Sunday. Use UTC math on the
  // Dallas calendar date to avoid timezone drift.
  const base = Date.UTC(y, m - 1, d);
  const sunday = new Date(base - dow * 86400000);
  return sunday.toISOString().slice(0, 10);
}

export async function readWeeklySummary(): Promise<WeeklySummaryEntry | null> {
  const redis = getRedis();
  const raw = await redis.get<string>(WEEKLY_SUMMARY_KEY);
  if (raw == null) return null;
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!parsed || typeof parsed !== "object") return null;
  return parsed as WeeklySummaryEntry;
}

export async function writeWeeklySummary(
  entry: WeeklySummaryEntry,
): Promise<void> {
  const redis = getRedis();
  await redis.set(WEEKLY_SUMMARY_KEY, JSON.stringify(entry));
}
