"use client";

import Link from "next/link";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FormField } from "@/components/forms/form-field";
import { signInSchema, type SignInValues } from "@/lib/validation/auth";
import { useAuth } from "./auth-provider";
import { MockAuthError } from "@/services/auth/mock-auth-service";
import { PasswordField } from "./password-field";

export function SignInForm() {
  const { signIn } = useAuth();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const submit = handleSubmit(async (values) => {
    setMessage(null);
    try {
      await signIn(values);
      setMessage({ tone: "success", text: "Signed in. Opening your workspace…" });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof MockAuthError ? error.message : "We could not sign in to this demo account." });
    }
  });

  return (
    <form className="auth-form" noValidate onSubmit={submit}>
      <FormField
        autoComplete="email"
        error={errors.email?.message}
        label="Email address"
        maxLength={254}
        placeholder="you@example.com"
        type="email"
        {...register("email")}
      />
      <PasswordField
        autoComplete="current-password"
        error={errors.password?.message}
        label="Password"
        maxLength={128}
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
