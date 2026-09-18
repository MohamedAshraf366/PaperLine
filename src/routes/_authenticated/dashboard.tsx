import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText } from "lucide-react";
import { useWorkspace, formatBytes } from "@/hooks/useWorkspace";
import { listDocuments } from "@/lib/documents.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Paperline" },
      { name: "description", content: "Your document workspace at a glance." },
      { property: "og:title", content: "Dashboard — Paperline" },
      { property: "og:description", content: "Your document workspace at a glance." },
    ],
  }),
  component: Dashboard,
});

function Meter({
  label,
  used,
  limit,
  format,
}: {
  label: string;
  used: number;
  limit: number;
  format?: (n: number) => string;
}) {
  const fmt = format ?? ((n: number) => String(n));
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span>
          {fmt(used)} / {fmt(limit)}
        </span>
      </div>
      <Progress value={Math.min(100, (used / Math.max(1, limit)) * 100)} className="mt-2 h-2" />
    </div>
  );
}

function Dashboard() {
  const { data: ctx, isLoading, isError, error } = useWorkspace();
  const { t } = useI18n();
  const fetchDocs = useServerFn(listDocuments);
  const { data: docs } = useQuery({
    queryKey: ["documents", ctx?.workspace.id],
    queryFn: () => fetchDocs({ data: { workspaceId: ctx!.workspace.id } }),
    enabled: !!ctx,
  });

  if (isError)
    return (
      <p className="text-destructive">
        {t("errors.loadWorkspace", {
          message: (error as Error)?.message ?? t("errors.generic"),
        })}
      </p>
    );
  if (isLoading || !ctx)
    return <p className="text-muted-foreground">{t("dashboard.loadingWorkspace")}</p>;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">{ctx.workspace.name}</h1>
        <p className="mt-1 text-muted-foreground">
          {t("dashboard.planLine", { plan: ctx.plan.name, count: ctx.usage.documents })}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.thisMonth")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-3">
          <Meter
            label={t("plans.docs")}
            used={ctx.usage.documents}
            limit={ctx.plan.max_documents}
          />
          <Meter
            label={t("plans.storage")}
            used={ctx.usage.storageBytes}
            limit={ctx.plan.max_storage_bytes}
            format={formatBytes}
          />
          <Meter
            label={t("plans.questions")}
            used={ctx.usage.questionsThisMonth}
            limit={ctx.plan.max_questions_month}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>{t("dashboard.recent")}</CardTitle>
          <Button asChild size="sm">
            <Link to="/documents">{t("dashboard.upload")}</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {(docs ?? []).slice(0, 6).map((doc) => (
            <Link
              key={doc.id}
              to="/documents/$documentId"
              params={{ documentId: doc.id }}
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2 hover:bg-accent"
            >
              <FileText className="h-4 w-4 text-primary" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm">{doc.name}</span>
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
            </Link>
          ))}
          {docs && docs.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("dashboard.empty")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
