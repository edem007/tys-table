import { Redis } from "@upstash/redis";
import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
  type Preferences,
} from "./preferences";

const PREFERENCES_KEY = "preferences";

function getRedis(): Redis {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error("KV_REST_API_URL and KV_REST_API_TOKEN must be set");
  }
  return new Redis({ url, token });
}

export async function readPreferences(): Promise<Preferences> {
  const redis = getRedis();
  const raw = await redis.get<string>(PREFERENCES_KEY);
  if (raw == null) return { ...DEFAULT_PREFERENCES };
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  return normalizePreferences(parsed);
}

export async function writePreferences(prefs: Preferences): Promise<void> {
  const redis = getRedis();
  await redis.set(PREFERENCES_KEY, JSON.stringify(prefs));
}
