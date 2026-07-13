import { AuthCard } from "@/components/auth/auth-card";
import { AuthGate } from "@/components/auth/auth-gate";
import { SignInForm } from "@/components/auth/sign-in-form";

export default function LoginPage() {
  return <AuthGate gate="public-auth"><AuthCard eyebrow="Welcome back" title="Sign in to your demo" description="Use any validly shaped details, or fill the prepared demo account."><SignInForm /></AuthCard></AuthGate>;
}
