import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveAuthMode } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

export const runtime = "nodejs";

const businessQuerySchema = z.string().uuid();
const startSchema = z.object({
  businessId: z.string().uuid(),
  providerConversationId: z.string().trim().min(1).max(200),
}).strict();
const turnSchema = z.object({
  conversationId: z.string().uuid(),
  turnIndex: z.number().int().min(1).max(1000),
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(8000),
}).strict();
const endSchema = z.object({
  conversationId: z.string().uuid(),
  status: z.enum(["completed", "failed"]),
}).strict();
const deleteSchema = z.object({ conversationId: z.string().uuid() }).strict();

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function failure(error: string, status: number) {
  return response({ error }, status);
}

async function authenticatedClient() {
  const client = await createSupabaseServerClient();
  const { data: auth, error } = await client.auth.getUser();
  return { client, user: error ? null : auth.user };
}

/** Returns the signed-in owner's recent, business-scoped transcript history. */
export async function GET(request: Request) {
  if (resolveAuthMode() !== "supabase") return response({ enabled: false, conversations: [] });

  const parsedBusinessId = businessQuerySchema.safeParse(new URL(request.url).searchParams.get("businessId"));
  if (!parsedBusinessId.success) return failure("Choose a valid business to load voice history.", 400);

  const { client, user } = await authenticatedClient();
  if (!user) return failure("Sign in before loading voice history.", 401);

  const { data: conversations, error } = await client
    .from("voice_conversations")
    .select("id,status,started_at,ended_at,retention_delete_after")
    .eq("business_id", parsedBusinessId.data)
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(12);
  if (error) return failure("Could not load voice history.", 500);
  if (!conversations?.length) return response({ enabled: true, conversations: [] });

  const conversationIds = conversations.map((conversation) => conversation.id);
  const { data: turns, error: turnsError } = await client
    .from("voice_conversation_turns")
    .select("conversation_id,turn_index,role,content,created_at")
    .in("conversation_id", conversationIds)
    .order("turn_index", { ascending: true })
    .limit(360);
  if (turnsError) return failure("Could not load voice history.", 500);

  const turnsByConversation = new Map<string, typeof turns>();
  for (const turn of turns ?? []) {
    const existing = turnsByConversation.get(turn.conversation_id) ?? [];
    existing.push(turn);
    turnsByConversation.set(turn.conversation_id, existing);
  }

  return response({
    enabled: true,
    conversations: conversations.map((conversation) => ({
      id: conversation.id,
      status: conversation.status,
      startedAt: conversation.started_at,
      endedAt: conversation.ended_at,
      retentionDeleteAfter: conversation.retention_delete_after,
      turns: (turnsByConversation.get(conversation.id) ?? []).map((turn) => ({
        index: turn.turn_index,
        role: turn.role,
        text: turn.content,
        createdAt: turn.created_at,
      })),
    })),
  });
}

/** Starts a private transcript record after ElevenLabs establishes a session. */
export async function POST(request: Request) {
  if (resolveAuthMode() !== "supabase") return response({ enabled: false, conversationId: null });

  const parsed = startSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("Could not start transcript storage for this conversation.", 400);

  const { client, user } = await authenticatedClient();
  if (!user) return failure("Sign in before saving a voice conversation.", 401);

  const { data: membership, error: membershipError } = await client
    .from("business_members")
    .select("business_id")
    .eq("business_id", parsed.data.businessId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError || !membership) return failure("You cannot save conversations for this business.", 403);

  const { data, error } = await client
    .from("voice_conversations")
    .insert({
      business_id: membership.business_id,
      user_id: user.id,
      provider_conversation_id: parsed.data.providerConversationId,
    })
    .select("id,retention_delete_after")
    .single();
  if (error) return failure("The conversation started, but its transcript could not be saved.", 500);

  return response({ enabled: true, conversationId: data.id, retentionDeleteAfter: data.retention_delete_after }, 201);
}

/** Upserts a turn because the provider may stream progressively fuller text. */
export async function PUT(request: Request) {
  if (resolveAuthMode() !== "supabase") return response({ enabled: false });

  const parsed = turnSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("The transcript turn was invalid.", 400);

  const { client, user } = await authenticatedClient();
  if (!user) return failure("Sign in before saving a transcript.", 401);

  const { error } = await client.from("voice_conversation_turns").upsert({
    conversation_id: parsed.data.conversationId,
    turn_index: parsed.data.turnIndex,
    role: parsed.data.role,
    content: parsed.data.content,
  }, { onConflict: "conversation_id,turn_index" });
  if (error) return failure("A transcript turn could not be saved.", 500);

  return response({ enabled: true });
}

/** Marks a stored session complete or failed without exposing provider details. */
export async function PATCH(request: Request) {
  if (resolveAuthMode() !== "supabase") return response({ enabled: false });

  const parsed = endSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("The conversation status was invalid.", 400);

  const { client, user } = await authenticatedClient();
  if (!user) return failure("Sign in before updating a voice conversation.", 401);

  const { data, error } = await client
    .from("voice_conversations")
    .update({ status: parsed.data.status, ended_at: new Date().toISOString() })
    .eq("id", parsed.data.conversationId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) return failure("The conversation status could not be saved.", 500);
  if (!data) return failure("The saved conversation was not found.", 404);

  return response({ enabled: true });
}

/** Lets the transcript owner delete a conversation and all of its turns. */
export async function DELETE(request: Request) {
  if (resolveAuthMode() !== "supabase") return response({ enabled: false });

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("Choose a valid conversation to delete.", 400);

  const { client, user } = await authenticatedClient();
  if (!user) return failure("Sign in before deleting a voice conversation.", 401);

  const { data, error } = await client
    .from("voice_conversations")
    .delete()
    .eq("id", parsed.data.conversationId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) return failure("The conversation could not be deleted.", 500);
  if (!data) return failure("The saved conversation was not found.", 404);

  return response({ enabled: true });
}
