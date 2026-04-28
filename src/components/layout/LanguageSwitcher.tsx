"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const LOCALE_SHORT: Record<string, string> = {
  en: "EN",
  he: "עב",
  es: "ES",
  fr: "FR",
};

const LOCALE_FULL: Record<string, string> = {
  en: "English",
  he: "עברית",
  es: "Español",
  fr: "Français",
};

export function LanguageSwitcher({ isLanding = false }: { isLanding?: boolean }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function switchLocale(newLocale: Locale) {
    router.replace(pathname, { locale: newLocale });
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      {/* Pill trigger */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-colors",
          isLanding
            ? "bg-white/10 text-cream/90 hover:bg-white/15"
            : "bg-navy/5 text-navy hover:bg-navy/10"
        )}
        aria-label="Change language"
      >
        <span>{LOCALE_SHORT[locale]}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            "absolute top-full mt-1 right-0 rtl:right-auto rtl:left-0 z-50 min-w-[140px] rounded-xl border shadow-lg overflow-hidden",
            "bg-white border-navy/10"
          )}
        >
          {routing.locales.map((loc) => (
            <button
              key={loc}
              onClick={() => switchLocale(loc)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors",
                locale === loc
                  ? "bg-gold/10 text-gold-deep font-medium"
                  : "text-navy hover:bg-cream"
              )}
            >
              <span>{LOCALE_FULL[loc]}</span>
              <span className="text-xs text-muted">{LOCALE_SHORT[loc]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
