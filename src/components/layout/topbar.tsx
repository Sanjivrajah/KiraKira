"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { BrandWordmark } from "@/components/shared/brand-mark";
import { Bell, RotateCcw, LogOut } from "lucide-react";

export function Topbar({ initials, menuOpen, onToggleMenu, onSignOut, onReset }: {
  initials: string;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onSignOut: () => void;
  onReset: () => void;
}) {
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutsideInteraction = (event: PointerEvent) => {
      if (!actionsRef.current?.contains(event.target as Node)) onToggleMenu();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onToggleMenu();
    };
    document.addEventListener("pointerdown", closeOnOutsideInteraction);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideInteraction);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen, onToggleMenu]);

  return (
    <header className="topbar">
      <Link className="mobile-brand" href="/dashboard">
        <BrandWordmark />
      </Link>
      <div className="topbar-actions" ref={actionsRef}>
        <button className="icon-button" type="button" aria-label="Notifications (none)" title="No new notifications">
          <Bell aria-hidden="true" size={18} />
        </button>
        <button className="avatar-button" type="button" aria-label={menuOpen ? "Close user menu" : "Open user menu"} aria-expanded={menuOpen} aria-controls="user-menu" onClick={onToggleMenu}>
          {initials}
        </button>
        {menuOpen ? (
          <div className="user-menu" id="user-menu" role="menu">
            <strong>Demo session</strong>
            <button onClick={onSignOut} role="menuitem" type="button"><LogOut aria-hidden="true" size={17} />Sign out</button>
            <button onClick={onReset} role="menuitem" type="button"><RotateCcw aria-hidden="true" size={17} />Reset demo</button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
