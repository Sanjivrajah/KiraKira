/** Convert PostgREST `timestamptz` strings (often `+00:00`) to canonical UTC for Zod schemas. */
export function normalizeSupabaseTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("Supabase returned an invalid timestamp.");
  return parsed.toISOString();
}
