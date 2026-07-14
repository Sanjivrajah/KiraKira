import { SearchX } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="state-page">
      <section className="state-card state-card-action">
        <div>
          <SearchX aria-hidden="true" color="var(--brand-700)" size={32} />
          <p className="eyebrow">Page not found</p>
          <h1>This link doesn’t lead anywhere</h1>
          <p>The page may have moved, or the address may be incomplete. Your saved records are still safe on this device.</p>
          <div className="state-actions">
            <Link className="button button-primary" href="/dashboard">Go to dashboard</Link>
            <Link className="button button-secondary" href="/">Go to start page</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
