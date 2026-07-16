import { AuthGate } from "@/components/auth/auth-gate";
import { AppShell } from "@/components/layout/app-shell";
import { ReminderList } from "@/components/reminders/reminder-list";

export default function RemindersPage() {
  return <AuthGate gate="dashboard"><AppShell><ReminderList /></AppShell></AuthGate>;
}
