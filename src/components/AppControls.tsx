import { Languages, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";
import { useI18n } from "@/i18n";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, setTheme } = useTheme();
  const { t } = useI18n();
  const next = resolved === "dark" ? "light" : "dark";
  const Icon = resolved === "dark" ? Moon : Sun;

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => setTheme(next)}
      aria-label={t("theme.toggle")}
      title={t(`theme.${next}`)}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </Button>
  );
}

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  const next = locale === "ar" ? "en" : "ar";

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => setLocale(next)}
      aria-label={t("language.label")}
      title={t(`language.${next}`)}
    >
      <Languages className="h-4 w-4" aria-hidden />
    </Button>
  );
}

export function AppControls({ className }: { className?: string }) {
  return (
    <div className={className}>
      <ThemeToggle />
      <LanguageSwitcher />
    </div>
  );
}
