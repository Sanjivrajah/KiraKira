"use client";

import { useEffect, useRef } from "react";
import { create } from "zustand";

/**
 * A tiny, typed command bus for agentic actions a URL can't express (adding a
 * line to the open invoice, bulk-selecting ready e-invoices). Voice tools
 * `dispatch` a command; the relevant page subscribes with `useVoiceUiCommand`,
 * runs it, and consumes it. The command union is deliberately small and closed
 * — there is no generic "run any action" escape hatch.
 */
export type VoiceUiCommand =
  | { id: number; type: "invoice.addLineItem" }
  | { id: number; type: "einvoice.selectAllReady" };

export type VoiceUiCommandType = VoiceUiCommand["type"];

interface VoiceUiBusState {
  queue: VoiceUiCommand[];
  nextId: number;
  dispatch: (type: VoiceUiCommandType) => void;
  consume: (id: number) => void;
}

export const useVoiceUiBus = create<VoiceUiBusState>((set) => ({
  queue: [],
  nextId: 1,
  dispatch: (type) =>
    set((state) => ({
      queue: [...state.queue, { id: state.nextId, type } as VoiceUiCommand],
      nextId: state.nextId + 1,
    })),
  consume: (id) => set((state) => ({ queue: state.queue.filter((command) => command.id !== id) })),
}));

/**
 * Runs `handler` once for each queued command of `type`, then consumes it.
 * The handler always sees the latest render's closure (via a ref), so it can
 * read current page state at execution time.
 */
export function useVoiceUiCommand(
  type: VoiceUiCommandType,
  handler: (command: VoiceUiCommand) => void,
): void {
  const queue = useVoiceUiBus((state) => state.queue);
  const consume = useVoiceUiBus((state) => state.consume);
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(() => {
    const match = queue.find((command) => command.type === type);
    if (!match) return;
    handlerRef.current(match);
    consume(match.id);
  }, [queue, type, consume]);
}
