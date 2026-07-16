import { AuthCard } from "@/components/auth/auth-card";
import { AuthGate } from "@/components/auth/auth-gate";
import { SignUpForm } from "@/components/auth/sign-up-form";

export default function SignupPage() {
  return <AuthGate gate="public-auth"><AuthCard eyebrow="Start your workspace" title="Create an account" description="Set up the owner profile used for the prototype workspace."><SignUpForm /></AuthCard></AuthGate>;
}
