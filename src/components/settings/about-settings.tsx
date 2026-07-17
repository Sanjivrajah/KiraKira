"use client";

import { Info, ExternalLink } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

const APP_VERSION = "0.1.0";

export function AboutSettings() {
  const { mode } = useAuth();

  return (
    <section className="settings-section settings-about" aria-labelledby="about-title">
      <div className="settings-section-heading">
        <div>
          <p className="section-kicker">Application</p>
          <h2 id="about-title">About</h2>
        </div>
        <Info aria-hidden="true" size={18} />
      </div>

      <dl className="settings-about-list">
        <div className="settings-about-item">
          <dt>Application</dt>
          <dd>NiagaAI</dd>
        </div>
        <div className="settings-about-item">
          <dt>Version</dt>
          <dd>{APP_VERSION}</dd>
        </div>
        <div className="settings-about-item">
          <dt>Session mode</dt>
          <dd>
            <span className={`settings-mode-badge${mode === "supabase" ? " is-connected" : ""}`}>
              {mode === "supabase" ? "Connected workspace" : "Demo session"}
            </span>
          </dd>
        </div>
      </dl>

      <nav className="settings-link-list" aria-label="Legal and support links">
        <a href="#" className="settings-link-item">
          <span>Privacy policy</span>
          <span className="settings-link-soon">Coming soon</span>
          <ExternalLink size={14} aria-hidden="true" />
        </a>
        <a href="#" className="settings-link-item">
          <span>Terms of service</span>
          <span className="settings-link-soon">Coming soon</span>
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      </nav>
    </section>
  );
}
