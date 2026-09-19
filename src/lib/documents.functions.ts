import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type DocumentRow = {
  id: string;
  name: string;
  file_kind: string;
  size_bytes: number;
  status: "processing" | "ready" | "failed";
  summary: string | null;
  error_message: string | null;
  page_count: number | null;
  word_count: number | null;
  created_at: string;
};

export async function assertMember(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  userId: string,
) {
  const { data } = await supabase
    .from("paperline_workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("You are not a member of this workspace.");
}

export async function checkLimits(workspaceId: string, kind: "document" | "question") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // One round trip: workspace + its plan.
  const { data: ws } = await supabaseAdmin
    .from("paperline_workspaces")
    .select(
      "plan_id, suspended, paperline_plans(max_documents, max_questions_month, max_storage_bytes)",
    )
    .eq("id", workspaceId)
    .single();
  if (!ws) throw new Error("Workspace not found");
  if (ws.suspended) throw new Error("This workspace is suspended.");
  const plan = (
    ws as unknown as {
      paperline_plans: {
        max_documents: number;
        max_questions_month: number;
        max_storage_bytes: number;
      } | null;
    }
  ).paperline_plans;
  if (!plan) return;
  if (kind === "document") {
    const { count } = await supabaseAdmin
      .from("paperline_documents")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);
    if ((count ?? 0) >= plan.max_documents)
      throw new Error(`Your plan allows ${plan.max_documents} documents. Upgrade to add more.`);
  } else {
    const since = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("paperline_usage_events")
      .select("amount")
      .eq("workspace_id", workspaceId)
      .eq("kind", "question")
      .gte("created_at", since);
    const used = (rows ?? []).reduce((s, r) => s + Number(r.amount ?? 1), 0);
    if (used >= plan.max_questions_month)
      throw new Error(
        `Your plan allows ${plan.max_questions_month} AI questions a month. Upgrade for more.`,
      );
  }
}

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { workspaceId: string }) => data)
  .handler(async ({ data, context }): Promise<DocumentRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("paperline_documents")
      .select(
        "id, name, file_kind, size_bytes, status, summary, error_message, page_count, word_count, created_at",
      )
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as DocumentRow[];
  });

export const getDocument = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { documentId: string }) => data)
  .handler(async ({ data, context }) => {
    const [{ data: doc, error }, { data: extraction }] = await Promise.all([
      context.supabase
        .from("paperline_documents")
        .select("*")
        .eq("id", data.documentId)
        .maybeSingle(),
      context.supabase
        .from("paperline_extractions")
        .select("fields, created_at")
        .eq("document_id", data.documentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (error) throw new Error(error.message);
    if (!doc) throw new Error("Document not found");
    return { document: doc, extraction: extraction ?? null };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { documentId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: doc } = await context.supabase
      .from("paperline_documents")
      .select("id, storage_path, workspace_id")
      .eq("id", data.documentId)
      .maybeSingle();
    if (!doc) throw new Error("Document not found");
    await context.supabase.storage.from("documents").remove([doc.storage_path]);
    const { error } = await context.supabase.from("paperline_documents").delete().eq("id", doc.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

type IngestResult = {
  documentId: string;
  status: "ready" | "failed";
  error?: string;
};

/** Downloads, parses, chunks, embeds and summarises a document that already has a row. */
async function ingestDocument(opts: {
  documentId: string;
  workspaceId: string;
  userId: string;
  name: string;
  fileKind: string;
  storagePath: string;
  recordUpload: boolean;
}): Promise<IngestResult> {
  const { documentId, workspaceId, userId, name, fileKind, storagePath, recordUpload } = opts;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { parseFile, chunkPages } = await import("./parse.server");
  const { embedTexts, chat } = await import("./ai.server");

  try {
    const { data: file, error: dlError } = await supabaseAdmin.storage
      .from("documents")
      .download(storagePath);
    if (dlError || !file) throw new Error(dlError?.message ?? "Could not read the uploaded file.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = await parseFile(fileKind, bytes);
    if (!parsed.text || parsed.text.length < 20)
      throw new Error("No readable text was found in this file.");

    const chunks = chunkPages(parsed.pages.length ? parsed.pages : [parsed.text]);

    // Indexing and summarising are independent — run them at the same time.
    const indexing = embedTexts(chunks.map((c) => c.content)).then(async (embeddings) => {
      for (let i = 0; i < chunks.length; i += 100) {
        const slice = chunks.slice(i, i + 100);
        const { error: insErr } = await supabaseAdmin.from("paperline_document_chunks").insert(
          slice.map((chunk, j) => ({
            document_id: documentId,
            workspace_id: workspaceId,
            chunk_index: i + j,
            content: chunk.content,
            page_number: chunk.page,
            embedding: JSON.stringify(embeddings[i + j]),
          })),
        );
        if (insErr) throw new Error(insErr.message);
      }
    });

    // Summarising is best-effort — an AI outage (e.g. exhausted credits) must
    // not block the document from becoming ready. QA can catch up once AI works.
    const summarising = chat(
      [
        {
          role: "system",
          content:
            "You summarise business documents. Write a clear summary in 4-6 short bullet points, plain language, no preamble.",
        },
        { role: "user", content: `Document: ${name}\n\n${parsed.text.slice(0, 40000)}` },
      ],
      { maxTokens: 700 },
    ).catch(() => null);

    const [, summary] = await Promise.all([indexing, summarising]);

    const updates: PromiseLike<unknown>[] = [
      supabaseAdmin
        .from("paperline_documents")
        .update({
          status: "ready",
          error_message: null,
          content: parsed.text.slice(0, 400000),
          summary,
          page_count: parsed.pageCount ?? null,
          word_count: parsed.text.split(/\s+/).length,
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId),
    ];
    if (recordUpload) {
      updates.push(
        supabaseAdmin.from("paperline_usage_events").insert({
          workspace_id: workspaceId,
          user_id: userId,
          kind: "upload",
          amount: 1,
          document_id: documentId,
        }),
      );
    }
    await Promise.all(updates);

    return { documentId, status: "ready" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Processing failed";
    await supabaseAdmin
      .from("paperline_documents")
      .update({ status: "failed", error_message: message })
      .eq("id", documentId);
    return { documentId, status: "failed", error: message };
  }
}

/** Registers an uploaded file, then parses, chunks, embeds and summarises it. */
export const processDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      workspaceId: string;
      name: string;
      storagePath: string;
      sizeBytes: number;
      mimeType: string;
      fileKind: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await Promise.all([
      assertMember(context.supabase, data.workspaceId, context.userId),
      checkLimits(data.workspaceId, "document"),
    ]);

    const { data: doc, error } = await context.supabase
      .from("paperline_documents")
      .insert({
        workspace_id: data.workspaceId,
        uploaded_by: context.userId,
        name: data.name,
        storage_path: data.storagePath,
        mime_type: data.mimeType,
        file_kind: data.fileKind,
        size_bytes: data.sizeBytes,
        status: "processing",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return ingestDocument({
      documentId: doc.id as string,
      workspaceId: data.workspaceId,
      userId: context.userId,
      name: data.name,
      fileKind: data.fileKind,
      storagePath: data.storagePath,
      recordUpload: true,
    });
  });

/** Re-runs the parse/embed/summarise pipeline for a document that already exists. */
export const reprocessDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { documentId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase
      .from("paperline_documents")
      .select("id, workspace_id, name, file_kind, storage_path")
      .eq("id", data.documentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) throw new Error("Document not found");
    await assertMember(context.supabase, doc.workspace_id, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("paperline_document_chunks").delete().eq("document_id", doc.id);
    await supabaseAdmin
      .from("paperline_documents")
      .update({ status: "processing", error_message: null })
      .eq("id", doc.id);

    return ingestDocument({
      documentId: doc.id,
      workspaceId: doc.workspace_id,
      userId: context.userId,
      name: doc.name,
      fileKind: doc.file_kind,
      storagePath: doc.storage_path,
      recordUpload: false,
    });
  });

export type Citation = {
  documentId: string;
  documentName: string;
  snippet: string;
  page: number | null;
};

export async function retrieve(
  workspaceId: string,
  documentIds: string[] | null,
  question: string,
  count = 8,
): Promise<{ content: string; document_id: string; documentName: string; page: number | null }[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { embedTexts } = await import("./ai.server");
  const [embedding] = await embedTexts([question]);
  const params = {
    query_embedding: JSON.stringify(embedding),
    _workspace: workspaceId,
    ...(documentIds ? { _document_ids: documentIds } : {}),
    match_count: count,
  };
  const { data, error } = await supabaseAdmin.rpc("match_chunks", params);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as {
    content: string;
    document_id: string;
    page_number: number | null;
  }[];
  const ids = [...new Set(rows.map((r) => r.document_id))];
  const { data: docs } = await supabaseAdmin
    .from("paperline_documents")
    .select("id, name")
    .in("id", ids);
  const names = new Map((docs ?? []).map((d) => [d.id, d.name]));
  return rows.map((r) => ({
    ...r,
    page: r.page_number ?? null,
    documentName: names.get(r.document_id) ?? "Document",
  }));
}

export const askQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { workspaceId: string; documentIds: string[] | null; question: string }) => data,
  )
  .handler(async ({ data, context }) => {
    await Promise.all([
      assertMember(context.supabase, data.workspaceId, context.userId),
      checkLimits(data.workspaceId, "question"),
    ]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { chat } = await import("./ai.server");

    const hits = await retrieve(data.workspaceId, data.documentIds, data.question);
    const contextText = hits
      .map(
        (h, i) => `[${i + 1}] (${h.documentName}${h.page ? `, page ${h.page}` : ""})\n${h.content}`,
      )
      .join("\n\n---\n\n");

    const answer = await chat(
      [
        {
          role: "system",
          content:
            "Answer strictly from the numbered passages. Cite the passages you use as [1], [2], naming the document and page. If the passages do not contain the answer, say so plainly.",
        },
        { role: "user", content: `Passages:\n\n${contextText}\n\nQuestion: ${data.question}` },
      ],
      { maxTokens: 900 },
    );

    await supabaseAdmin.from("paperline_usage_events").insert({
      workspace_id: data.workspaceId,
      user_id: context.userId,
      kind: "question",
      amount: 1,
    });

    return {
      answer,
      citations: hits.map((h) => ({
        documentId: h.document_id,
        documentName: h.documentName,
        snippet: h.content.slice(0, 300),
        page: h.page,
      })) as Citation[],
    };
  });

export const searchDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { workspaceId: string; query: string }) => data)
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.workspaceId, context.userId);
    const hits = await retrieve(data.workspaceId, null, data.query, 12);
    return hits.map((h) => ({
      documentId: h.document_id,
      documentName: h.documentName,
      snippet: h.content.slice(0, 400),
      page: h.page,
    }));
  });

/** Answers a query from the live web when the workspace has no matching passages. */
export const searchWeb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { workspaceId: string; query: string }) => data)
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.workspaceId, context.userId);
    const { chatWeb } = await import("./ai.server");
    return chatWeb(
      [
        {
          role: "system",
          content:
            "Answer the question using up-to-date web results. Be concise, use short paragraphs or bullet points, and cite sources inline.",
        },
        { role: "user", content: data.query },
      ],
      { maxTokens: 900 },
    );
  });
