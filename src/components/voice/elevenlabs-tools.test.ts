import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createVoiceClientTools, type VoiceClientToolDeps, type VoiceDraftController } from "./client-tools";

interface ElevenLabsTool {
  type: string;
  name: string;
  description: string;
  expects_response: boolean;
  execution_mode: string;
  parameters: { id: string; type: string; value_type: string; description: string; required?: boolean }[];
}

const toolsJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "plan/voice/elevenlabs-tools.json"), "utf8"),
) as ElevenLabsTool[];

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
const jsonToolNames = toolsJson.map((tool) => tool.name).sort();

describe("elevenlabs-tools.json", () => {
  it("declares exactly the tools exposed by createVoiceClientTools", () => {
    expect(jsonToolNames).toEqual(runtimeToolNames);
  });

  it("has no duplicate tool names", () => {
    expect(new Set(jsonToolNames).size).toBe(jsonToolNames.length);
  });

  it("uses the client-tool schema shape for every entry", () => {
    for (const tool of toolsJson) {
      expect(tool.type).toBe("client");
      expect(tool.expects_response).toBe(true);
      expect(tool.execution_mode).toBe("immediate");
      expect(Array.isArray(tool.parameters)).toBe(true);
      expect(tool.description.length).toBeGreaterThan(0);
      for (const parameter of tool.parameters) {
        expect(parameter.value_type).toBe("llm_prompt");
        expect(parameter.id.length).toBeGreaterThan(0);
      }
    }
  });
});
