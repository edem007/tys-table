import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

// Stripe requires the raw body for webhook signature verification.
export const preferredRegion = "iad1";

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}

async function updateSubscriptionTier(
  userId: string,
  tier: "free" | "pro",
  stripeSubscriptionId?: string,
) {
  const supabase = createAdminClient();
  await supabase
    .from("profiles")
    .update({
      subscription_tier: tier,
      ...(stripeSubscriptionId !== undefined && {
        stripe_subscription_id: stripeSubscriptionId,
      }),
    })
    .eq("id", userId);
}

/**
 * POST /api/stripe/webhook
 * Handles Stripe webhook events to keep subscription state in sync.
 * Verify signature with STRIPE_WEBHOOK_SECRET.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing stripe signature or webhook secret" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: `Webhook Error: ${errorMessage(err)}` },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        if (userId && session.subscription) {
          await updateSubscriptionTier(
            userId,
            "pro",
            session.subscription as string,
          );
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;
        if (!userId) break;
        const isActive = ["active", "trialing"].includes(subscription.status);
        await updateSubscriptionTier(
          userId,
          isActive ? "pro" : "free",
          subscription.id,
        );
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;
        if (userId) {
          await updateSubscriptionTier(userId, "free", undefined);
        }
        break;
      }

      case "invoice.payment_failed": {
        // Optionally: send a payment failed email via Resend
        const invoice = event.data.object as Stripe.Invoice;
        console.warn("Payment failed for customer:", invoice.customer);
        break;
      }

      default:
        // Ignore unhandled events
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
