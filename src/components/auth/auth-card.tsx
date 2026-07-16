import Link from "next/link";
import type { ReactNode } from "react";
import { BrandWordmark } from "@/components/shared/brand-mark";
import { authMode } from "@/services/auth";
import { getBrowserSupabaseConfig } from "@/lib/supabase/env";

export function AuthCard({ eyebrow, title, description, children }: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const configurationError = getBrowserSupabaseConfig().error;
  return (
    <main className="auth-page">
      <Link className="brand-lockup auth-brand" href="/">
        <BrandWordmark />
      </Link>
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="auth-title">{title}</h1>
        <p className="auth-description">{description}</p>
        {configurationError ? <p className="form-error" role="alert">{configurationError}</p> : null}
        {children}
      </section>
      {authMode === "demo" ? <p className="demo-footnote">Demo experience · No real account or password is created.</p> : null}
    </main>
  );
}
