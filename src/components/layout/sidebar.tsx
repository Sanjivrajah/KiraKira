"use client";

import Link from "next/link";
import { BrandWordmark } from "@/components/shared/brand-mark";
import { usePathname } from "next/navigation";
import { isNavigationItemActive, primaryNavigation } from "./navigation";

export function Sidebar({ businessName = "Your business", businessType = "Local business" }: { businessName?: string; businessType?: string }) {
  const pathname = usePathname();

  return (
    <aside className="sidebar" aria-label="Main navigation">
      <Link className="brand-lockup" href="/dashboard">
        <BrandWordmark />
      </Link>

      <div className="sidebar-business">
        <strong>{businessName}</strong>
        <span>{businessType} · MYR</span>
      </div>

      <nav className="sidebar-nav">
        {primaryNavigation.map(({ label, href, icon: Icon, availability }) => {
          const active = isNavigationItemActive(pathname, href);
          return (
            <Link
              className={`sidebar-link${active ? " active" : ""}`}
              href={href}
              key={label}
              aria-current={active ? "page" : undefined}
            >
              <Icon aria-hidden="true" size={18} />
              <span>{label}</span>
              {availability === "preview" ? <small className="nav-preview-badge">Preview</small> : null}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <strong>Demo workspace</strong>
        <span>Local sample data only. No external services connected.</span>
      </div>
    </aside>
  );
}
