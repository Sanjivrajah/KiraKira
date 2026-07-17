"use client";

import Link from "next/link";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FieldError } from "@/components/forms/field-error";
import { FormField } from "@/components/forms/form-field";
import { signUpSchema, type SignUpValues } from "@/lib/validation/auth";
import { AuthServiceError } from "@/services/auth";
import { useAuth } from "./auth-provider";
import { PasswordField } from "./password-field";

export function SignUpForm() {
  const { mode, signUp } = useAuth();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const { register, handleSubmit, resetField, formState: { errors, isSubmitting } } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "", terms: false },
  });

  const submit = handleSubmit(async (values) => {
    setMessage(null);
    try {
      await signUp({ name: values.name, email: values.email, password: values.password });
      resetField("password");
      resetField("confirmPassword");
      setMessage({ tone: "success", text: mode === "supabase" ? "Account created. Opening your workspace…" : "Account created. Let’s set up your business…" });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof AuthServiceError ? error.message : "We could not create the account. Check the details and try again." });
    }
  });

  return (
    <form className="auth-form" noValidate onSubmit={submit}>
      <FormField autoComplete="name" error={errors.name?.message} label="Your name" maxLength={80} {...register("name")} />
      <FormField autoComplete="email" error={errors.email?.message} label="Email address" maxLength={254} type="email" {...register("email")} />
      <PasswordField
        autoComplete="new-password"
        error={errors.password?.message}
        hint="Use 8 or more characters with at least one letter and one number."
        label="Password"
        maxLength={128}
        {...register("password")}
      />
      <PasswordField autoComplete="new-password" error={errors.confirmPassword?.message} label="Confirm password" maxLength={128} {...register("confirmPassword")} />
      <div className="checkbox-field">
        <input aria-describedby={errors.terms ? "terms-error" : undefined} aria-invalid={errors.terms ? true : undefined} id="terms" type="checkbox" {...register("terms")} />
        <label htmlFor="terms">{mode === "supabase" ? "I understand this account is for the NiagaAI prototype workspace." : "I understand this is a browser-only demo and does not create a real account."}</label>
      </div>
      <FieldError id="terms-error" message={errors.terms?.message} />
      {message ? <p className={`form-message ${message.tone}`} aria-live="polite">{message.text}</p> : null}
      <button className="button button-primary button-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Creating account…" : mode === "supabase" ? "Create account" : "Create demo account"}
      </button>
      <p className="auth-switch">{mode === "supabase" ? "Already have an account?" : "Already have a demo account?"} <Link href="/login">Sign in</Link></p>
    </form>
  );
}
