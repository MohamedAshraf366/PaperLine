import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace, formatBytes } from "@/hooks/useWorkspace";
import { changePlan, listPlans } from "@/lib/team.functions";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/plans")({
  head: () => ({
    meta: [
      { title: "Plans & usage — Paperline" },
      { name: "description", content: "See what you've used this month and change your plan." },
      { property: "og:title", content: "Plans & usage — Paperline" },
      {
        property: "og:description",
        content: "See what you've used this month and change your plan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlansPage,
});

type PlanRow = {
  id: string;
  name: string;
  price_cents: number;
  max_documents: number;
  max_storage_bytes: number;
  max_questions_month: number;
  max_seats: number;
  features: unknown;
};

function PlansPage() {
  const { data: ctx } = useWorkspace();
  const { t } = useI18n();
  const qc = useQueryClient();
  const fetchPlans = useServerFn(listPlans);
  const switchPlan = useServerFn(changePlan);

  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: () => fetchPlans({}) as Promise<PlanRow[]>,
    staleTime: 5 * 60_000,
  });

  const canManage = ctx ? ["owner", "admin"].includes(ctx.workspace.role) : false;

  async function pick(planId: string) {
    if (!ctx) return;
    try {
      await switchPlan({ data: { workspaceId: ctx.workspace.id, planId } });
      await qc.invalidateQueries({ queryKey: ["workspace-context"] });
      toast.success(t("plans.updated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.planFailed"));
    }
  }

  const usage = ctx
    ? [
        {
          label: t("plans.docs"),
          used: ctx.usage.documents,
          limit: ctx.plan.max_documents,
          text: `${ctx.usage.documents} / ${ctx.plan.max_documents}`,
        },
        {
          label: t("plans.questions"),
          used: ctx.usage.questionsThisMonth,
          limit: ctx.plan.max_questions_month,
          text: `${ctx.usage.questionsThisMonth} / ${ctx.plan.max_questions_month}`,
        },
        {
          label: t("plans.storage"),
          used: ctx.usage.storageBytes,
          limit: ctx.plan.max_storage_bytes,
          text: `${formatBytes(ctx.usage.storageBytes)} / ${formatBytes(ctx.plan.max_storage_bytes)}`,
        },
        {
          label: t("plans.seats"),
          used: ctx.usage.seats,
          limit: ctx.plan.max_seats,
          text: `${ctx.usage.seats} / ${ctx.plan.max_seats}`,
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">{t("plans.title")}</h1>
        <p className="mt-1 text-muted-foreground">
          {t("plans.subtitle", { plan: ctx?.plan.name ?? "…" })}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("plans.thisMonth")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          {usage.map((u) => (
            <div key={u.label}>
              <div className="flex justify-between text-sm">
                <span>{u.label}</span>
                <span className="text-muted-foreground">{u.text}</span>
              </div>
              <Progress
                value={u.limit ? Math.min(100, (u.used / u.limit) * 100) : 0}
                className="mt-2"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {(plans ?? []).map((p) => {
          const current = ctx?.plan.id === p.id;
          const features = Array.isArray(p.features) ? (p.features as string[]) : [];
          return (
            <Card key={p.id} className={current ? "border-primary" : undefined}>
              <CardHeader>
                <CardTitle className="flex items-baseline justify-between">
                  <span>{p.name}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {p.price_cents
                      ? t("plans.perMonth", { price: (p.price_cents / 100).toFixed(0) })
                      : t("plans.free")}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1.5 text-sm">
                  <li>{t("plans.documentsCount", { count: p.max_documents })}</li>
                  <li>{t("plans.questionsCount", { count: p.max_questions_month })}</li>
                  <li>
                    {t("plans.storageCount", { size: formatBytes(Number(p.max_storage_bytes)) })}
                  </li>
                  <li>{t("plans.seatsCount", { count: p.max_seats })}</li>
                  {features.map((f) => (
                    <li key={f} className="flex gap-2 text-muted-foreground">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={current ? "outline" : "default"}
                  disabled={current || !canManage}
                  onClick={() => pick(p.id)}
                >
                  {current ? t("plans.current") : t("plans.choose")}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
