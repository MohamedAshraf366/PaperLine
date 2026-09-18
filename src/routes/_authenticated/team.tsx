import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  inviteMember,
  listTeam,
  removeMember,
  revokeInvite,
  setMemberRole,
} from "@/lib/team.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team — Paperline" },
      { name: "description", content: "Invite teammates and manage who can see your documents." },
      { property: "og:title", content: "Team — Paperline" },
      {
        property: "og:description",
        content: "Invite teammates and manage who can see your documents.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { data: ctx } = useWorkspace();
  const { t } = useI18n();
  const qc = useQueryClient();
  const fetchTeam = useServerFn(listTeam);
  const invite = useServerFn(inviteMember);
  const revoke = useServerFn(revokeInvite);
  const changeRole = useServerFn(setMemberRole);
  const kick = useServerFn(removeMember);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [busy, setBusy] = useState(false);

  const workspaceId = ctx?.workspace.id;
  const canManage = ctx ? ["owner", "admin"].includes(ctx.workspace.role) : false;

  const { data } = useQuery({
    queryKey: ["team", workspaceId],
    queryFn: () => fetchTeam({ data: { workspaceId: workspaceId! } }),
    enabled: !!workspaceId,
  });

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["team", workspaceId] });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId || !email.trim()) return;
    setBusy(true);
    try {
      const { token } = await invite({ data: { workspaceId, email, role } });
      const link = `${window.location.origin}/invite/${token}`;
      await navigator.clipboard.writeText(link).catch(() => undefined);
      toast.success(t("team.inviteCreated"));
      setEmail("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.inviteFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{t("team.title")}</h1>
        <p className="mt-1 text-muted-foreground">
          {ctx
            ? t("team.seats", { used: ctx.usage.seats, total: ctx.plan.max_seats })
            : t("common.loading")}
        </p>
      </div>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>{t("team.inviteTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("team.emailPlaceholder")}
                required
              />
              <Select value={role} onValueChange={(v) => setRole(v as "admin" | "member")}>
                <SelectTrigger className="sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">{t("role.member")}</SelectItem>
                  <SelectItem value="admin">{t("role.admin")}</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={busy}>
                {busy ? t("team.creating") : t("team.invite")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("team.members")}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {(data?.members ?? []).map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {m.fullName ?? m.email ?? t("role.member")}
                </p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
              {m.role === "owner" || !canManage ? (
                <Badge variant="outline">{t(`role.${m.role}`)}</Badge>
              ) : (
                <>
                  <Select
                    value={m.role}
                    onValueChange={async (v) => {
                      await changeRole({
                        data: {
                          workspaceId: workspaceId!,
                          memberId: m.id,
                          role: v as "admin" | "member",
                        },
                      });
                      await refresh();
                    }}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">{t("role.member")}</SelectItem>
                      <SelectItem value="admin">{t("role.admin")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await kick({ data: { workspaceId: workspaceId!, memberId: m.id } });
                      await refresh();
                    }}
                  >
                    {t("team.remove")}
                  </Button>
                </>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {(data?.invites ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("team.invites")}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {(data?.invites ?? []).map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(`role.${i.role}`)} · {t(`status.${i.status}`)}
                  </p>
                </div>
                {i.status === "pending" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await navigator.clipboard.writeText(
                          `${window.location.origin}/invite/${i.token}`,
                        );
                        toast.success(t("team.copied"));
                      }}
                    >
                      {t("team.copyLink")}
                    </Button>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await revoke({ data: { workspaceId: workspaceId!, inviteId: i.id } });
                          await refresh();
                        }}
                      >
                        {t("team.revoke")}
                      </Button>
                    )}
                  </>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
