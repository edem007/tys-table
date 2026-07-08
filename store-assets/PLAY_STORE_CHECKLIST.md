# Play Store / Samsung Galaxy Store submission checklist

Everything below is a **draft for your review** — nothing here has been submitted to Google.
Work through it top to bottom in [Play Console](https://play.google.com/console) under the
"Prince T" developer account.

## 1. Prerequisites (done)

- [x] Signed release AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- [x] Release keystore: `C:\Users\edem0\keystores\tystable-release.jks` (passwords in
      `android/keystore.properties`, gitignored) — **back this up outside this machine**,
      losing it means you can never update the app again.
- [x] Privacy policy live at https://tystable.app/privacy
- [x] In-app Stripe upgrade button hidden on native Android/iOS (Play payments policy)

## 2. Create the app in Play Console

- App name: **Ty's Table**
- Default language: English (US)
- App or game: **App**
- Free or paid: **Free**
- Declarations: accept as applicable to your account (developer program policies, US export laws)

## 3. Store listing text

**Short description** (max 80 chars):
```
Your week of dinners, planned around you — what to cook, where to go.
```

**Full description** (draft — edit freely):
```
Ty's Table plans your whole week of dinners around you — what to cook, where to go, and when.

Tell us your cuisines, your budget, your allergies, and how many nights you like to cook
versus eat out. Every week, Ty's Table builds you a day-by-day plan: recipes for your cook
nights, and curated restaurant picks for the nights you'd rather go out.

FEATURES
• Weekly meal plan — a full week of cook/eat-out days, built around your preferences
• Personalized recipes — matched to your cuisines, allergies, and party size
• Restaurant picks — curated options near you for your eat-out nights, rated 4.3+
• Savings tracking — see what you save by cooking at home
• Simple onboarding — set your preferences once, refine anytime in Settings

Your data is yours — read our privacy policy at tystable.app/privacy.
```

## 4. Graphics

- App icon (512×512, no alpha): `store-assets/play-store-icon-512.png` ✅ ready
- Feature graphic (1024×500): `store-assets/feature-graphic-1024x500.jpg` ✅ ready (basic draft — consider a designer pass before final submission)
- Phone screenshots (min 2, 320–3840px, 16:9 to 9:16): **NOT YET CAPTURED** — take 2-3 on your
  phone: the weekly plan view, a restaurant pick, and a recipe/cook-night view all look good.

## 5. Categorization

- Category: **Food & Drink**
- Tags: meal planning, recipes, restaurants, budgeting

## 6. Pricing & distribution

- Price: **Free**
- Countries: start with **United States** (current restaurant/recipe data is Dallas-area —
  expand once you have broader city coverage)
- Contains ads: **No**

## 7. Content rating questionnaire (IARC) — draft answers

Answer these yourself in Play Console; this is a legal certification under your account.

| Question | Draft answer |
|---|---|
| Violence | None |
| Sexual content | None |
| Profanity | None |
| Controlled substances | None |
| Gambling | None |
| User-generated content shared with others | No |
| Users can communicate with each other | No |
| Shares user's location with other users | No |
| Digital purchases | **No** — the Pro/subscription upsell has been removed from the app entirely
  (2026-07-08, no real subscribers yet); Stripe backend code is still in the repo but unreachable
  from the UI. Revisit this answer if/when Pro comes back. |

## 8. Data safety form — draft answers

| Data type | Collected? | Purpose | Shared with |
|---|---|---|---|
| Name | Yes | Account, personalization | Not shared |
| Email address | Yes | Account/auth | Supabase (auth provider) |
| Approximate location | Yes (city, user-typed — not device GPS) | Restaurant matching | Google Places, Spoonacular |
| App activity (meal plans, choices) | Yes | App functionality | Not shared |

- Data encrypted in transit: **Yes** (HTTPS via Vercel/Supabase)
- Users can request data deletion: **Yes** — via info@pjandtinc.com (linked from the privacy policy)
- Data collection is required for the app to function (not optional): mark per your judgment —
  onboarding fields (cuisines, budget, allergies) are required for the core feature to work.

## 9. Known open items (not blocking submission, but worth tracking)

- **Pro tier removed from the UI (2026-07-08)** — it had no functional difference from Free
  (just a badge) and no real subscribers, so the upgrade/billing UI was pulled entirely rather
  than shipped half-finished. Stripe backend code is untouched in case Pro comes back later;
  revisit the "Digital purchases" content rating answer above if it does.
- **iOS** — separate submission, needs a Mac + Xcode; Apple will likely require either real
  native functionality (e.g. push notifications) or an App Store Connect exemption request,
  plus a decision on Apple In-App Purchase vs. web-only billing.
- **Samsung Galaxy Store** — same signed AAB can be submitted there once Play Store review
  is underway/complete.
