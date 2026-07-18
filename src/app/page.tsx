import Link from "next/link";
import { BrandWordmark } from "@/components/shared/brand-mark";
import { ArrowRight, BarChart3, BookOpenCheck, ReceiptText, Sparkles } from "lucide-react";
import { formatMoney } from "@/lib/format/money";
import { DEMO_WELCOME_SNAPSHOT } from "@/data/demo";
import { resolveAuthMode } from "@/lib/supabase/env";

const benefits = [
  { icon: ReceiptText, title: "Record with less fuss", text: "Keep sales and spending together in one clear workspace." },
  { icon: BarChart3, title: "See your cash flow", text: "Understand what came in, what went out, and what is still due." },
  { icon: BookOpenCheck, title: "Build better records", text: "Prepare more complete business information one step at a time." },
];

export default function WelcomePage() {
  const mode = resolveAuthMode();
  return (
    <main className="welcome-page">
      <nav className="welcome-nav" aria-label="Welcome navigation">
        <Link className="brand-lockup" href="/"><BrandWordmark /></Link>
        <Link className="button button-secondary welcome-signin" href="/login">Sign in</Link>
      </nav>
      <section className="welcome-hero">
        <div className="welcome-copy">
          <p className="demo-badge"><Sparkles aria-hidden="true" size={15} />{mode === "supabase" ? "Live workspace" : "Demo experience"}</p>
          <h1>Your business, made <span>clearer.</span></h1>
          <p>NiagaAI helps Malaysian small-business owners organise everyday money records and understand what comes next.</p>
          <div className="welcome-actions">
            <Link className="button button-primary" href="/signup">Get started <ArrowRight aria-hidden="true" size={18} /></Link>
            <Link className="button button-secondary" href="/login">{mode === "supabase" ? "I already have an account" : "I already have a demo account"}</Link>
          </div>
          <small>{mode === "supabase" ? "Your records are stored in your authenticated workspace. No bank connection is required." : "No bank connection, real account, or payment details required."}</small>
        </div>
        <div className="welcome-visual" aria-label="Sample cash overview">
          <div className="mini-card mini-balance"><span>Cash balance</span><strong>{formatMoney(DEMO_WELCOME_SNAPSHOT.balance)}</strong><small>Illustrative demo balance</small></div>
          <div className="mini-row"><span className="mini-icon">↑</span><div><strong>Nasi lemak sales</strong><small>Sample · DuitNow</small></div><b>+ {formatMoney(DEMO_WELCOME_SNAPSHOT.income)}</b></div>
          <div className="mini-row"><span className="mini-icon expense">↓</span><div><strong>Grocery purchase</strong><small>Sample · Cash</small></div><b>− {formatMoney(DEMO_WELCOME_SNAPSHOT.expense)}</b></div>
          <div className="visual-accent">Simple records.<br />Useful clarity.</div>
        </div>
      </section>
      <section className="benefits" aria-labelledby="benefits-title">
        <div><p className="eyebrow">Built for everyday business</p><h2 id="benefits-title">Start with the essentials</h2></div>
        <div className="benefit-grid">
          {benefits.map(({ icon: Icon, title, text }) => <article key={title}><Icon aria-hidden="true" size={21} /><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </section>
    </main>
  );
}
