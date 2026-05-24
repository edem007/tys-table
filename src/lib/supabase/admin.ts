import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Supabase admin client — uses the service role key to bypass RLS.
 * ONLY use this in server-side code (API routes, cron jobs).
 * NEVER expose this client or the service role key to the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
