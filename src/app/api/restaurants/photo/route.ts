import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Proxies Google Places photo media so the API key never reaches the client. */
export async function GET(req: NextRequest) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Google Places API key not configured" }, { status: 500 });
  }

  const ref = req.nextUrl.searchParams.get("ref");
  if (!ref) {
    return NextResponse.json({ error: "Missing photo ref" }, { status: 400 });
  }

  const res = await fetch(`https://places.googleapis.com/v1/${ref}/media?maxWidthPx=800&key=${apiKey}`);
  if (!res.ok || !res.body) {
    return NextResponse.json({ error: "Photo fetch failed" }, { status: res.status });
  }

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
