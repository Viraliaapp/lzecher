"use client";

/**
 * "Yasher Koach" — a small recognition popover for top takers in THIS project.
 * Seeded from SSR (project.topMatmidim) and refreshed by polling every ~20s. Warm,
 * compact, and collapsible so it does not dominate the memorial page.
 */
import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Award, ChevronDown, X } from "lucide-react";
import { fmtNum } from "@/lib/activity-format";
import { cn } from "@/lib/utils";

interface Matmid {
  name: string;
  count: number;
}

const POLL_MS = 20000;
const MAX_VISIBLE_MATMIDIM = 5;

export function Leaderboard({ projectId, initial }: { projectId: string; initial?: Matmid[] }) {
  const t = useTranslations("leaderboard");
  const locale = useLocale();
  const [matmidim, setMatmidim] = useState<Matmid[]>(initial || []);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await fetch(`/api/projects/${projectId}/leaderboard`, { cache: "no-store" });
        if (!res.ok) return;
        const d = await res.json();
        if (alive && Array.isArray(d.matmidim)) setMatmidim(d.matmidim);
      } catch { /* ignore */ }
    }
    poll();
    const iv = setInterval(poll, POLL_MS);
    return () => { alive = false; clearInterval(iv); };
  }, [projectId]);

  const visibleMatmidim = (matmidim || []).slice(0, MAX_VISIBLE_MATMIDIM);

  if (visibleMatmidim.length === 0) return null;

  const isRtl = locale === "he";
  const panelId = `yasher-koach-${projectId}`;

  return (
    <div
      className={cn(
        "relative z-30 w-full max-w-[320px] px-4 pt-4 transition-[padding] sm:px-0",
        isOpen ? "pb-56 sm:pb-56" : "pb-4"
      )}
      dir="ltr"
    >
      <div className={cn("relative flex", isRtl ? "justify-start" : "justify-end")}>
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          aria-label={t("title")}
          onClick={() => setIsOpen((open) => !open)}
          className={cn(
            "group relative flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-full border bg-cream-glow text-navy shadow-[0_14px_32px_rgba(15,27,45,0.12)] transition",
            "border-gold/35 hover:-translate-y-0.5 hover:border-gold/55 hover:shadow-[0_18px_38px_rgba(15,27,45,0.16)] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60",
            "sm:h-20 sm:w-20"
          )}
        >
          <Award className="h-4 w-4 text-gold sm:h-5 sm:w-5" aria-hidden="true" />
          <span
            className="px-1 text-center font-heading text-[11px] font-bold leading-tight tracking-normal sm:text-sm"
            dir={isRtl ? "rtl" : "ltr"}
          >
            {t("title")}
          </span>
          <span
            className={cn(
              "absolute -bottom-1 grid h-6 w-6 place-items-center rounded-full border border-gold/25 bg-[#F0E3C4] text-gold transition",
              isOpen && "rotate-180"
            )}
            aria-hidden="true"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </span>
        </button>

        {isOpen && (
          <div
            id={panelId}
            className={cn(
              "absolute top-0 w-[calc(100vw-7rem)] max-w-[280px] rounded-2xl border border-gold/25 bg-[#FFFDF8]/95 p-3 shadow-[0_18px_44px_rgba(15,27,45,0.16)] backdrop-blur",
              isRtl ? "left-[4.75rem] text-right sm:left-[5.75rem]" : "right-[4.75rem] text-left sm:right-[5.75rem]"
            )}
            dir={isRtl ? "rtl" : "ltr"}
          >
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-gold/15 pb-2">
              <h3 className="font-heading text-base font-bold text-navy">{t("title")}</h3>
              <button
                type="button"
                aria-label={isRtl ? "סגור" : "Close"}
                onClick={() => setIsOpen(false)}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold/10 text-gold transition hover:bg-gold/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <ol className="space-y-1.5">
              {visibleMatmidim.map((m, i) => (
                <li
                  key={`${m.name}-${i}`}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm"
                  style={{ background: i % 2 === 0 ? "rgba(201,162,75,0.07)" : "transparent" }}
                >
                  <span
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold"
                    style={{ background: "rgba(201,162,75,0.18)", color: "#8B6F2E" }}
                  >
                    {fmtNum(i + 1, locale)}
                  </span>
                  <span className="truncate font-serif text-navy" style={{ fontFamily: "'Frank Ruhl Libre', Georgia, serif" }}>
                    {m.name}
                  </span>
                  <span className="shrink-0 text-sm font-bold" style={{ color: "#C9A961" }}>
                    {fmtNum(m.count, locale)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
