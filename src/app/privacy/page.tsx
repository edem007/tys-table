export const metadata = {
  title: "Privacy Policy — Ty's Table",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-[#2E2A27]">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-[#8A8178]">Last updated: July 7, 2026</p>

      <p className="mt-8 leading-relaxed">
        Ty&apos;s Table (&quot;we&quot;, &quot;us&quot;) provides a weekly
        meal-planning and restaurant-matching app at tystable.app and through
        our Android and iOS apps. This policy explains what information we
        collect, why, and how you can control it.
      </p>

      <h2 className="mt-10 text-xl font-semibold">Information we collect</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed">
        <li>
          <strong>Account information:</strong> your email address, and — if
          you sign in with Google or Apple — the name and profile
          information those providers share with us.
        </li>
        <li>
          <strong>Profile &amp; preferences:</strong> your first name,
          cuisine preferences, allergies, party size, monthly dining budget,
          and how many nights a week you cook, all of which you provide
          during onboarding to personalize your weekly plan. Restaurant
          suggestions default to the Dallas, TX area.
        </li>
        <li>
          <strong>Usage data:</strong> your weekly meal plans, which days you
          mark as completed, and which restaurant or recipe options you
          choose, so the app can track your progress and savings.
        </li>
        <li>
          <strong>Payment information:</strong> if you subscribe to Ty&apos;s
          Table Pro, payment is processed by Stripe. We do not receive or
          store your card number — Stripe shares with us only your
          subscription status and a customer reference ID.
        </li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold">How we use it</h2>
      <p className="mt-3 leading-relaxed">
        We use this information to generate your weekly cook/eat-out plan,
        suggest recipes and restaurants near you, calculate your savings
        progress, manage your subscription, and send you account-related
        email (such as sign-in confirmations). We do not sell your personal
        information.
      </p>

      <h2 className="mt-10 text-xl font-semibold">Who we share it with</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed">
        <li>
          <strong>Supabase</strong> — hosts our database and handles
          authentication.
        </li>
        <li>
          <strong>Stripe</strong> — processes subscription payments.
        </li>
        <li>
          <strong>Google Places</strong> and <strong>Spoonacular</strong> —
          power restaurant and recipe suggestions based on your city and
          preferences.
        </li>
        <li>
          <strong>Resend</strong> — delivers transactional email on our
          behalf.
        </li>
      </ul>
      <p className="mt-3 leading-relaxed">
        Each of these providers only receives the information needed to
        perform their function for us, and is not permitted to use it for
        their own purposes.
      </p>

      <h2 className="mt-10 text-xl font-semibold">Your choices</h2>
      <p className="mt-3 leading-relaxed">
        You can review or update your preferences anytime from Settings in
        the app. To request deletion of your account and associated data, or
        to ask any question about this policy, contact us at{" "}
        <a
          href="mailto:info@pjandtinc.com"
          className="text-[#E5A78D] underline"
        >
          info@pjandtinc.com
        </a>
        .
      </p>

      <h2 className="mt-10 text-xl font-semibold">Children&apos;s privacy</h2>
      <p className="mt-3 leading-relaxed">
        Ty&apos;s Table is not directed at children under 13, and we do not
        knowingly collect information from them.
      </p>

      <h2 className="mt-10 text-xl font-semibold">Changes to this policy</h2>
      <p className="mt-3 leading-relaxed">
        If we make material changes to this policy, we&apos;ll update the
        date above and, where appropriate, notify you by email.
      </p>
    </main>
  );
}
