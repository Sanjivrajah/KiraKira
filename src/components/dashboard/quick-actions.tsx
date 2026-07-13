import Link from "next/link";
import type { QuickAction } from "@/data/mock-dashboard";

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <section aria-labelledby="quick-actions-title">
      <div className="section-heading-row">
        <div>
          <p className="section-kicker">Save time</p>
          <h2 id="quick-actions-title">Quick actions</h2>
        </div>
      </div>
      <div className="quick-action-grid">
        {actions.map(({ description, href, icon: Icon, label }) => (
          <Link className="quick-action" href={href} key={label}>
            <span><Icon aria-hidden="true" size={20} /></span>
            <strong>{label}</strong>
            <small>{description}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}
