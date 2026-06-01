"use client";

/**
 * Global live counter — a warm "כלל ישראל לומד יחד" band showing platform-wide totals.
 * Polls the single pre-aggregated doc via /api/activity/global every ~20s.
 */
import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { fmtNum } from "@/lib/activity-format";
import { useSiteSettings } from "@/lib/use-site-settings";

interface GlobalStats {
  mishnayos: number;
  tehillim: number;
  kabalos: number;
  participants: number;
}

const POLL_MS = 20000;

export function GlobalCounter() {
  const t = useTranslations("globalCounter");
  const locale = useLocale();
  const { settings, loaded } = useSiteSettings();
  const [stats, setStats] = useState<GlobalStats | null>(null);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await fetch("/api/activity/global", { cache: "no-store" });
        if (!res.ok) return;
        const d = await res.json();
        if (alive) setStats({ mishnayos: d.mishnayos || 0, tehillim: d.tehillim || 0, kabalos: d.kabalos || 0, participants: d.participants || 0 });
      } catch { /* ignore */ }
    }
    poll();
    const iv = setInterval(poll, POLL_MS);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  // Nothing learned yet, or not loaded — render nothing rather than zeros.
  if (!loaded || !settings.featureFlags.globalCounter || !stats || (stats.mishnayos + stats.tehillim + stats.kabalos === 0)) return null;

  const items = [
    { n: stats.mishnayos, label: t("mishnayos") },
    { n: stats.tehillim, label: t("tehillim") },
    { n: stats.kabalos, label: t("kabalos") },
  ].filter((i) => i.n > 0);

  return (
    <section className="bg-navy border-y border-gold/15">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 text-center" dir={locale === "he" ? "rtl" : "ltr"}>
        <p className="font-serif italic text-gold/80 text-sm mb-3">{t("heading")}</p>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {items.map((i, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <span className="font-heading font-black text-2xl sm:text-3xl" style={{ color: "#C9A961" }}>
                {fmtNum(i.n, locale)}
              </span>
              <span className="text-cream/60 text-xs mt-0.5">{i.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
