"use client";

import Link from "next/link";
import { BrandWordmark } from "@/components/shared/brand-mark";
import { usePathname } from "next/navigation";
import { isNavigationItemActive, primaryNavigation } from "./navigation";

export function Sidebar({ businessName = "Your business", businessType = "Local business", mode = "demo" }: { businessName?: string; businessType?: string; mode?: "demo" | "supabase" }) {
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
        {primaryNavigation.map(({ label, href, icon: Icon }) => {
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
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <strong>{mode === "supabase" ? "Connected workspace" : "Demo workspace"}</strong>
        <span>{mode === "supabase" ? "Supabase records are available in this workspace." : "Local sample data only. No external services connected."}</span>
      </div>
    </aside>
  );
}
