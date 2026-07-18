import type { ReactNode } from "react";
import { AuthGate } from "@/components/auth/auth-gate";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

interface FeaturePlaceholderProps {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  action?: ReactNode;
}

export function FeaturePlaceholder({
  title,
  description,
  emptyTitle,
  emptyDescription,
  action,
}: FeaturePlaceholderProps) {
  return (
    <AuthGate gate="dashboard">
      <AppShell>
        <PageHeader eyebrow="Coming next" title={title} description={description} action={action} />
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </AppShell>
    </AuthGate>
  );
}
