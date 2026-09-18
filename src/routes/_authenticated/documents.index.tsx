import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, Upload, Trash2, RotateCw, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace, formatBytes } from "@/hooks/useWorkspace";
import {
  listDocuments,
  processDocument,
  deleteDocument,
  reprocessDocument,
} from "@/lib/documents.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

type UploadStage = "waiting" | "uploading" | "reading" | "summarising" | "done" | "error";

const STAGE_PERCENT: Record<UploadStage, number> = {
  waiting: 4,
  uploading: 25,
  reading: 60,
  summarising: 85,
  done: 100,
  error: 100,
};

type UploadItem = {
  id: string;
  file: File;
  name: string;
  stage: UploadStage;
  message?: string | undefined;
  documentId?: string;
};

export const Route = createFileRoute("/_authenticated/documents/")({
  head: () => ({
    meta: [
      { title: "Documents — Paperline" },
      { name: "description", content: "Your team's uploaded documents and their AI summaries." },
      { property: "og:title", content: "Documents — Paperline" },
      {
        property: "og:description",
        content: "Your team's uploaded documents and their AI summaries.",
      },
    ],
  }),
  component: DocumentsPage,
});

const KINDS: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/csv": "csv",
};

function kindFor(file: File): string | null {
  if (KINDS[file.type]) return KINDS[file.type]!;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && ["pdf", "docx", "xlsx", "csv"].includes(ext)) return ext;
  return null;
}

function DocumentsPage() {
  const { data: ctx } = useWorkspace();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchDocs = useServerFn(listDocuments);
  const process = useServerFn(processDocument);
  const remove = useServerFn(deleteDocument);
  const reprocess = useServerFn(reprocessDocument);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [items, setItems] = useState<UploadItem[]>([]);

  function patch(id: string, changes: Partial<UploadItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...changes } : it)));
  }

  const { data: docs, isLoading } = useQuery({
    queryKey: ["documents", ctx?.workspace.id],
    queryFn: () => fetchDocs({ data: { workspaceId: ctx!.workspace.id } }),
    enabled: !!ctx,
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["documents"] });
    queryClient.invalidateQueries({ queryKey: ["workspace-context"] });
  }

  async function runUpload(item: UploadItem) {
    if (!ctx) return;
    const { file } = item;
    const kind = kindFor(file);
    if (!kind) {
      patch(item.id, { stage: "error", message: t("documents.unsupported") });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      patch(item.id, { stage: "error", message: t("documents.tooLarge") });
      return;
    }
    patch(item.id, { stage: "uploading", message: undefined });
    const path = `${ctx.workspace.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("documents").upload(path, file);
    if (error) {
      patch(item.id, { stage: "error", message: error.message });
      return;
    }
    patch(item.id, { stage: "reading" });
    const bump = setTimeout(() => patch(item.id, { stage: "summarising" }), 5000);
    try {
      const result = await process({
        data: {
          workspaceId: ctx.workspace.id,
          name: file.name,
          storagePath: path,
          sizeBytes: file.size,
          mimeType: file.type || kind,
          fileKind: kind,
        },
      });
      if (result.status === "ready") {
        patch(item.id, { stage: "done", documentId: result.documentId });
        toast.success(t("documents.readyToast", { name: file.name }));
      } else {
        patch(item.id, {
          stage: "error",
          message: result.error,
          documentId: result.documentId,
        });
        toast.error(t("documents.failedToast", { name: file.name, error: result.error ?? "" }));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("errors.uploadFailed");
      patch(item.id, { stage: "error", message: msg });
      toast.error(msg);
    } finally {
      clearTimeout(bump);
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length || !ctx) return;
    const list = Array.from(files).map<UploadItem>((file) => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      stage: "waiting",
    }));
    setItems(list);
    setUploading(true);
    for (const item of list) await runUpload(item);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    refresh();
  }

  async function retryItem(item: UploadItem) {
    if (uploading) return;
    setUploading(true);
    try {
      if (item.documentId) {
        patch(item.id, { stage: "reading", message: undefined });
        const result = await reprocess({ data: { documentId: item.documentId } });
        if (result.status === "ready") {
          patch(item.id, { stage: "done", message: undefined });
          toast.success(t("documents.readyToast", { name: item.name }));
        } else {
          patch(item.id, { stage: "error", message: result.error });
          toast.error(t("documents.failedToast", { name: item.name, error: result.error ?? "" }));
        }
      } else {
        await runUpload(item);
      }
      refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("errors.uploadFailed");
      patch(item.id, { stage: "error", message: msg });
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  async function retryDocument(id: string) {
    setRetryingId(id);
    try {
      const result = await reprocess({ data: { documentId: id } });
      if (result.status === "ready") {
        toast.success(t("status.ready"));
      } else {
        toast.error(result.error ?? t("errors.uploadFailed"));
      }
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.uploadFailed"));
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{t("documents.title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("documents.subtitle")}</p>
        </div>
        <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
          <Upload className="me-2 h-4 w-4" aria-hidden />
          {uploading ? t("documents.uploading") : t("documents.upload")}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.csv"
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>

      <Dialog
        open={items.length > 0}
        onOpenChange={(open) => {
          if (!open && !uploading) setItems([]);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {uploading ? t("documents.dialogUploading") : t("documents.dialogFinished")}
            </DialogTitle>
            <DialogDescription>
              {uploading ? t("documents.dialogKeepOpen") : t("documents.dialogCanClose")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {items.map((it) => (
              <div key={it.id} className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  {it.stage === "done" ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
                  ) : it.stage === "error" ? (
                    <XCircle className="h-4 w-4 text-destructive" aria-hidden />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1 truncate font-medium">{it.name}</span>
                  <span className="text-xs text-muted-foreground">{STAGE_PERCENT[it.stage]}%</span>
                </div>
                <Progress value={STAGE_PERCENT[it.stage]} />
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      "text-xs",
                      it.stage === "error" ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {it.message ?? t(`documents.stages.${it.stage}`)}
                  </p>
                  {it.stage === "error" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={uploading}
                      onClick={() => retryItem(it)}
                    >
                      <RotateCw className="me-2 h-3.5 w-3.5" aria-hidden />
                      {t("common.retry")}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!uploading && (
            <Button variant="secondary" onClick={() => setItems([])}>
              {t("common.close")}
            </Button>
          )}
        </DialogContent>
      </Dialog>

      {isLoading && <p className="text-muted-foreground">{t("documents.loadingDocuments")}</p>}

      {docs && docs.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 font-medium">{t("documents.emptyTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("documents.emptyBody")}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {(docs ?? []).map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
          >
            <FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <Link
                to="/documents/$documentId"
                params={{ documentId: doc.id }}
                className="block truncate font-medium hover:underline"
              >
                {doc.name}
              </Link>
              <p className="truncate text-xs text-muted-foreground">
                {doc.file_kind.toUpperCase()} · {formatBytes(Number(doc.size_bytes))} ·{" "}
                {new Date(doc.created_at).toLocaleDateString()}
                {doc.status === "failed" && doc.error_message ? ` · ${doc.error_message}` : ""}
              </p>
            </div>
            <Badge
              variant={
                doc.status === "ready"
                  ? "secondary"
                  : doc.status === "failed"
                    ? "destructive"
                    : "outline"
              }
            >
              {t(`status.${doc.status}`)}
            </Badge>
            {doc.status === "failed" && (
              <Button
                size="sm"
                variant="outline"
                disabled={retryingId === doc.id}
                onClick={() => retryDocument(doc.id)}
                className="gap-1.5"
              >
                <RotateCw
                  className={cn("h-3.5 w-3.5", retryingId === doc.id && "animate-spin")}
                  aria-hidden
                />
                {t("documents.retry")}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                await remove({ data: { documentId: doc.id } });
                refresh();
                toast.success(t("documents.deleted"));
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              <span className="sr-only">{t("documents.deleteSr", { name: doc.name })}</span>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
