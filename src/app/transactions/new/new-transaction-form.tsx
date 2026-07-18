"use client";

import { useEffect, useState } from "react";
import { TransactionCaptureFlow } from "@/components/transactions/transaction-capture-flow";
import { useVoiceDraftStore } from "@/components/voice/voice-draft-store";
import { voiceTransactionToDraft } from "@/components/voice/voice-draft-to-form";
import type { TransactionSourceType } from "@/types";

/**
 * Client boundary for the "add evidence" route. When the voice agent staged a
 * transaction and the owner didn't pick a specific method/review target, open
 * straight into review with the fields filled in, then clear the draft.
 */
export function NewTransactionForm({ initialMethod, demoScenario, reviewTransactionId }: {
  initialMethod?: TransactionSourceType;
  demoScenario?: "ambiguous-receipt";
  reviewTransactionId?: string;
}) {
  const transactionDraft = useVoiceDraftStore((state) => state.transaction);
  const clearTransaction = useVoiceDraftStore((state) => state.clearTransaction);
  // Only prefill when this visit isn't already driven by a method/review intent.
  const canPrefill = !initialMethod && !demoScenario && !reviewTransactionId;
  const [voicePrefill] = useState(() =>
    canPrefill && transactionDraft ? voiceTransactionToDraft(transactionDraft) : undefined,
  );

  useEffect(() => {
    if (voicePrefill) clearTransaction();
  }, [voicePrefill, clearTransaction]);

  return (
    <TransactionCaptureFlow
      demoScenario={demoScenario}
      initialMethod={initialMethod}
      reviewTransactionId={reviewTransactionId}
      voicePrefill={voicePrefill}
    />
  );
}
