"use client";

import { Building2, Info } from "lucide-react";
import { useBusiness } from "@/hooks/use-business";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";
import { BrowserLocalExport } from "./browser-local-export";
import { TelegramLink } from "./telegram-link";

export function SettingsWorkspace() {
  const business = useBusiness().data;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Workspace preferences"
        title="Settings"
        description="Manage how your business workspace connects and keeps its local records."
      />

      <div className="settings-layout">
        <section className="settings-card settings-business-card" aria-labelledby="business-details-title">
          <div className="settings-card-icon" aria-hidden="true"><Building2 size={20} /></div>
          <div className="settings-card-content">
            <div className="settings-card-heading">
              <div>
                <p className="section-kicker">Business profile</p>
                <h2 id="business-details-title">{business?.name ?? "Business details"}</h2>
              </div>
              <span className="settings-status">Coming soon</span>
            </div>
            <p>Your business profile was set up during onboarding. Editing those details will be available in a future update.</p>
          </div>
        </section>

        <TelegramLink />

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
      </div>
    </AppShell>
  );
}
