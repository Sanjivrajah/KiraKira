import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectLiveVoiceOptions, LiveVoiceConnection } from "./live-client";

const mocks = vi.hoisted(() => ({
  connectLiveVoice: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }), usePathname: () => "/voice" }));
vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ mode: "demo", session: { user: { id: "user-1", name: "Siti" } } }),
}));
vi.mock("@/hooks/use-business", () => ({ useBusiness: () => ({ data: { id: "business-1", name: "Kedai Ali" } }) }));
vi.mock("./live-client", () => ({ connectLiveVoice: mocks.connectLiveVoice }));

import { useVoiceDraftStore } from "./voice-draft-store";
import { useVoiceAgent } from "./use-voice-agent";

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

function fakeConnection(): LiveVoiceConnection {
  return {
    sessionId: "live_1",
    send: vi.fn(),
    setMuted: vi.fn(),
    getInputVolume: () => 0,
    getOutputVolume: () => 0,
    close: vi.fn(async () => undefined),
  };
}

let options: ConnectLiveVoiceOptions | null = null;
let connection: LiveVoiceConnection;

describe("useVoiceAgent", () => {
  beforeEach(() => {
    useVoiceDraftStore.getState().reset();
    connection = fakeConnection();
    mocks.connectLiveVoice.mockImplementation(async (received: ConnectLiveVoiceOptions) => {
      options = received;
      await received.requestAnswer("offer-sdp");
      return connection;
    });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ sdp: "answer", sessionId: "live_1" })));
  });

  afterEach(() => {
    options = null;
    vi.unstubAllGlobals();
  });

  async function connected() {
    const hook = renderHook(() => useVoiceAgent(), { wrapper });
    await act(async () => { await hook.result.current.connect(); });
    return hook;
  }

  it("sends the offer with business and owner context to the session route", async () => {
    const { result } = await connected();

    expect(fetch).toHaveBeenCalledWith("/api/voice/session", expect.objectContaining({ method: "POST" }));
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ sdp: "offer-sdp", businessName: "Kedai Ali", ownerName: "Siti" });
    expect(result.current.status).toBe("connected");
  });

  it("builds captions from transcript events", async () => {
    const { result } = await connected();

    act(() => {
      options?.onEvent({ kind: "transcript", role: "user", delta: "I sold " });
      options?.onEvent({ kind: "transcript", role: "user", delta: "nasi lemak" });
      options?.onEvent({ kind: "transcript", role: "assistant", delta: "Got it." });
    });

    expect(result.current.transcript.map((turn) => [turn.role, turn.text])).toEqual([
      ["user", "I sold nasi lemak"],
      ["assistant", "Got it."],
    ]);
  });

  it("runs delegated tool calls and returns their results to the session", async () => {
    await connected();

    act(() => {
      options?.onEvent({
        kind: "function_call",
        groupId: "item_1",
        callId: "call_1",
        name: "create_transaction_draft",
        arguments: JSON.stringify({ type: "income", amount: 45, description: "nasi lemak" }),
      });
      options?.onEvent({ kind: "response_done", groupId: "item_1", completed: true });
    });

    await waitFor(() => expect(connection.send).toHaveBeenCalledTimes(2));
    expect(useVoiceDraftStore.getState().transaction).toMatchObject({ type: "income", amount: 45 });
    expect(vi.mocked(connection.send).mock.calls[0][0]).toMatchObject({
      type: "response.item.create",
      item: { type: "function_call_output", call_id: "call_1" },
    });
    expect(vi.mocked(connection.send).mock.calls[1][0]).toEqual({ type: "response.create" });
  });

  it("drops tool calls from a response that failed or was cut short", async () => {
    await connected();

    act(() => {
      options?.onEvent({
        kind: "function_call",
        groupId: "item_2",
        callId: "call_2",
        name: "create_transaction_draft",
        arguments: JSON.stringify({ type: "income", amount: 45, description: "nasi lemak" }),
      });
      options?.onEvent({ kind: "response_done", groupId: "item_2", completed: false });
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

    expect(useVoiceDraftStore.getState().transaction).toBeNull();
    expect(connection.send).not.toHaveBeenCalled();

    // A later completed response in the same group must not replay the dropped call.
    act(() => options?.onEvent({ kind: "response_done", groupId: "item_2", completed: true }));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(useVoiceDraftStore.getState().transaction).toBeNull();
  });

  it("explains a 401 from the session route", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "no" }, { status: 401 })));
    const { result } = await connected();

    expect(result.current.error).toBe("Sign in again to use the voice assistant.");
    expect(result.current.status).not.toBe("connected");
  });

  it("closes the session once even when stop is pressed twice", async () => {
    const { result } = await connected();

    await act(async () => {
      result.current.disconnect();
      result.current.disconnect();
    });

    expect(connection.close).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("disconnected");
  });

  it("reports a dropped connection", async () => {
    const { result } = await connected();

    act(() => options?.onEnded("connection_lost"));

    expect(result.current.status).toBe("disconnected");
    expect(result.current.error).toBe("The voice connection dropped. Check your network and try again.");
  });

  it("explains an expired session instead of blaming the network", async () => {
    const { result } = await connected();

    act(() => options?.onEnded("expired"));

    expect(result.current.status).toBe("disconnected");
    expect(result.current.error).toBe("The voice session timed out. Start again when you're ready.");
  });

  it("keeps the session usable after a non-terminal error event", async () => {
    const { result } = await connected();

    act(() => options?.onEvent({ kind: "error", fatal: true }));

    expect(result.current.error).toBeNull();
    expect(result.current.phase).toBe("listening");
  });

  it("does not send tool results once the owner pressed stop", async () => {
    let finishClose: () => void = () => undefined;
    vi.mocked(connection.close).mockImplementation(() => new Promise<void>((resolve) => { finishClose = resolve; }));
    const { result } = await connected();

    act(() => {
      options?.onEvent({ kind: "function_call", groupId: "g", callId: "c", name: "get_current_context", arguments: "{}" });
      result.current.disconnect();
      options?.onEvent({ kind: "response_done", groupId: "g", completed: true });
    });
    // Let the tool finish while the graceful close is still pending.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(connection.send).not.toHaveBeenCalled();

    await act(async () => { finishClose(); });
  });
});
