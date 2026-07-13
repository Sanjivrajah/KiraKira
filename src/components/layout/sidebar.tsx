import Link from "next/link";
import {
  Boxes,
  FileChartColumn,
  FileText,
  Gauge,
  HandCoins,
  Landmark,
  ReceiptText,
  Settings,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: Gauge, active: true },
  { label: "Transactions", href: "/dashboard", icon: ReceiptText },
  { label: "Invoices", href: "/dashboard", icon: FileText },
  { label: "Payments", href: "/dashboard", icon: HandCoins },
  { label: "Inventory", href: "/dashboard", icon: Boxes },
  { label: "Reports", href: "/dashboard", icon: FileChartColumn },
  { label: "Loan readiness", href: "/dashboard", icon: Landmark },
  { label: "Settings", href: "/dashboard", icon: Settings },
];

export function Sidebar({ businessName = "Your business", businessType = "Local business" }: { businessName?: string; businessType?: string }) {
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <Link className="brand-lockup" href="/dashboard">
        <span className="brand-mark">N</span>
        NiagaAI
      </Link>

      <div className="sidebar-business">
        <strong>{businessName}</strong>
        <span>{businessType} · MYR</span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ label, href, icon: Icon, active }) => (
          <Link
            className={`sidebar-link${active ? " active" : ""}`}
            href={href}
            key={label}
            aria-current={active ? "page" : undefined}
          >
            <Icon aria-hidden="true" size={18} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <strong>Demo workspace</strong>
        <span>Local sample data only. No external services connected.</span>
      </div>
    </aside>
  );
}
