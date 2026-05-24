import Stripe from "stripe";

/**
 * Server-side Stripe client. Only use in API routes / server components.
 * Never import this in client components.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
});

export const PLANS = {
  free: {
    name: "Free",
    suggestionsPerWeek: 3,
    weeklyEmail: false,
    dallasFeed: true,
  },
  pro: {
    name: "Pro",
    suggestionsPerWeek: Infinity,
    weeklyEmail: true,
    dallasFeed: true,
  },
} as const;

export type PlanTier = keyof typeof PLANS;

/** Create or retrieve a Stripe customer for this user. */
export async function getOrCreateCustomer(
  userId: string,
  email: string,
  name?: string,
): Promise<string> {
  // Check if they already have a Stripe customer ID in our DB
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  // Create a new Stripe customer
  const customer = await stripe.customers.create({
    email,
    name: name ?? undefined,
    metadata: { supabase_user_id: userId },
  });

  // Save customer ID to profiles
  await supabase
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  return customer.id;
}
