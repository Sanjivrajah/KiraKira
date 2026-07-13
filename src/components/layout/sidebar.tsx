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
  { label: "Dashboard", href: "/", icon: Gauge, active: true },
  { label: "Transactions", href: "/", icon: ReceiptText },
  { label: "Invoices", href: "/", icon: FileText },
  { label: "Payments", href: "/", icon: HandCoins },
  { label: "Inventory", href: "/", icon: Boxes },
  { label: "Reports", href: "/", icon: FileChartColumn },
  { label: "Loan readiness", href: "/", icon: Landmark },
  { label: "Settings", href: "/", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <Link className="brand-lockup" href="/">
        <span className="brand-mark">N</span>
        NiagaAI
      </Link>

      <div className="sidebar-business">
        <strong>Warung Kak Lina</strong>
        <span>Food & beverage · MYR</span>
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
