import "server-only";

import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireBrowserSupabaseConfig } from "./env";
import type { Database } from "./database.types";

/** Creates a request-scoped client; never retain this client between requests. */
export async function createSupabaseServerClient() {
  const configuration = requireBrowserSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient<Database>(configuration.url, configuration.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. `src/proxy.ts` refreshes them.
        }
      },
    },
  });
}
