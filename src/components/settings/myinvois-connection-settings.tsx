"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Pencil, PlugZap } from "lucide-react";
import { FormField } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { maskSensitiveIdentifier } from "@/lib/privacy/mask-sensitive-identifier";
import type { Business } from "@/types";

type ConnectionResult = { taxpayerIdentity: string; authMode: "taxpayer" | "intermediary" };

async function post(body: Record<string, unknown>) {
  const response = await fetch("/api/e-invoices/connections", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({})) as { error?: string; result?: ConnectionResult };
  if (!response.ok || !data.result) throw new Error(data.error || "The MyInvois connection could not be saved.");
  return data.result;
}

export function MyInvoisConnectionSettings({ business }: { business: Business }) {
  const [tin, setTin] = useState(business.tin ?? "");
  const [rob, setRob] = useState(business.registrationScheme === "brn" ? business.registrationNumber ?? "" : "");
  const [authMode, setAuthMode] = useState<"taxpayer" | "intermediary">("taxpayer");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ConnectionResult | null>(null);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setResult(null);
    if (!/^[A-Z]{1,2}[0-9]{8,14}$/.test(tin.trim().toUpperCase())) {
      setError("Enter a valid Malaysian taxpayer TIN."); return;
    }
    if (rob.trim() && !/^[A-Z0-9-]{1,30}$/.test(rob.trim().toUpperCase())) {
      setError("Use a valid ROB registration value, or leave it blank."); return;
    }
    setSaving(true);
    try {
      setResult(await post({ action: "configure_sandbox", businessId: business.id, authMode, taxpayerTin: tin.trim(), ...(rob.trim() ? { taxpayerRegistrationValue: rob.trim() } : {}) }));
      setIsEditing(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The MyInvois connection could not be saved."); }
    finally { setSaving(false); }
  };

  const startEditing = () => {
    setError("");
    setResult(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setTin(business.tin ?? "");
    setRob(business.registrationScheme === "brn" ? business.registrationNumber ?? "" : "");
    setAuthMode("taxpayer");
    setError("");
    setIsEditing(false);
  };

  return <section className="settings-card settings-business-card" aria-labelledby="myinvois-connection-title">
    <div className="settings-card-icon" aria-hidden="true"><PlugZap size={20} /></div>
    <div className="settings-card-content">
      <div className="settings-card-heading"><div><p className="section-kicker">e-Invoice connection</p><h2 id="myinvois-connection-title">MyInvois sandbox</h2></div><span className="settings-status settings-status-ready">{isEditing ? "Editing" : "Self-service"}</span></div>
      <p>Set the taxpayer identity for this business. Credentials stay on the server and are never shown here.</p>
      {isEditing ? <form className="settings-business-form" onSubmit={save} noValidate>
        <div className="settings-business-form-grid">
          <SelectField label="Connection type" name="authMode" value={authMode} options={[{ value: "taxpayer", label: "This business is the taxpayer" }, { value: "intermediary", label: "We represent this taxpayer" }]} onChange={(event) => setAuthMode(event.target.value as typeof authMode)} />
          <FormField label="Taxpayer TIN" name="myinvoisTin" required value={tin} onChange={(event) => setTin(event.target.value)} hint="Use the taxpayer TIN registered with MyInvois." />
          <FormField label="ROB registration number (optional)" name="myinvoisRob" value={rob} onChange={(event) => setRob(event.target.value)} hint="Used with the TIN to form the represented taxpayer identity." />
        </div>
        {error ? <p className="settings-error" role="alert">{error}</p> : null}
        <div className="settings-business-actions">
          <button className="button button-secondary" disabled={saving} type="button" onClick={cancelEditing}>Cancel</button>
          <button className="button button-primary" disabled={saving} type="submit">{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </form> : <>
        {result ? <div className="settings-profile-success" role="status"><CheckCircle2 aria-hidden="true" size={18} /><span>Sandbox connection saved. Go to e-Invoice preparation to test it before submitting.</span></div> : null}
        <dl className="settings-business-summary">
          <div><dt>Connection type</dt><dd>{authMode === "taxpayer" ? "This business is the taxpayer" : "We represent this taxpayer"}</dd></div>
          <div><dt>Taxpayer TIN</dt><dd>{maskSensitiveIdentifier(tin)}</dd></div>
          <div className="settings-business-summary-wide"><dt>ROB registration number</dt><dd>{rob.trim() || "Not provided"}</dd></div>
        </dl>
        <div className="settings-business-actions"><button className="button button-primary" type="button" onClick={startEditing}><Pencil aria-hidden="true" size={16} />Edit connection</button></div>
      </>}
    </div>
  </section>;
}
