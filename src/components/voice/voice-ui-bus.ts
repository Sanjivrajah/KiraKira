"use client";

import { useEffect, useRef } from "react";
import { create } from "zustand";

/**
 * A tiny, typed command bus for agentic actions a URL can't express (adding a
 * line to the open invoice, filling/approving/submitting e-invoices). Voice
 * tools `dispatch` a command; the relevant page subscribes with
 * `useVoiceUiCommand`, runs it, and consumes it. The command union is
 * deliberately small and closed — there is no generic "run any action" hatch.
 *
 * A subscriber may return `false` to decline a command (e.g. its data hasn't
 * loaded yet); the command then stays queued and is retried when the
 * subscriber's dependencies change. This makes navigate-then-act flows reliable
 * even though the target page mounts and fetches after the command is queued.
 */
export type VoiceUiCommand =
  | { type: "invoice.addLineItem" }
  | { type: "einvoice.selectAllReady" }
  | { type: "einvoice.fillField"; label: string; value: string }
  | { type: "einvoice.approve" }
  | { type: "einvoice.submit" };

export type VoiceUiCommandType = VoiceUiCommand["type"];
export type QueuedCommand = VoiceUiCommand & { id: number };

interface VoiceUiBusState {
  queue: QueuedCommand[];
  nextId: number;
  dispatch: (command: VoiceUiCommand) => void;
  consume: (id: number) => void;
}

export const useVoiceUiBus = create<VoiceUiBusState>((set) => ({
  queue: [],
  nextId: 1,
  dispatch: (command) =>
    set((state) => ({
      queue: [...state.queue, { ...command, id: state.nextId } as QueuedCommand],
      nextId: state.nextId + 1,
    })),
  consume: (id) => set((state) => ({ queue: state.queue.filter((command) => command.id !== id) })),
}));

/**
 * Runs `handler` for the next queued command of `type`, then consumes it —
 * unless the handler returns `false`, which leaves it queued for a later retry.
 * Pass `deps` so the effect re-evaluates (and can finally satisfy a declined
 * command) when the page's own state changes.
 */
export function useVoiceUiCommand<T extends VoiceUiCommandType>(
  type: T,
  handler: (command: Extract<QueuedCommand, { type: T }>) => void | boolean,
  deps: unknown[] = [],
): void {
  const queue = useVoiceUiBus((state) => state.queue);
  const consume = useVoiceUiBus((state) => state.consume);
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(() => {
    const match = queue.find((command) => command.type === type) as
      | Extract<QueuedCommand, { type: T }>
      | undefined;
    if (!match) return;
    const handled = handlerRef.current(match);
    if (handled !== false) consume(match.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, type, consume, ...deps]);
}
