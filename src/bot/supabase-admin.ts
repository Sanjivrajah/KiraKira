import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Creates the service-role client used by the Node-based Telegram worker.
 * This file must stay within the bot runtime: `server-only` is a Next.js
 * module-graph marker and deliberately throws when the worker is run with tsx.
 */
export function createTelegramSupabaseAdminClient(environment: NodeJS.ProcessEnv = process.env) {
  const url = environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error("Telegram Supabase mode requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
