import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Creates a server-only client for trusted workers such as the Telegram bot.
 * Callers must still establish the actor and business authorization themselves;
 * the service role bypasses RLS and is never an authorization decision.
 */
export function createSupabaseAdminClient(environment: NodeJS.ProcessEnv = process.env) {
  const url = environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    throw new Error("Telegram Supabase mode requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
