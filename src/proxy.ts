import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that are always public (no auth required)
const PUBLIC_ROUTES = [
  "/auth",
  "/auth/callback",
  "/auth/confirm",
  "/privacy",             // Privacy policy — must be reachable by app store reviewers, no login
  "/api/cron",           // Vercel cron jobs — protected by CRON_SECRET
  "/api/email",          // Email routes — protected by CRON_SECRET
  "/api/stripe/webhook", // Stripe webhooks — protected by Stripe signature
];

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh the session — IMPORTANT: do not remove this.
  // Without it, server components won't have an up-to-date session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route),
  );

  // Redirect unauthenticated users to /auth (unless they're already there)
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - Public assets in /public
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|icons/|manifest.json).*)",
  ],
};
