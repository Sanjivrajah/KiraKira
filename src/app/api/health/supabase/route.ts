import { NextResponse } from "next/server";
import { getBrowserSupabaseConfig, isLocalSupabaseUrl } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });

  const configuration = getBrowserSupabaseConfig();
  if (configuration.mode === "demo") {
    return NextResponse.json({ mode: "demo", configured: false, connection: "not-applicable" });
  }
  if (configuration.error || !configuration.url || !configuration.publishableKey) {
    return NextResponse.json({ mode: "supabase", configured: false, error: configuration.error }, { status: 503 });
  }

  try {
    const response = await fetch(new URL("auth/v1/health", configuration.url), {
      headers: { apikey: configuration.publishableKey },
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    return NextResponse.json({
      mode: "supabase",
      configured: true,
      environment: isLocalSupabaseUrl(configuration.url) ? "local" : "hosted",
      connection: response.ok ? "reachable" : "unavailable",
    }, { status: response.ok ? 200 : 503 });
  } catch {
    return NextResponse.json({ mode: "supabase", configured: true, connection: "unavailable" }, { status: 503 });
  }
}
