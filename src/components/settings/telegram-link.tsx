"use client";

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
  return <section className="rounded-lg border border-slate-200 p-4" aria-labelledby="telegram-link-title">
    <h2 id="telegram-link-title" className="text-base font-semibold">Link Telegram</h2>
    <p className="mt-1 text-sm text-slate-600">Link a private Telegram chat to an authenticated business. No Telegram username is needed or used as your identity.</p>
    {businesses.length > 1 ? <label className="mt-3 block text-sm font-medium text-slate-800" htmlFor={selectId}>Business<select id={selectId} value={businessId} onChange={(event) => setBusinessId(event.target.value)} className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3">{businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></label> : null}
    {businesses.length === 0 && status === "authenticated" ? <p role="status" className="mt-3 text-sm text-slate-600">You need an active business membership with transaction access before linking Telegram.</p> : null}
    <button type="button" onClick={issueCode} disabled={loading || !businessId} className="mt-3 min-h-11 rounded-md bg-slate-900 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Creating link code…" : "Create Telegram link code"}</button>
    {link ? <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-800"><p>In a private chat with the bot, send:</p><code className="mt-2 block break-all rounded bg-white p-2 text-xs">/link {link.code}</code><p className="mt-2">This code is shown once and expires {expiry}.</p></div> : null}
    {message ? <p role="status" className="mt-3 text-sm text-rose-700">{message}</p> : null}
  </section>;
}
