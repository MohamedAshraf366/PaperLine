import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  FileText,
  LayoutDashboard,
  Search,
  LogOut,
  MessagesSquare,
  Users,
  CreditCard,
  Shield,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/useWorkspace";
import { LanguageSwitcher, ThemeToggle } from "@/components/AppControls";
import { Footer } from "@/components/Footer";
import { useI18n } from "@/i18n";

const nav = [
  { to: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { to: "/documents", key: "nav.documents", icon: FileText },
  { to: "/chat", key: "nav.chat", icon: MessagesSquare },
  { to: "/search", key: "nav.search", icon: Search },
  { to: "/team", key: "nav.team", icon: Users },
  { to: "/plans", key: "nav.plans", icon: CreditCard },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { data } = useWorkspace();
  const { t } = useI18n();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "login" } });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-e border-sidebar-border bg-sidebar px-4 py-6 md:flex">
        <Link to="/dashboard" className="font-display text-lg font-semibold">
          {t("common.appName")}
        </Link>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {data?.workspace.name ?? t("workspace.loading")}
        </p>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
            >
              <item.icon className="h-4 w-4" aria-hidden />
              {t(item.key)}
            </Link>
          ))}
          {data?.isPlatformAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
            >
              <Shield className="h-4 w-4" aria-hidden />
              {t("nav.admin")}
            </Link>
          )}
        </nav>
        <div className="mt-4 flex items-center gap-1 border-t border-sidebar-border pt-3">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
        <Button variant="ghost" size="sm" className="mt-2 justify-start" onClick={signOut}>
          <LogOut className="me-2 h-4 w-4" aria-hidden />
          {t("nav.signOut")}
        </Button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3 md:hidden">
          <Link to="/dashboard" className="font-display font-semibold">
            {t("common.appName")}
          </Link>
          <div className="ms-auto flex items-center gap-1">
            <ThemeToggle />
            <LanguageSwitcher />
            <nav className="flex gap-1">
              {nav.map((item) => (
                <Link key={item.to} to={item.to} className="rounded-md p-2 hover:bg-accent">
                  <item.icon className="h-4 w-4" aria-hidden />
                  <span className="sr-only">{t(item.key)}</span>
                </Link>
              ))}
              <button onClick={signOut} className="rounded-md p-2 hover:bg-accent">
                <LogOut className="h-4 w-4" aria-hidden />
                <span className="sr-only">{t("nav.signOut")}</span>
              </button>
            </nav>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-8 md:px-10">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
