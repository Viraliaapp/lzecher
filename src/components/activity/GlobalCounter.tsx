"use client";

/**
 * Global community counter — a warm "כלל ישראל בלזכר" strip showing safe
 * aggregate platform totals. It only reads Lzecher-scoped public counters.
 */
import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { fmtNum } from "@/lib/activity-format";
import { useSiteSettings } from "@/lib/use-site-settings";

interface GlobalStats {
  mishnayos: number;
  tehillim: number;
  kabalos: number;
  shnayim_mikra: number;
  participants: number;
  projects: number;
  siteViews: number;
}

const POLL_MS = 60000;

function useGlobalStats() {
  const [stats, setStats] = useState<GlobalStats | null>(null);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await fetch("/api/activity/global");
        if (!res.ok) return;
        const d = await res.json();
        if (alive) {
          setStats({
            mishnayos: d.mishnayos || 0,
            tehillim: d.tehillim || 0,
            kabalos: d.kabalos || 0,
            shnayim_mikra: d.shnayim_mikra || 0,
            participants: d.participants || 0,
            projects: d.projects || 0,
            siteViews: d.siteViews || 0,
          });
        }
      } catch { /* ignore */ }
    }
    poll();
    const iv = setInterval(poll, POLL_MS);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  return stats;
}

export function GlobalCounter() {
  const t = useTranslations("globalCounter");
  const locale = useLocale();
  const { settings, loaded } = useSiteSettings();
  const stats = useGlobalStats();

  // Nothing tracked yet, or not loaded — render nothing rather than zeros.
  if (!loaded || !settings.featureFlags.globalCounter || !stats) return null;

  const learningItems = [
    { key: "mishnayos", n: stats.mishnayos, label: t("mishnayos") },
    { key: "tehillim", n: stats.tehillim, label: t("tehillim") },
    { key: "kabalos", n: stats.kabalos, label: t("kabalos") },
    { key: "shnayim_mikra", n: stats.shnayim_mikra, label: locale === "he" ? "שניים מקרא" : "Shnayim Mikra" },
  ].filter((item) => item.n > 0);
  if (learningItems.reduce((sum, item) => sum + item.n, 0) === 0) return null;
  const mobileColumns = learningItems.length === 4 ? 2 : Math.min(learningItems.length, 3);

  return (
    <section className="relative z-10 border-y border-gold/25 bg-white shadow-[0_12px_28px_rgba(7,22,42,0.07)]">
      <div
        className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-3 px-4 py-4 text-center sm:flex-row sm:gap-5 sm:px-6 sm:py-5"
        dir={locale === "he" ? "rtl" : "ltr"}
      >
        <span className="font-heading text-sm font-bold text-navy sm:text-base">
          {t("heading")}
        </span>
        <span className="hidden h-7 w-px bg-navy/10 sm:block" aria-hidden="true" />
        {learningItems.length > 0 && (
          <div
            className="grid w-full max-w-md gap-2 sm:w-auto sm:max-w-none sm:flex sm:items-baseline sm:gap-4"
            style={{ gridTemplateColumns: `repeat(${mobileColumns}, minmax(0, 1fr))` }}
          >
            {learningItems.map((item) => (
              <div key={item.key} className="min-w-0 rounded-lg bg-cream/45 px-2 py-1.5 sm:bg-transparent sm:px-0 sm:py-0">
                <span className="block font-heading text-lg font-black leading-none text-gold-deep sm:inline sm:text-xl">
                  {fmtNum(item.n, locale)}
                </span>
                <span className="mt-0.5 block truncate text-[11px] font-medium text-muted sm:ms-1 sm:mt-0 sm:inline sm:text-xs">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function SiteViewsCounter() {
  const t = useTranslations("globalCounter");
  const locale = useLocale();
  const { settings, loaded } = useSiteSettings();
  const stats = useGlobalStats();

  if (!loaded || !settings.featureFlags.globalCounter || !stats?.siteViews) return null;

  return (
    <section className="bg-cream px-4 pb-7 pt-1 text-center" dir={locale === "he" ? "rtl" : "ltr"}>
      <div className="mx-auto inline-flex items-baseline gap-2 rounded-full border border-gold/20 bg-white/75 px-4 py-2 text-xs text-muted shadow-sm">
        <span className="font-heading text-base font-black leading-none text-gold-deep">
          {fmtNum(stats.siteViews, locale)}
        </span>
        <span>{t("siteViews")}</span>
      </div>
    </section>
  );
}
