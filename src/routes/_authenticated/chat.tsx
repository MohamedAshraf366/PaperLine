import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Send } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { listDocuments } from "@/lib/documents.functions";
import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  sendChatMessage,
  updateConversationDocuments,
} from "@/lib/chat.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Chat — Paperline" },
      {
        name: "description",
        content: "Ask questions across several documents at once and keep the conversation.",
      },
      { property: "og:title", content: "Chat — Paperline" },
      {
        property: "og:description",
        content: "Ask questions across several documents at once and keep the conversation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { data: ctx } = useWorkspace();
  const { t } = useI18n();
  const qc = useQueryClient();
  const fetchConversations = useServerFn(listConversations);
  const fetchConversation = useServerFn(getConversation);
  const fetchDocuments = useServerFn(listDocuments);
  const create = useServerFn(createConversation);
  const remove = useServerFn(deleteConversation);
  const setDocs = useServerFn(updateConversationDocuments);
  const send = useServerFn(sendChatMessage);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);

  const workspaceId = ctx?.workspace.id;

  const { data: conversations } = useQuery({
    queryKey: ["conversations", workspaceId],
    queryFn: () => fetchConversations({ data: { workspaceId: workspaceId! } }),
    enabled: !!workspaceId,
  });

  const { data: documents } = useQuery({
    queryKey: ["documents", workspaceId],
    queryFn: () => fetchDocuments({ data: { workspaceId: workspaceId! } }),
    enabled: !!workspaceId,
  });

  const { data: active } = useQuery({
    queryKey: ["conversation", activeId],
    queryFn: () => fetchConversation({ data: { conversationId: activeId! } }),
    enabled: !!activeId,
  });

  const ready = (documents ?? []).filter((d) => d.status === "ready");

  async function newConversation() {
    if (!workspaceId) return;
    try {
      const { conversationId } = await create({
        data: { workspaceId, documentIds: ready.map((d) => d.id) },
      });
      setActiveId(conversationId);
      await qc.invalidateQueries({ queryKey: ["conversations", workspaceId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.startChat"));
    }
  }

  async function deleteOne(id: string) {
    try {
      await remove({ data: { conversationId: id } });
      if (activeId === id) setActiveId(null);
      await qc.invalidateQueries({ queryKey: ["conversations", workspaceId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.deleteConversation"));
    }
  }

  async function toggleDoc(documentId: string, on: boolean) {
    if (!active) return;
    const current: string[] = active.conversation.document_ids ?? [];
    const next = on ? [...current, documentId] : current.filter((id) => id !== documentId);
    await setDocs({ data: { conversationId: active.conversation.id, documentIds: next } });
    await qc.invalidateQueries({ queryKey: ["conversation", activeId] });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId || !question.trim()) return;
    setBusy(true);
    const asked = question;
    setQuestion("");
    try {
      await send({ data: { conversationId: activeId, question: asked } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["conversation", activeId] }),
        qc.invalidateQueries({ queryKey: ["conversations", workspaceId] }),
      ]);
    } catch (err) {
      setQuestion(asked);
      toast.error(err instanceof Error ? err.message : t("errors.noAnswer"));
    } finally {
      setBusy(false);
    }
  }

  const selected: string[] = active?.conversation.document_ids ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)_16rem]">
      <div className="space-y-2">
        <Button onClick={newConversation} className="w-full" disabled={!ready.length}>
          <Plus className="me-2 h-4 w-4" aria-hidden />
          {t("chat.newChat")}
        </Button>
        {!ready.length && <p className="text-xs text-muted-foreground">{t("chat.uploadFirst")}</p>}
        <div className="space-y-1">
          {(conversations ?? []).map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-1 rounded-md px-2 py-2 text-sm ${
                activeId === c.id ? "bg-accent" : "hover:bg-accent/60"
              }`}
            >
              <button
                onClick={() => setActiveId(c.id)}
                className="min-w-0 flex-1 truncate text-start"
              >
                {c.title}
              </button>
              <button
                onClick={() => deleteOne(c.id)}
                className="opacity-0 transition-opacity group-hover:opacity-100"
                aria-label={t("chat.deleteConversation")}
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        <h1 className="text-3xl font-semibold">{t("chat.title")}</h1>
        {!activeId && <p className="text-muted-foreground">{t("chat.empty")}</p>}

        {activeId && (
          <>
            <div className="space-y-4">
              {(active?.messages ?? []).map((m) => (
                <div
                  key={m.id}
                  className={
                    m.role === "user"
                      ? "ms-auto max-w-[85%] rounded-lg bg-primary px-4 py-3 text-sm text-primary-foreground"
                      : "max-w-[90%] rounded-lg border border-border bg-card px-4 py-3 text-sm"
                  }
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.role === "assistant" && m.citations.length > 0 && (
                    <div className="mt-3 border-t border-border pt-2">
                      <p className="text-xs font-medium uppercase text-muted-foreground">
                        {t("chat.sources")}
                      </p>
                      <ol className="mt-1 space-y-1">
                        {m.citations.map((c, i) => (
                          <li key={i} className="text-xs text-muted-foreground">
                            [{i + 1}] {c.documentName}
                            {c.page ? `, ${t("common.page").toLowerCase()} ${c.page}` : ""}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              ))}
              {busy && <p className="text-sm text-muted-foreground">{t("chat.reading")}</p>}
            </div>

            <form onSubmit={submit} className="flex items-end gap-2">
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={t("chat.placeholder")}
                rows={2}
              />
              <Button type="submit" disabled={busy}>
                <Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
                <span className="sr-only">{t("chat.send")}</span>
              </Button>
            </form>
          </>
        )}
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">{t("chat.docsInChat")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!activeId && <p className="text-xs text-muted-foreground">{t("chat.noChat")}</p>}
          {activeId &&
            ready.map((d) => (
              <label key={d.id} className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={selected.includes(d.id)}
                  onCheckedChange={(v) => toggleDoc(d.id, v === true)}
                />
                <span className="min-w-0 break-words">{d.name}</span>
              </label>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
