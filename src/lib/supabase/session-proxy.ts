import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getBrowserSupabaseConfig } from "./env";
import type { Database } from "./database.types";

export async function refreshSupabaseSession(request: NextRequest) {
  const configuration = getBrowserSupabaseConfig();
  if (configuration.mode === "demo") return NextResponse.next({ request });
  if (configuration.error || !configuration.url || !configuration.publishableKey) {
    return new NextResponse("Supabase authentication is configured but incomplete.", { status: 503 });
  }

  let response = NextResponse.next({ request });
  const client = createServerClient<Database>(configuration.url, configuration.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  try {
    await client.auth.getClaims();
  } catch {
    return new NextResponse("Supabase authentication is unavailable.", { status: 503 });
  }
  return response;
}
