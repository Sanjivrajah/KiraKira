import { describe, expect, it } from "vitest";
import { normalizeSupabaseTimestamp } from "@/lib/supabase/timestamp";

describe("Supabase orchestration timestamps", () => {
  it("normalizes PostgREST offset timestamps before schema validation", () => {
    expect(normalizeSupabaseTimestamp("2026-07-17T01:12:00+00:00")).toBe("2026-07-17T01:12:00.000Z");
  });
});
