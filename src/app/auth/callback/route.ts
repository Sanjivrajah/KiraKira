import { NextResponse } from "next/server";
import { safeAppPath } from "@/lib/auth/safe-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

function redirect(requestUrl: URL, path: string) {
  const response = NextResponse.redirect(new URL(path, requestUrl.origin));
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeAppPath(requestUrl.searchParams.get("next"), "/dashboard");
  const authPage = requestUrl.searchParams.get("authPage") === "signup" ? "/signup" : "/login";

  if (code) {
    try {
      const client = await createSupabaseServerClient();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) return redirect(requestUrl, next);
    } catch {
      // Return a safe, actionable auth-page error without exposing provider details.
    }
  }

  return redirect(requestUrl, `${authPage}?authError=google_oauth`);
}
