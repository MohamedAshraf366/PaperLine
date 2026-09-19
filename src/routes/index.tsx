import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { FileText, MessagesSquare, Search, Users, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppControls } from "@/components/AppControls";
import { Footer } from "@/components/Footer";
import { BellFieldBackground } from "@/components/BellFieldBackground";
import { EnergyOrb } from "@/components/EnergyOrb";
import { EmeraldHorizon } from "@/components/EmeraldHorizon";
import { DotMatrix } from "@/components/DotMatrix";
import { AmberMesh } from "@/components/AmberMesh";
import { GlassShimmer } from "@/components/GlassShimmer";
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
        {/* HERO — multi-layer: BellField base, EnergyOrb glow, AmberMesh warm wash, GlassShimmer sparkle */}
        <section className="relative overflow-hidden bg-background">
          <BellFieldBackground className="absolute inset-0" speed={0.6} opacity={0.5} />
          <EnergyOrb
            className="absolute inset-0 -right-1/4 w-[150%] max-w-full -translate-x-1/3"
            speed={0.7}
            hue={-20}
            saturation={1.1}
            glow={1.3}
            opacity={0.85}
          />
          <AmberMesh
            className="absolute inset-0"
            speed={0.6}
            opacity={0.3}
          />
          <GlassShimmer
            className="absolute inset-0"
            speed={1.2}
            opacity={0.25}
          />
          <div className="relative mx-auto max-w-3xl px-6 pt-16 pb-20 text-center">
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
          </div>
        </section>

        {/* FEATURES — EmeraldHorizon divider + AmberMesh warm glow + DotMatrix card accents + GlassShimmer */}
        <section className="border-y border-border bg-card/60">
          <div className="relative mx-auto max-w-6xl px-6 py-16">
            <EmeraldHorizon
              className="absolute inset-0 -top-16 -bottom-16 w-[400%] max-w-full"
              speed={0.8}
              waveScale={1.2}
              glow={1.5}
              opacity={0.7}
            />
            <AmberMesh
              className="absolute inset-0 -top-16 -bottom-16 w-[300%] max-w-full -translate-x-1/4"
              speed={0.5}
              opacity={0.2}
            />
            <div className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="relative overflow-hidden rounded-xl border border-border bg-card/80 p-6"
                >
                  <DotMatrix
                    className="absolute inset-0 -z-10"
                    speed={0.5}
                    gridScale={80}
                    opacity={0.25}
                    hue={180}
                  />
                  <GlassShimmer
                    className="absolute inset-0 -z-10"
                    speed={0.8}
                    opacity={0.1}
                  />
                  <f.icon className="h-6 w-6 text-primary" aria-hidden />
                  <h2 className="mt-3 text-lg font-semibold">
                    {t(`landing.features.${f.title}`)}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(`landing.features.${f.body}`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING — AmberMesh warm glow + DotMatrix + GlassShimmer */}
        <section className="relative mx-auto max-w-3xl px-6 py-20 text-center">
          <AmberMesh
            className="absolute inset-0"
            speed={0.5}
            opacity={0.25}
          />
          <DotMatrix
            className="absolute inset-0 -z-10"
            speed={0.4}
            gridScale={120}
            opacity={0.2}
            hue={220}
            mouseAmount={0.02}
          />
          <GlassShimmer
            className="absolute inset-0 -z-10"
            speed={0.6}
            opacity={0.1}
          />
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
