import { resolveAuthMode } from "@/lib/supabase/env";
import { mockAuthService } from "./mock-auth-service";
import { supabaseAuthService } from "./supabase-auth-service";

export type { AuthMode } from "@/lib/supabase/env";
import type { AuthMode } from "@/lib/supabase/env";

export const authMode: AuthMode = resolveAuthMode();
export const authService = authMode === "supabase" ? supabaseAuthService : mockAuthService;

export { AuthServiceError } from "./auth-service-error";
