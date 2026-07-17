"use client";

import { LogOut, Trash2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-provider";
import { clearFrontendDomainStorage } from "@/frontend/storage";
import { STORAGE_KEYS } from "@/lib/storage/storage-keys";
import { clearQueryCache } from "@/lib/query/query-client";
import { browserStorage } from "@/lib/storage/browser-storage";

export function AccountSettings() {
  const { signOut, mode } = useAuth();
  const queryClient = useQueryClient();
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearMessage, setClearMessage] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      setSigningOut(false);
    }
  }

  function handleClearData() {
    // Clear the canonical frontend domain storage
    clearFrontendDomainStorage();
    // Clear legacy storage keys
    Object.values(STORAGE_KEYS).forEach((key) => browserStorage.remove(key));
    // Invalidate React Query cache
    clearQueryCache(queryClient);
    setConfirmClear(false);
    setClearMessage("All local data has been cleared. The page will reload in a moment.");
    setTimeout(() => window.location.reload(), 1500);
  }

  return (
    <section className="settings-section" aria-labelledby="account-title">
      <div className="settings-section-heading">
        <div>
          <p className="section-kicker">Session</p>
          <h2 id="account-title">Account</h2>
        </div>
      </div>

      <div className="settings-account-actions">
        <div className="settings-account-row">
          <div>
            <strong>Sign out</strong>
            <span>End your current {mode === "demo" ? "demo" : ""} session and return to the login screen.</span>
          </div>
          <button
            type="button"
            className="button button-secondary"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            <LogOut size={17} aria-hidden="true" />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>

        <div className="settings-danger-zone">
          <div className="settings-account-row">
            <div>
              <strong>Clear local data</strong>
              <span>Permanently delete all browser-local transactions, invoices, and business records. This cannot be undone. Export your data first.</span>
            </div>
            {!confirmClear ? (
              <button
                type="button"
                className="button button-danger"
                onClick={() => setConfirmClear(true)}
              >
                <Trash2 size={17} aria-hidden="true" />
                Clear local data
              </button>
            ) : null}
          </div>

          {confirmClear ? (
            <div className="settings-confirm-dialog" role="alert">
              <div className="settings-confirm-warning">
                <AlertTriangle size={18} aria-hidden="true" />
                <p>Are you sure? All local transactions, invoices, and business records will be permanently deleted.</p>
              </div>
              <div className="settings-confirm-actions">
                <button
                  type="button"
                  className="button button-danger"
                  onClick={handleClearData}
                >
                  Yes, delete all local data
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setConfirmClear(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {clearMessage ? <p role="status" className="settings-success">{clearMessage}</p> : null}
        </div>
      </div>
    </section>
  );
}
