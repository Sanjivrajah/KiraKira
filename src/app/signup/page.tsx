import { AuthCard } from "@/components/auth/auth-card";
import { AuthGate } from "@/components/auth/auth-gate";
import { SignUpForm } from "@/components/auth/sign-up-form";

export default function SignupPage() {
  return <AuthGate gate="public-auth"><AuthCard eyebrow="Start your local demo" title="Create a demo account" description="Your profile stays in this browser and can be reset at any time."><SignUpForm /></AuthCard></AuthGate>;
}
