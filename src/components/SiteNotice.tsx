"use client";

import { useLocale } from "next-intl";
import { AlertTriangle, Info } from "lucide-react";
import { useSiteSettings } from "@/lib/use-site-settings";

export function SiteNotice() {
  const locale = useLocale();
  const { settings } = useSiteSettings();
  const enabled = settings.featureFlags.siteNotice;
  const text = settings.announcement[locale as keyof typeof settings.announcement] || settings.announcement.en;

  if (!enabled || !text) return null;

  const isWarning = settings.announcement.tone === "warning";
  const Icon = isWarning ? AlertTriangle : Info;

  return (
    <div className={isWarning ? "bg-gold/15 border-b border-gold/30" : "bg-navy text-cream border-b border-gold/20"}>
      <div
        className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2 text-center text-sm"
        dir={locale === "he" ? "rtl" : "ltr"}
      >
        <Icon className="h-4 w-4 shrink-0 text-gold" />
        <span>{text}</span>
      </div>
    </div>
  );
}
