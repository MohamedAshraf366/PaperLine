import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RotateCw } from "lucide-react";
import { useWorkspace, formatBytes } from "@/hooks/useWorkspace";
import {
  getDocument,
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
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search["q"] === "string" ? search["q"] : undefined,
  }),
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

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>;
  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, "ig"));
  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap">
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark
            key={i}
            className="rounded-sm bg-yellow-200 px-0.5 text-inherit dark:bg-yellow-900/60"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </p>
  );
}

function DocumentPage() {
  const { documentId } = Route.useParams();
  const q = Route.useSearch().q ?? "";
  const { data: ctx } = useWorkspace();
  const contentRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchDoc = useServerFn(getDocument);
  const ask = useServerFn(askQuestion);
  const reprocess = useServerFn(reprocessDocument);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [answer, setAnswer] = useState<{ answer: string; citations: Citation[] } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => fetchDoc({ data: { documentId } }),
  });

  const content = (data?.document as { content: string | null } | undefined)?.content ?? "";

  useEffect(() => {
    if (!q || !content) return;
    const first = contentRef.current?.querySelector("mark");
    if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [q, content]);

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

      {content && (
        <CollapsibleSection title={t("document.content")}>
          <div ref={contentRef}>
            <HighlightedText text={content} query={q} />
          </div>
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
                      <p className="font-medium">
                        [{i + 1}] {c.documentName}
                        {c.page ? `, ${t("common.page").toLowerCase()} ${c.page}` : ""}
                      </p>
                      <p className="mt-1 text-muted-foreground">{c.snippet}…</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
