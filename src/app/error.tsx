"use client";

import { CircleAlert, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function RouteError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="state-page">
      <section className="state-card state-card-action" role="alert">
        <div>
          <CircleAlert aria-hidden="true" color="var(--danger)" size={32} />
          <p className="eyebrow">Screen interrupted</p>
          <h1>We couldn’t open this screen</h1>
          <p>Your records have not been changed. Try loading the screen again, or return to the dashboard.</p>
          <div className="state-actions">
            <button className="button button-primary" onClick={unstable_retry} type="button">
              <RefreshCw aria-hidden="true" size={18} />Try again
            </button>
            <Link className="button button-secondary" href="/dashboard">Go to dashboard</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
