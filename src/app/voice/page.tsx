import type { Metadata } from "next";
import { AuthGate } from "@/components/auth/auth-gate";
import { AppShell } from "@/components/layout/app-shell";
import { VoiceAgentPanel } from "@/components/voice/voice-agent-panel";

export const metadata: Metadata = {
  title: "Voice assistant",
  description: "Have a live voice conversation with NiagaAI to capture records, check your numbers, and prepare invoices.",
};

export default function VoicePage() {
  return <AuthGate gate="dashboard"><AppShell><VoiceAgentPanel /></AppShell></AuthGate>;
}
