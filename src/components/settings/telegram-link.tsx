"use client";

import { Check, Link2, Send, ShieldCheck } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

type Business = { id: string; name: string };
type LinkCode = { code: string; expiresAt: string };

export function TelegramLink() {
  const { mode, status } = useAuth();
  const selectId = useId();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [link, setLink] = useState<LinkCode | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode !== "supabase" || status !== "authenticated") return;
    let active = true;
    void fetch("/api/telegram/link-code", { cache: "no-store" })
      .then(async (response) => ({ response, body: await response.json() as { businesses?: Business[]; error?: string } }))
      .then(({ response, body }) => {
        if (!active) return;
        if (!response.ok) { setMessage(body.error ?? "Could not load businesses eligible for Telegram linking."); return; }
        const nextBusinesses = body.businesses ?? [];
        setBusinesses(nextBusinesses);
        setBusinessId((current) => current || nextBusinesses[0]?.id || "");
      })
      .catch(() => { if (active) setMessage("Could not load businesses eligible for Telegram linking."); });
    return () => { active = false; };
  }, [mode, status]);

  if (mode !== "supabase") return null;

  async function issueCode() {
    if (!businessId) return;
    setLoading(true);
    setMessage(null);
    setLink(null);
    try {
      const response = await fetch("/api/telegram/link-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      const body = await response.json() as LinkCode & { error?: string };
      if (!response.ok) { setMessage(body.error ?? "Could not create a Telegram link code."); return; }
      setLink({ code: body.code, expiresAt: body.expiresAt });
    } catch { setMessage("Could not create a Telegram link code. Please try again."); }
    finally { setLoading(false); }
  }

  const expiry = link ? new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(link.expiresAt)) : null;
  return <section className="settings-card telegram-link-card" aria-labelledby="telegram-link-title">
    <div className="settings-card-icon telegram-link-icon" aria-hidden="true"><Send size={20} /></div>
    <div className="settings-card-content">
      <div className="settings-card-heading">
        <div>
          <p className="section-kicker">Connected capture</p>
          <h2 id="telegram-link-title">Link Telegram</h2>
        </div>
        <span className="settings-status settings-status-ready"><ShieldCheck size={15} aria-hidden="true" />Private chat only</span>
      </div>
      <p>Send transactions to the bot from Telegram, then review them in this workspace. Your Telegram username is not used as your identity.</p>

      {businesses.length > 1 ? <label className="settings-field" htmlFor={selectId}>Business<select id={selectId} value={businessId} onChange={(event) => setBusinessId(event.target.value)}>{businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></label> : null}
      {businesses.length === 0 && status === "authenticated" ? <p role="status" className="settings-notice">You need an active business membership with transaction access before linking Telegram.</p> : null}

      {!link ? <div className="telegram-link-action"><div><strong>Get a one-time link code</strong><span>It expires after 10 minutes for your privacy.</span></div><button type="button" onClick={issueCode} disabled={loading || !businessId} className="button button-primary">{loading ? "Creating code…" : <><Link2 aria-hidden="true" size={18} />Create link code</>}</button></div> : null}
      {link ? <div className="telegram-link-code" role="status"><div className="telegram-link-code-heading"><span><Check aria-hidden="true" size={17} />Code ready</span><small>Expires {expiry}</small></div><p>Open a private chat with the bot and send this message:</p><code>/link {link.code}</code><button type="button" onClick={issueCode} disabled={loading} className="button button-secondary">{loading ? "Creating code…" : "Create a new code"}</button></div> : null}
      {message ? <p role="status" className="settings-error">{message}</p> : null}
    </div>
  </section>;
}
