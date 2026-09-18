import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { acceptInvite } from "@/lib/team.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/invite/$token")({
  head: () => ({
    meta: [
      { title: "Join a workspace — Paperline" },
      { name: "description", content: "Accept your invite and join the shared document library." },
      { property: "og:title", content: "Join a workspace — Paperline" },
      {
        property: "og:description",
        content: "Accept your invite and join the shared document library.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useI18n();
  const accept = useServerFn(acceptInvite);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      await accept({ data: { token } });
      await qc.invalidateQueries({ queryKey: ["workspace-context"] });
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.inviteAccept"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>{t("invite.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("invite.body")}</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={join} disabled={busy} className="w-full">
            {busy ? t("invite.joining") : t("invite.accept")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
