import { describe, expect, it } from "vitest";
import { createVoiceClientTools, type VoiceClientToolDeps, type VoiceDraftController } from "@/components/voice/client-tools";
import { VOICE_LIVE_TOOLS } from "./live-tools";

const noopController: VoiceDraftController = {
  setTransaction: () => undefined,
  patchTransaction: () => undefined,
  getTransaction: () => null,
  clearTransaction: () => undefined,
  setInvoice: () => undefined,
  patchInvoice: () => undefined,
  getInvoice: () => null,
  clearInvoice: () => undefined,
  setReminder: () => undefined,
  getReminder: () => null,
  setPendingDelete: () => undefined,
  getPendingDelete: () => null,
  setPendingPayment: () => undefined,
  getPendingPayment: () => null,
  setCustomer: () => undefined,
  getCustomer: () => null,
  setLastConfirmation: () => undefined,
};

const deps: VoiceClientToolDeps = {
  businessId: "biz",
  createdBy: "user",
  draft: noopController,
  listTransactions: async () => [],
  createTransaction: async () => { throw new Error("unused"); },
  listInvoices: async () => [],
  nextInvoiceNumber: async () => "INV-1024",
  createInvoice: async () => { throw new Error("unused"); },
  navigate: () => undefined,
  getContext: () => ({ pathname: "/voice", businessName: "Kedai Ali" }),
};

const runtimeToolNames = Object.keys(createVoiceClientTools(deps)).sort();
const declaredNames = VOICE_LIVE_TOOLS.map((tool) => tool.name).sort();

describe("VOICE_LIVE_TOOLS", () => {
  it("declares exactly the tools exposed by createVoiceClientTools", () => {
    expect(declaredNames).toEqual(runtimeToolNames);
  });

  it("contains no unfilled template placeholders", () => {
    expect(JSON.stringify(VOICE_LIVE_TOOLS)).not.toContain("{{");
  });

  it("has no duplicate names", () => {
    expect(new Set(declaredNames).size).toBe(declaredNames.length);
  });

  it("uses an object JSON schema for every tool", () => {
    for (const tool of VOICE_LIVE_TOOLS) {
      expect(tool.type).toBe("function");
      expect(tool.description?.length ?? 0).toBeGreaterThan(0);
      const parameters = tool.parameters as {
        type: string;
        additionalProperties: boolean;
        properties: Record<string, { type: string; description: string }>;
        required: readonly string[];
      };
      expect(parameters.type).toBe("object");
      expect(parameters.additionalProperties).toBe(false);
      for (const name of parameters.required) expect(Object.keys(parameters.properties)).toContain(name);
      for (const property of Object.values(parameters.properties)) {
        expect(["string", "number", "boolean"]).toContain(property.type);
      }
    }
  });
});
