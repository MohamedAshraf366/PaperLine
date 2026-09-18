import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertMember, checkLimits, retrieve, type Citation } from "./documents.functions";

export type ConversationRow = {
  id: string;
  title: string;
  document_ids: string[];
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations: Citation[];
  created_at: string;
};

function textOf(parts: unknown): string {
  if (typeof parts === "string") return parts;
  if (Array.isArray(parts))
    return parts
      .map((p) => (typeof p === "string" ? p : String((p as { text?: string }).text ?? "")))
      .join("");
  return String((parts as { text?: string } | null)?.text ?? "");
}

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { workspaceId: string }) => data)
  .handler(async ({ data, context }): Promise<ConversationRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("paperline_conversations")
      .select("id, title, document_ids, created_at, updated_at")
      .eq("workspace_id", data.workspaceId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as ConversationRow[];
  });

export const createConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { workspaceId: string; documentIds: string[]; title?: string }) => data)
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.workspaceId, context.userId);
    const { data: row, error } = await context.supabase
      .from("paperline_conversations")
      .insert({
        workspace_id: data.workspaceId,
        created_by: context.userId,
        document_ids: data.documentIds,
        title: (data.title ?? "New chat").slice(0, 120),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { conversationId: row.id as string };
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { conversationId: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("paperline_conversations")
      .delete()
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { conversationId: string }) => data)
  .handler(async ({ data, context }) => {
    const [{ data: conversation, error }, { data: rows }] = await Promise.all([
      context.supabase
        .from("paperline_conversations")
        .select("id, title, document_ids, workspace_id, created_at, updated_at")
        .eq("id", data.conversationId)
        .maybeSingle(),
      context.supabase
        .from("paperline_messages")
        .select("id, role, parts, citations, created_at")
        .eq("conversation_id", data.conversationId)
        .order("created_at", { ascending: true }),
    ]);
    if (error) throw new Error(error.message);
    if (!conversation) throw new Error("Conversation not found");
    const messages: ChatMessage[] = (rows ?? []).map((r) => ({
      id: r.id,
      role: r.role === "assistant" ? "assistant" : "user",
      text: textOf(r.parts),
      citations: (r.citations ?? []) as Citation[],
      created_at: r.created_at,
    }));
    return { conversation, messages };
  });

export const updateConversationDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { conversationId: string; documentIds: string[] }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("paperline_conversations")
      .update({ document_ids: data.documentIds, updated_at: new Date().toISOString() })
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Answers a chat message from the selected documents and saves both turns. */
export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { conversationId: string; question: string }) => data)
  .handler(async ({ data, context }): Promise<{ user: ChatMessage; assistant: ChatMessage }> => {
    const { data: conversation, error: cErr } = await context.supabase
      .from("paperline_conversations")
      .select("id, workspace_id, document_ids, title")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!conversation) throw new Error("Conversation not found");

    await Promise.all([
      assertMember(context.supabase, conversation.workspace_id, context.userId),
      checkLimits(conversation.workspace_id, "question"),
    ]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { chat } = await import("./ai.server");

    const [{ data: history }, hits] = await Promise.all([
      context.supabase
        .from("paperline_messages")
        .select("role, parts")
        .eq("conversation_id", data.conversationId)
        .order("created_at", { ascending: true })
        .limit(20),
      retrieve(
        conversation.workspace_id,
        conversation.document_ids?.length ? conversation.document_ids : null,
        data.question,
        10,
      ),
    ]);

    const passages = hits
      .map(
        (h, i) => `[${i + 1}] (${h.documentName}${h.page ? `, page ${h.page}` : ""})\n${h.content}`,
      )
      .join("\n\n---\n\n");

    const answer = await chat(
      [
        {
          role: "system",
          content:
            "You answer questions about the user's documents using only the numbered passages provided. Cite passages inline as [1], [2] and name the document and page. If the passages do not contain the answer, say so plainly.",
        },
        ...(history ?? []).map((m) => ({
          role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
          content: textOf(m.parts).slice(0, 4000),
        })),
        {
          role: "user" as const,
          content: `Passages:\n\n${passages}\n\nQuestion: ${data.question}`,
        },
      ],
      { maxTokens: 1200 },
    );

    const citations: Citation[] = hits.map((h) => ({
      documentId: h.document_id,
      documentName: h.documentName,
      snippet: h.content.slice(0, 300),
      page: h.page,
    }));

    const { data: saved, error: insErr } = await supabaseAdmin
      .from("paperline_messages")
      .insert([
        {
          conversation_id: data.conversationId,
          workspace_id: conversation.workspace_id,
          role: "user",
          parts: { text: data.question },
          citations: [],
        },
        {
          conversation_id: data.conversationId,
          workspace_id: conversation.workspace_id,
          role: "assistant",
          parts: { text: answer },
          citations,
        },
      ])
      .select("id, role, parts, citations, created_at");
    if (insErr) throw new Error(insErr.message);

    await Promise.all([
      supabaseAdmin.from("paperline_usage_events").insert({
        workspace_id: conversation.workspace_id,
        user_id: context.userId,
        kind: "question",
        amount: 1,
      }),
      supabaseAdmin
        .from("paperline_conversations")
        .update({
          updated_at: new Date().toISOString(),
          ...(conversation.title === "New chat" ? { title: data.question.slice(0, 80) } : {}),
        })
        .eq("id", data.conversationId),
    ]);

    const rows = saved ?? [];
    const userRow = rows.find((r) => r.role === "user");
    const assistantRow = rows.find((r) => r.role === "assistant");
    return {
      user: {
        id: userRow?.id ?? "user",
        role: "user",
        text: data.question,
        citations: [],
        created_at: userRow?.created_at ?? new Date().toISOString(),
      },
      assistant: {
        id: assistantRow?.id ?? "assistant",
        role: "assistant",
        text: answer,
        citations,
        created_at: assistantRow?.created_at ?? new Date().toISOString(),
      },
    };
  });
