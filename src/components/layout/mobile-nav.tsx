"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import { isNavigationItemActive, primaryNavigation } from "./navigation";

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
        {primaryNavigation.slice(0, 2).map(({ shortLabel, label, href, icon: Icon }) => {
          const active = isNavigationItemActive(pathname, href);
          return <Link className={active ? "active" : undefined} href={href} key={href} aria-current={active ? "page" : undefined}><Icon aria-hidden="true" size={20} />{shortLabel ?? label}</Link>;
        })}
        <Link className={`mobile-add${pathname === "/transactions/new" ? " active" : ""}`} href="/transactions/new" aria-current={pathname === "/transactions/new" ? "page" : undefined}>
          <span><Plus aria-hidden="true" size={23} /></span>
          Add evidence
        </Link>
        {primaryNavigation.slice(2).map(({ shortLabel, label, href, icon: Icon }) => {
          const active = isNavigationItemActive(pathname, href);
          return <Link className={active ? "active" : undefined} href={href} key={href} aria-current={active ? "page" : undefined}><Icon aria-hidden="true" size={20} />{shortLabel ?? label}</Link>;
        })}
    </nav>
  );
}
