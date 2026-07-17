"use client";

import { Info } from "lucide-react";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useBusiness } from "@/hooks/use-business";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";
import { BrowserLocalExport } from "./browser-local-export";
import { TelegramLink } from "./telegram-link";
import { AppearanceSettings } from "./appearance-settings";
import { RegionalSettings } from "./regional-settings";
import { AccountSettings } from "./account-settings";
import { AboutSettings } from "./about-settings";
import { BusinessProfileSettings } from "./business-profile-settings";
import { MyInvoisConnectionSettings } from "./myinvois-connection-settings";

// Canonical section keys (produced by the voice `navigate` tool via
// voice-navigation.ts) mapped to the heading element ids already rendered by
// each settings card, so `?section=` can scroll the owner to the right place.
const SECTION_ANCHORS: Record<string, string> = {
  "business-profile": "business-details-title",
  "myinvois-connection": "myinvois-connection-title",
  telegram: "telegram-link-title",
  appearance: "appearance-title",
  regional: "regional-title",
  "data-tools": "data-tools-title",
  account: "account-title",
  about: "about-title",
};

export function SettingsWorkspace() {
  const business = useBusiness();
  const searchParams = useSearchParams();
  const section = searchParams.get("section");

  useEffect(() => {
    if (!section) return;
    const anchorId = SECTION_ANCHORS[section];
    if (!anchorId) return;
    // Wait a frame so the target exists after data-dependent sections render.
    const raf = requestAnimationFrame(() => {
      const target = document.getElementById(anchorId);
      if (!target) return;
      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(raf);
  }, [section, business.data]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Workspace preferences"
        title="Settings"
        description="Manage how your business workspace connects and keeps its local records."
      />

      <div className="settings-layout">
        {business.data ? <BusinessProfileSettings key={`${business.data.id}-${business.data.updatedAt}`} business={business.data} /> : <section className="settings-card" aria-labelledby="business-details-title"><div className="settings-card-content"><h2 id="business-details-title">Business profile</h2><p>{business.isPending ? "Loading business details…" : "No active business profile is available."}</p></div></section>}
        {business.data ? <MyInvoisConnectionSettings key={business.data.id} business={business.data} /> : null}

        <TelegramLink />

        <AppearanceSettings />

        <RegionalSettings />

        <section className="settings-section" aria-labelledby="data-tools-title">
          <div className="settings-section-heading">
            <div>
              <p className="section-kicker">Local workspace</p>
              <h2 id="data-tools-title">Data tools</h2>
            </div>
            <Info aria-hidden="true" size={18} />
          </div>
          <BrowserLocalExport />
        </section>

        <AccountSettings />

        <AboutSettings />
      </div>
    </AppShell>
  );
}
