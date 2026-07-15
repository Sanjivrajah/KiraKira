import { isSupabaseAuthConfigured } from "@/lib/supabase/browser-client";
import { mockAuthService } from "./mock-auth-service";
import { supabaseAuthService } from "./supabase-auth-service";

export type AuthMode = "supabase" | "demo";

export const authMode: AuthMode = isSupabaseAuthConfigured() ? "supabase" : "demo";
export const authService = authMode === "supabase" ? supabaseAuthService : mockAuthService;

export { AuthServiceError } from "./auth-service-error";
