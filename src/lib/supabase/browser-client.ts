import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getBrowserSupabaseConfig, requireBrowserSupabaseConfig } from "./env";

let browserClient: SupabaseClient<Database> | null = null;

export function isSupabaseAuthConfigured() {
  const configuration = getBrowserSupabaseConfig();
  return configuration.mode === "supabase" && !configuration.error;
}

export function getSupabaseBrowserClient() {
  const configuration = requireBrowserSupabaseConfig();
  browserClient ??= createBrowserClient<Database>(configuration.url, configuration.publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return browserClient;
}
