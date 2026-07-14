"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { useNiagaStore } from "@/store/use-niaga-store";
import { businessTypeLabels } from "@/components/onboarding/business-preview";
import { services } from "@/services";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const user = useNiagaStore((state) => state.user);
  const business = useNiagaStore((state) => state.business);
  const signOut = useNiagaStore((state) => state.signOut);
  const resetDemo = useNiagaStore((state) => state.resetDemo);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<"signout" | "reset" | null>(null);
  const initials = (user?.name || "Demo User").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  const confirm = async () => {
    if (dialog === "signout") {
      signOut();
      router.replace("/login");
    } else if (dialog === "reset") {
      resetDemo();
      await services.demo.reset().catch(() => undefined);
      router.replace("/");
    }
    setDialog(null);
  };

  return (
    <div className="app-layout">
      <Sidebar businessName={business?.name} businessType={business ? businessTypeLabels[business.type] : undefined} />
      <div className="app-main">
        <Topbar
          initials={initials}
          menuOpen={menuOpen}
          onReset={() => { setMenuOpen(false); setDialog("reset"); }}
          onSignOut={() => { setMenuOpen(false); setDialog("signout"); }}
          onToggleMenu={() => setMenuOpen((open) => !open)}
        />
        <main className="page-container">{children}</main>
      </div>
      <MobileNav />
      <ConfirmationDialog
        confirmLabel={dialog === "reset" ? "Reset demo" : "Sign out"}
        description={dialog === "reset"
          ? "This removes the demo user, business profile, transactions, invoices, and reminder history stored on this device. This cannot be undone."
          : "This ends the active session, but keeps the business profile on this demo device for your next sign-in."}
        onCancel={() => setDialog(null)}
        onConfirm={confirm}
        open={dialog !== null}
        title={dialog === "reset" ? "Reset the entire demo?" : "Sign out of NiagaAI?"}
      />
    </div>
  );
}
