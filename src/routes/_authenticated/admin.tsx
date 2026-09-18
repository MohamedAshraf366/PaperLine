import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getAdminStats, setWorkspaceSuspended } from "@/lib/admin.functions";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Paperline" },
      { name: "description", content: "Platform overview: workspaces, documents and activity." },
      { property: "og:title", content: "Admin — Paperline" },
      {
        property: "og:description",
        content: "Platform overview: workspaces, documents and activity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { data: ctx } = useWorkspace();
  const { t } = useI18n();
  const qc = useQueryClient();
  const fetchStats = useServerFn(getAdminStats);
  const suspend = useServerFn(setWorkspaceSuspended);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => fetchStats({}),
    enabled: ctx?.isPlatformAdmin === true,
  });

  if (ctx && !ctx.isPlatformAdmin)
    return <p className="text-muted-foreground">{t("admin.noAccess")}</p>;
  if (isLoading || !data) return <p className="text-muted-foreground">{t("common.loading")}</p>;
  if (error)
    return (
      <p className="text-destructive">
        {error instanceof Error ? error.message : t("errors.loadAdmin")}
      </p>
    );

  const peak = Math.max(1, ...data.daily.map((d) => d.uploads + d.questions));

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold">{t("admin.title")}</h1>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: t("admin.workspaces"), value: data.totals.workspaces },
          { label: t("plans.docs"), value: data.totals.documents },
          { label: t("team.members"), value: data.totals.members },
          { label: t("admin.questions30"), value: data.totals.questions },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.activity")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-end gap-1">
            {data.daily.map((d) => (
              <div
                key={d.day}
                className="flex-1"
                title={t("admin.barTitle", {
                  day: d.day,
                  uploads: d.uploads,
                  questions: d.questions,
                })}
              >
                <div
                  className="w-full rounded-t bg-primary/70"
                  style={{ height: `${((d.uploads + d.questions) / peak) * 100}%` }}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.workspaces")}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {data.workspaces.map((w) => (
            <div key={w.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{w.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t("admin.workspaceMeta", {
                    plan: w.plan_id,
                    documents: w.documents,
                    members: w.members,
                  })}
                </p>
              </div>
              {w.suspended && <Badge variant="destructive">{t("admin.suspended")}</Badge>}
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await suspend({ data: { workspaceId: w.id, suspended: !w.suspended } });
                    await qc.invalidateQueries({ queryKey: ["admin-stats"] });
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : t("errors.updateFailed"));
                  }
                }}
              >
                {w.suspended ? t("admin.restore") : t("admin.suspend")}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
