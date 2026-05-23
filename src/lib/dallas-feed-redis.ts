import { Redis } from "@upstash/redis";
import type { FeedItem } from "./dallas-feed";

const DALLAS_FEED_KEY = "dallas_feed";

export type DallasFeedEntry = {
  /** Dallas date (YYYY-MM-DD) the feed was generated for. */
  date: string;
  items: FeedItem[];
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

export async function readDallasFeed(): Promise<DallasFeedEntry | null> {
  const redis = getRedis();
  const raw = await redis.get<string>(DALLAS_FEED_KEY);
  if (raw == null) return null;
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!parsed || typeof parsed !== "object") return null;
  return parsed as DallasFeedEntry;
}

export async function writeDallasFeed(entry: DallasFeedEntry): Promise<void> {
  const redis = getRedis();
  await redis.set(DALLAS_FEED_KEY, JSON.stringify(entry));
}
