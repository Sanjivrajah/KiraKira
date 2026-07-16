import { AuthCard } from "@/components/auth/auth-card";
import { AuthGate } from "@/components/auth/auth-gate";
import { SignInForm } from "@/components/auth/sign-in-form";

export default function LoginPage() {
  return <AuthGate gate="public-auth"><AuthCard eyebrow="Welcome back" title="Sign in to NiagaAI" description="Use your workspace account, or continue with local demo details when Supabase is not configured."><SignInForm /></AuthCard></AuthGate>;
}
