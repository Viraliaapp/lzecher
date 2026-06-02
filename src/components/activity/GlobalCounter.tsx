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

export function GlobalCounter() {
  const t = useTranslations("globalCounter");
  const locale = useLocale();
  const { settings, loaded } = useSiteSettings();
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

  // Nothing tracked yet, or not loaded — render nothing rather than zeros.
  if (!loaded || !settings.featureFlags.globalCounter || !stats) return null;

  const learningCommitments = stats.mishnayos + stats.tehillim + stats.kabalos + stats.shnayim_mikra;
  if (stats.siteViews + learningCommitments === 0) return null;

  return (
    <section className="relative z-10 border-y border-gold/25 bg-white shadow-[0_12px_28px_rgba(7,22,42,0.07)]">
      <div
        className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-2 px-4 py-4 text-center sm:flex-row sm:gap-5 sm:px-6 sm:py-5"
        dir={locale === "he" ? "rtl" : "ltr"}
      >
        <span className="font-heading text-sm font-bold text-navy sm:text-base">
          {t("heading")}
        </span>
        <span className="hidden h-7 w-px bg-navy/10 sm:block" aria-hidden="true" />
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-4xl font-black leading-none text-gold sm:text-5xl">
            {fmtNum(stats.siteViews, locale)}
          </span>
          <span className="text-sm font-medium text-muted sm:text-base">
            {t("siteViews")}
          </span>
        </div>
        {learningCommitments > 0 && (
          <>
            <span className="hidden h-7 w-px bg-navy/10 sm:block" aria-hidden="true" />
            <span className="text-xs font-medium text-muted sm:text-sm">
              {fmtNum(learningCommitments, locale)} {t("learningCommitments")}
            </span>
          </>
        )}
      </div>
    </section>
  );
}
