import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, getOrCreateCustomer } from "@/lib/stripe";

export const dynamic = "force-dynamic";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://prince-ai-projects-murex.vercel.app";

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout session for the Pro subscription.
 * Body: { priceId: string }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { priceId?: string };
    const priceId =
      body.priceId ?? process.env.STRIPE_PRO_PRICE_ID;

    if (!priceId) {
      return NextResponse.json({ error: "priceId is required" }, { status: 400 });
    }

    const customerId = await getOrCreateCustomer(
      user.id,
      user.email ?? "",
      user.user_metadata?.full_name as string | undefined,
    );

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL}/?upgraded=true`,
      cancel_url: `${APP_URL}/?upgrade=cancelled`,
      metadata: { supabase_user_id: user.id },
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
