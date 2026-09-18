import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppControls } from "@/components/AppControls";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: search["mode"] === "signup" ? ("signup" as const) : ("login" as const),
  }),
  head: () => ({
    meta: [
      { title: "Log in or sign up — Paperline" },
      { name: "description", content: "Access your Paperline document workspace." },
      { property: "og:title", content: "Log in or sign up — Paperline" },
      { property: "og:description", content: "Access your Paperline document workspace." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [isSignup, setIsSignup] = useState(mode === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) {
          toast.success(t("auth.createdCheckEmail"));
          setIsSignup(false);
          return;
        }
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-2 flex justify-end">
          <AppControls />
        </div>
        <Link to="/" className="mb-6 block text-center font-display text-xl font-semibold">
          {t("common.appName")}
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">
              {isSignup ? t("auth.signupTitle") : t("auth.loginTitle")}
            </CardTitle>
            <CardDescription>
              {isSignup ? t("auth.signupBody") : t("auth.loginBody")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              {isSignup && (
                <div className="space-y-2">
                  <Label htmlFor="name">{t("auth.yourName")}</Label>
                  <Input
                    id="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t("auth.namePlaceholder")}
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? t("auth.pleaseWait") : isSignup ? t("auth.createAccount") : t("auth.login")}
              </Button>
            </form>
            <button
              type="button"
              onClick={() => setIsSignup((v) => !v)}
              className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground"
            >
              {isSignup ? t("auth.haveAccount") : t("auth.newHere")}
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
