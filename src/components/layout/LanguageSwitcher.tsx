"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { Globe } from "lucide-react";

const LOCALE_LABELS: Record<string, string> = {
  en: "EN",
  he: "עב",
  es: "ES",
  fr: "FR",
};

export function LanguageSwitcher({ isLanding = false }: { isLanding?: boolean }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(newLocale: Locale) {
    router.replace(pathname, { locale: newLocale });
  }

  return (
    <div className="flex items-center gap-1">
      <Globe
        className={cn(
          "h-4 w-4 mr-1",
          isLanding ? "text-cream/60" : "text-muted"
        )}
      />
      {routing.locales.map((loc) => (
        <button
          key={loc}
          onClick={() => switchLocale(loc)}
          className={cn(
            "px-2 py-1 text-xs font-medium rounded-md transition-colors",
            locale === loc
              ? "bg-gold/20 text-gold"
              : isLanding
              ? "text-cream/60 hover:text-cream hover:bg-white/10"
              : "text-muted hover:text-navy hover:bg-navy/5"
          )}
        >
          {LOCALE_LABELS[loc]}
        </button>
      ))}
    </div>
  );
}
