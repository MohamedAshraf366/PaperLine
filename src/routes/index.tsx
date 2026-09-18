import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { FileText, MessagesSquare, Search, Users, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppControls } from "@/components/AppControls";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Paperline — Read, question and compare documents with AI" },
      {
        name: "description",
        content:
          "Paperline turns your team's PDFs, Word and Excel files into answers: summaries, cited Q&A, comparison and meaning-based search.",
      },
      { property: "og:title", content: "Paperline — Read, question and compare documents with AI" },
      {
        property: "og:description",
        content: "Summaries, cited answers, comparison and semantic search across your documents.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: FileText, title: "summariesTitle", body: "summariesBody" },
  { icon: MessagesSquare, title: "askTitle", body: "askBody" },
  { icon: Search, title: "searchTitle", body: "searchBody" },
  { icon: Users, title: "teamsTitle", body: "teamsBody" },
  { icon: BarChart3, title: "usageTitle", body: "usageBody" },
] as const;

function Landing() {
  const { t } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-xl font-semibold">{t("common.appName")}</span>
        <nav className="flex items-center gap-2">
          <AppControls />
          <Button asChild variant="ghost">
            <Link to="/auth" search={{ mode: "login" }}>
              {t("landing.login")}
            </Link>
          </Button>
          <Button asChild>
            <Link to="/auth" search={{ mode: "signup" }}>
              {t("landing.getStarted")}
            </Link>
          </Button>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-3xl px-6 pt-16 pb-20 text-center">
          <p className="text-sm font-medium tracking-wide text-primary uppercase">
            {t("landing.eyebrow")}
          </p>
          <h1 className="mt-4 text-5xl leading-tight font-semibold text-balance sm:text-6xl">
            {t("landing.hero")}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            {t("landing.heroBody")}
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth" search={{ mode: "signup" }}>
                {t("landing.createWorkspace")}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth" search={{ mode: "login" }}>
                {t("landing.haveAccount")}
              </Link>
            </Button>
          </div>
        </section>

        <section className="border-y border-border bg-card/60">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title}>
                <f.icon className="h-6 w-6 text-primary" aria-hidden />
                <h2 className="mt-3 text-lg font-semibold">{t(`landing.features.${f.title}`)}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(`landing.features.${f.body}`)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="text-3xl font-semibold">{t("landing.pricingTitle")}</h2>
          <p className="mt-3 text-muted-foreground">{t("landing.pricingBody")}</p>
          <Button asChild size="lg" className="mt-8">
            <Link to="/auth" search={{ mode: "signup" }}>
              {t("landing.getStartedFree")}
            </Link>
          </Button>
        </section>
      </main>

      <Footer />
    </div>
  );
}
