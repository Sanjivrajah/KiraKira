import Link from "next/link";
import type { ReactNode } from "react";
import { BrandWordmark } from "@/components/shared/brand-mark";

export function AuthCard({ eyebrow, title, description, children }: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-page">
      <Link className="brand-lockup auth-brand" href="/">
        <BrandWordmark />
      </Link>
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="auth-title">{title}</h1>
        <p className="auth-description">{description}</p>
        {children}
      </section>
      <p className="demo-footnote">Demo experience · No real account or password is created.</p>
    </main>
  );
}
