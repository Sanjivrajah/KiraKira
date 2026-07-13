"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FieldError } from "@/components/forms/field-error";
import { FormField } from "@/components/forms/form-field";
import { signUpSchema, type SignUpValues } from "@/lib/validation/auth";
import { makeLocalUserId, useNiagaStore } from "@/store/use-niaga-store";
import { PasswordField } from "./password-field";

const wait = () => new Promise((resolve) => setTimeout(resolve, 650));

export function SignUpForm() {
  const router = useRouter();
  const signUp = useNiagaStore((state) => state.signUp);
  const [success, setSuccess] = useState(false);
  const { register, handleSubmit, resetField, formState: { errors, isSubmitting } } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "", terms: false },
  });

  const submit = handleSubmit(async (values) => {
    setSuccess(false);
    await wait();
    const email = values.email.trim().toLowerCase();
    signUp({ id: makeLocalUserId(email), name: values.name.trim(), email });
    resetField("password");
    resetField("confirmPassword");
    setSuccess(true);
    router.replace("/onboarding");
  });

  return (
    <form className="auth-form" noValidate onSubmit={submit}>
      <FormField autoComplete="name" error={errors.name?.message} label="Your name" {...register("name")} />
      <FormField autoComplete="email" error={errors.email?.message} label="Email address" type="email" {...register("email")} />
      <PasswordField
        autoComplete="new-password"
        error={errors.password?.message}
        hint="Use 8 or more characters with at least one letter and one number."
        label="Password"
        {...register("password")}
      />
      <PasswordField autoComplete="new-password" error={errors.confirmPassword?.message} label="Confirm password" {...register("confirmPassword")} />
      <div className="checkbox-field">
        <input aria-describedby={errors.terms ? "terms-error" : undefined} aria-invalid={errors.terms ? true : undefined} id="terms" type="checkbox" {...register("terms")} />
        <label htmlFor="terms">I understand this is a browser-only demo and does not create a real account.</label>
      </div>
      <FieldError id="terms-error" message={errors.terms?.message} />
      {success ? <p className="form-message success" aria-live="polite">Account created. Let’s set up your business…</p> : null}
      <button className="button button-primary button-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Creating account…" : "Create demo account"}
      </button>
      <p className="auth-switch">Already have a demo account? <Link href="/login">Sign in</Link></p>
    </form>
  );
}
