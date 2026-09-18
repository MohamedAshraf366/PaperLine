import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { RotateCw } from "lucide-react";
import { useWorkspace, formatBytes } from "@/hooks/useWorkspace";
import {
  getDocument,
  getDocumentPages,
  askQuestion,
  reprocessDocument,
  type Citation,
} from "@/lib/documents.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/documents/$documentId")({
  head: () => ({
    meta: [
      { title: "Document — Paperline" },
      { name: "description", content: "Summary, details and AI answers for this document." },
      { property: "og:title", content: "Document — Paperline" },
      { property: "og:description", content: "Summary, details and AI answers for this document." },
    ],
  }),
  component: DocumentPage,
});

function DocumentPage() {
  const { documentId } = Route.useParams();
  const { data: ctx } = useWorkspace();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchDoc = useServerFn(getDocument);
  const fetchPages = useServerFn(getDocumentPages);
  const ask = useServerFn(askQuestion);
  const reprocess = useServerFn(reprocessDocument);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [answer, setAnswer] = useState<{ answer: string; citations: Citation[] } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => fetchDoc({ data: { documentId } }),
  });

  const { data: pages } = useQuery({
    queryKey: ["document-pages", documentId],
    queryFn: () => fetchPages({ data: { documentId } }),
  });

  if (isLoading) return <p className="text-muted-foreground">{t("document.loading")}</p>;
  if (!data) return <p className="text-muted-foreground">{t("document.notFound")}</p>;

  const doc = data.document as {
    name: string;
    status: string;
    summary: string | null;
    file_kind: string;
    size_bytes: number;
    page_count: number | null;
    word_count: number | null;
    error_message: string | null;
  };

  async function retry() {
    setRetrying(true);
    try {
      const result = await reprocess({ data: { documentId } });
      if (result.status === "ready") {
        toast.success(t("documents.readyToast", { name: doc.name }));
      } else {
        toast.error(result.error ?? t("errors.uploadFailed"));
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["document", documentId] }),
        queryClient.invalidateQueries({ queryKey: ["document-pages", documentId] }),
        queryClient.invalidateQueries({ queryKey: ["documents"] }),
        queryClient.invalidateQueries({ queryKey: ["workspace-context"] }),
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.uploadFailed"));
    } finally {
      setRetrying(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ctx || !question.trim()) return;
    setBusy(true);
    try {
      const result = await ask({
        data: { workspaceId: ctx.workspace.id, documentIds: [documentId], question },
      });
      setAnswer(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.noAnswer"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold break-words">{doc.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {doc.file_kind.toUpperCase()} · {formatBytes(Number(doc.size_bytes))}
          {doc.page_count ? ` · ${t("document.pagesCount", { count: doc.page_count })}` : ""}
          {doc.word_count
            ? ` · ${t("document.wordsCount", { count: doc.word_count.toLocaleString() })}`
            : ""}
        </p>
        {doc.status !== "ready" && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={doc.status === "failed" ? "destructive" : "outline"}>
              {doc.status === "failed"
                ? (doc.error_message ?? t("status.failed"))
                : t("status.processing")}
            </Badge>
            {doc.status === "failed" && (
              <Button variant="outline" size="sm" disabled={retrying} onClick={retry}>
                <RotateCw className={cn("me-2 h-4 w-4", retrying && "animate-spin")} aria-hidden />
                {retrying ? t("document.retrying") : t("document.retry")}
              </Button>
            )}
          </div>
        )}
      </div>

      {doc.summary && (
        <CollapsibleSection title={t("document.summary")}>
          <p className="text-sm whitespace-pre-wrap">{doc.summary}</p>
        </CollapsibleSection>
      )}

      <CollapsibleSection title={t("document.askTitle")}>
        <form onSubmit={submit} className="space-y-3">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t("document.askPlaceholder")}
            rows={3}
          />
          <Button type="submit" disabled={busy || doc.status !== "ready"}>
            {busy ? t("document.thinking") : t("document.ask")}
          </Button>
        </form>

        {answer && (
          <div className="mt-4 space-y-4 border-t border-border pt-4">
            <p className="text-sm whitespace-pre-wrap">{answer.answer}</p>
            {answer.citations.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  {t("document.sources")}
                </p>
                <ol className="mt-2 space-y-2">
                  {answer.citations.map((c, i) => (
                    <li key={i} className="rounded-md bg-muted px-3 py-2 text-xs">
                      <button
                        type="button"
                        className="font-medium hover:underline"
                        onClick={() => {
                          const idx = (pages ?? []).findIndex((p) => p.page === c.page);
                          if (idx >= 0) setPageIndex(idx);
                        }}
                      >
                        [{i + 1}] {c.documentName}
                        {c.page ? `, ${t("common.page").toLowerCase()} ${c.page}` : ""}
                      </button>
                      <p className="mt-1 text-muted-foreground">{c.snippet}…</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </CollapsibleSection>

      {(pages ?? []).length > 0 && (
        <CollapsibleSection title={t("document.pages")}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={pageIndex === 0}
                onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
              >
                {t("document.previous")}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t("document.pageOf", {
                  page: pages![Math.min(pageIndex, pages!.length - 1)]!.page,
                  total: pages!.length,
                })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pageIndex >= pages!.length - 1}
                onClick={() => setPageIndex((i) => Math.min(pages!.length - 1, i + 1))}
              >
                {t("document.next")}
              </Button>
            </div>
            <div className="rounded-md border border-border bg-card p-4">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {pages![Math.min(pageIndex, pages!.length - 1)]!.text}
              </p>
            </div>
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
