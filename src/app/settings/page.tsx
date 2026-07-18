import { AuthGate } from "@/components/auth/auth-gate";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";

export default function SettingsPage() {
  return <AuthGate gate="dashboard"><SettingsWorkspace /></AuthGate>;
}
