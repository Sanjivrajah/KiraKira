"use client";

import Link from "next/link";
import { Menu, Plus, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { isNavigationItemActive, primaryNavigation } from "./navigation";

export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const mainItems = primaryNavigation.slice(0, 3);
  const moreItems = primaryNavigation.slice(3);
  const moreActive = moreItems.some((item) => isNavigationItemActive(pathname, item.href));

  return (
    <>
      {moreOpen ? (
        <div className="mobile-more-backdrop" onClick={() => setMoreOpen(false)}>
          <section className="mobile-more-menu" aria-label="More navigation" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-more-heading">
              <div><span>Workspace</span><strong>More tools</strong></div>
              <button aria-label="Close more navigation" onClick={() => setMoreOpen(false)} type="button"><X aria-hidden="true" size={20} /></button>
            </div>
            <nav>
              {moreItems.map(({ label, href, icon: Icon }) => {
                const active = isNavigationItemActive(pathname, href);
                return (
                  <Link className={active ? "active" : undefined} href={href} key={href} onClick={() => setMoreOpen(false)} aria-current={active ? "page" : undefined}>
                    <Icon aria-hidden="true" size={20} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
          </section>
        </div>
      ) : null}
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {mainItems.slice(0, 2).map(({ shortLabel, label, href, icon: Icon }) => {
          const active = isNavigationItemActive(pathname, href);
          return <Link className={active ? "active" : undefined} href={href} key={href} aria-current={active ? "page" : undefined}><Icon aria-hidden="true" size={20} />{shortLabel ?? label}</Link>;
        })}
        <Link className={`mobile-add${pathname === "/transactions/new" ? " active" : ""}`} href="/transactions/new" aria-current={pathname === "/transactions/new" ? "page" : undefined}>
          <span><Plus aria-hidden="true" size={23} /></span>
          Add
        </Link>
        {mainItems.slice(2).map(({ label, href, icon: Icon }) => {
          const active = isNavigationItemActive(pathname, href);
          return <Link className={active ? "active" : undefined} href={href} key={href} aria-current={active ? "page" : undefined}><Icon aria-hidden="true" size={20} />{label}</Link>;
        })}
        <button className={`mobile-more-trigger${moreActive ? " active" : ""}`} type="button" aria-label="Open more navigation" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)}>
          <Menu aria-hidden="true" size={20} />
          More
        </button>
      </nav>
    </>
  );
}
