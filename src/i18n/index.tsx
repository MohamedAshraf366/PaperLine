import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { dictionaries, type Locale } from "./translations";

export type { Locale } from "./translations";

const LOCALE_KEY = "paperline.locale";

type Vars = Record<string, string | number>;

function lookup(dict: unknown, key: string): string | undefined {
  let current: unknown = dict;
  for (const part of key.split(".")) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
    name in vars ? String(vars[name]) : `{{${name}}}`,
  );
}

export function translate(locale: Locale, key: string, vars?: Vars): string {
  const value = lookup(dictionaries[locale], key) ?? lookup(dictionaries.en, key);
  return value ? interpolate(value, vars) : key;
}

export function dirFor(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

type I18nValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Vars) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    return window.localStorage.getItem(LOCALE_KEY) === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = dirFor(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_KEY, next);
    } catch {
      // ignore storage failures
    }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      dir: dirFor(locale),
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within an I18nProvider");
  return ctx;
}

export function useT() {
  return useI18n().t;
}
