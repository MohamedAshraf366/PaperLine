import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Globe, ExternalLink } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { searchDocuments, searchWeb } from "@/lib/documents.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({
    meta: [
      { title: "Search — Paperline" },
      { name: "description", content: "Search your document library by meaning, not keywords." },
      { property: "og:title", content: "Search — Paperline" },
      {
        property: "og:description",
        content: "Search your document library by meaning, not keywords.",
      },
    ],
  }),
  component: SearchPage,
});

type Hit = { documentId: string; documentName: string; snippet: string };
type WebSource = { title: string; url: string };

function SearchPage() {
  const { data: ctx } = useWorkspace();
  const { t } = useI18n();
  const search = useServerFn(searchDocuments);
  const searchOnline = useServerFn(searchWeb);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [webBusy, setWebBusy] = useState(false);
  const [web, setWeb] = useState<{ text: string; sources: WebSource[] } | null>(null);

  function resetResults() {
    setHits(null);
    setWeb(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ctx || !query.trim()) return;
    setBusy(true);
    resetResults();
    try {
      setHits(await search({ data: { workspaceId: ctx.workspace.id, query } }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.searchFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function runWebSearch() {
    if (!ctx || !query.trim()) return;
    setWebBusy(true);
    try {
      setWeb(await searchOnline({ data: { workspaceId: ctx.workspace.id, query } }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.webSearchFailed"));
    } finally {
      setWebBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{t("search.title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("search.subtitle")}</p>
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search.placeholder")}
        />
        <Button type="submit" disabled={busy}>
          {busy ? t("search.searching") : t("search.button")}
        </Button>
      </form>

      <div className="space-y-3">
        {(hits ?? []).map((hit, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            <Link
              to="/documents/$documentId"
              params={{ documentId: hit.documentId }}
              className="font-medium hover:underline"
            >
              {hit.documentName}
            </Link>
            <p className="mt-2 text-sm text-muted-foreground">{hit.snippet}…</p>
          </div>
        ))}
      </div>

      {hits?.length === 0 && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <p className="text-sm text-muted-foreground">{t("search.webHint")}</p>
            <Button onClick={runWebSearch} disabled={webBusy}>
              <Globe className="me-2 h-4 w-4" aria-hidden />
              {webBusy ? t("search.searchingWeb") : t("search.searchWeb")}
            </Button>
          </CardContent>
        </Card>
      )}

      {web && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4 text-primary" aria-hidden />
              {t("search.webAnswer")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm whitespace-pre-wrap">{web.text}</p>
            {web.sources.length > 0 && (
              <div className="border-t border-border pt-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  {t("search.webSources")}
                </p>
                <ul className="mt-2 space-y-1">
                  {web.sources.map((source) => (
                    <li key={source.url}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {source.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
