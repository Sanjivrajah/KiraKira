import Link from "next/link";
import { BrandWordmark } from "@/components/shared/brand-mark";
import { Bell, RotateCcw, LogOut } from "lucide-react";

export function Topbar({ initials, menuOpen, onToggleMenu, onSignOut, onReset }: {
  initials: string;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onSignOut: () => void;
  onReset: () => void;
}) {
  return (
    <header className="topbar">
      <Link className="mobile-brand" href="/dashboard">
        <BrandWordmark />
      </Link>
      <div className="topbar-actions">
        <button className="icon-button" type="button" aria-label="Notifications">
          <Bell aria-hidden="true" size={18} />
        </button>
        <button className="avatar-button" type="button" aria-label="Open user menu" aria-expanded={menuOpen} aria-controls="user-menu" onClick={onToggleMenu}>
          {initials}
        </button>
        {menuOpen ? (
          <div className="user-menu" id="user-menu">
            <strong>Demo session</strong>
            <button onClick={onSignOut} type="button"><LogOut aria-hidden="true" size={17} />Sign out</button>
            <button onClick={onReset} type="button"><RotateCcw aria-hidden="true" size={17} />Reset demo</button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
