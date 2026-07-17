"use client";

import { Info } from "lucide-react";
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

export function SettingsWorkspace() {
  const business = useBusiness();

  return (
    <AppShell>
      <PageHeader
        eyebrow="Workspace preferences"
        title="Settings"
        description="Manage how your business workspace connects and keeps its local records."
      />

      <div className="settings-layout">
        {business.data ? <BusinessProfileSettings key={`${business.data.id}-${business.data.updatedAt}`} business={business.data} /> : <section className="settings-card" aria-labelledby="business-details-title"><div className="settings-card-content"><h2 id="business-details-title">Business profile</h2><p>{business.isPending ? "Loading business details…" : "No active business profile is available."}</p></div></section>}

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
