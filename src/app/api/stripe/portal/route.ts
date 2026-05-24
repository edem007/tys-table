import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://prince-ai-projects-murex.vercel.app";

/**
 * POST /api/stripe/portal
 * Creates a Stripe Billing Portal session so users can manage their subscription.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 400 },
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: APP_URL,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Portal failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
