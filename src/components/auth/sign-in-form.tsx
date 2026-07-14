"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FormField } from "@/components/forms/form-field";
import { signInSchema, type SignInValues } from "@/lib/validation/auth";
import { useNiagaStore } from "@/store/use-niaga-store";
import { PasswordField } from "./password-field";

const wait = () => new Promise((resolve) => setTimeout(resolve, 650));

export function SignInForm() {
  const router = useRouter();
  const signIn = useNiagaStore((state) => state.signIn);
  const isOnboardingComplete = useNiagaStore((state) => state.isOnboardingComplete);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const submit = handleSubmit(async (values) => {
    setMessage(null);
    await wait();
    if (values.email.trim().toLowerCase() === "error@niagaai.demo") {
      setMessage({ tone: "error", text: "This demo account is set to fail. Try another email address." });
      return;
    }
    signIn(values.email);
    setMessage({ tone: "success", text: "Signed in. Opening your workspace…" });
    router.replace(isOnboardingComplete ? "/dashboard" : "/onboarding");
  });

  return (
    <form className="auth-form" noValidate onSubmit={submit}>
      <FormField
        autoComplete="email"
        error={errors.email?.message}
        label="Email address"
        placeholder="you@example.com"
        type="email"
        {...register("email")}
      />
      <PasswordField
        autoComplete="current-password"
        error={errors.password?.message}
        label="Password"
        {...register("password")}
      />
      {message ? <p className={`form-message ${message.tone}`} aria-live="polite">{message.text}</p> : null}
      <button className="button button-primary button-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>
      <button
        className="demo-helper"
        disabled={isSubmitting}
        onClick={() => {
          setValue("email", "lina@niagaai.demo", { shouldValidate: true });
          setValue("password", "demo1234", { shouldValidate: true });
        }}
        type="button"
      >
        Fill demo details
      </button>
      <p className="auth-switch">New to NiagaAI? <Link href="/signup">Create a demo account</Link></p>
    </form>
  );
}
