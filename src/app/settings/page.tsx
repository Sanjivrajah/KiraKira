import { FeaturePlaceholder } from "@/components/shared/feature-placeholder";
import { BrowserLocalExport } from "@/components/settings/browser-local-export";

export default function SettingsPage() {
  return <div className="space-y-6"><FeaturePlaceholder title="Business details" description="Business profile editing is planned for a later session." emptyTitle="Business details are coming next" emptyDescription="For now, the demo uses the business profile created during onboarding. Use the profile menu to sign out or reset the local demo." /><BrowserLocalExport /></div>;
}
