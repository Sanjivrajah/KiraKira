import Link from "next/link";
import { Bell } from "lucide-react";

export function Topbar() {
  return (
    <header className="topbar">
      <Link className="mobile-brand" href="/">
        <span className="brand-mark">N</span>
        NiagaAI
      </Link>
      <div className="topbar-actions">
        <button className="icon-button" type="button" aria-label="Notifications">
          <Bell aria-hidden="true" size={18} />
        </button>
        <button className="avatar-button" type="button" aria-label="Open user menu">
          KL
        </button>
      </div>
    </header>
  );
}
