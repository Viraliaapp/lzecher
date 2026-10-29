"use client";

/**
 * "Yasher Koach" — a small recognition popover for top takers in THIS project.
 * Seeded from SSR (project.topMatmidim) and refreshed by polling every ~20s. Warm,
 * compact, and collapsible so it does not dominate the memorial page.
 */
import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ArrowRight, Award, ChevronDown, Loader2 } from "lucide-react";
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
  const [showAll, setShowAll] = useState(false);
  const [hasMoreMatmidim, setHasMoreMatmidim] = useState((initial || []).length >= MAX_VISIBLE_MATMIDIM);
  const [fullListHasMore, setFullListHasMore] = useState<boolean | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(initial === undefined ? "loading" : "ready");

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await fetch(`/api/projects/${projectId}/leaderboard${showAll ? "?all=1" : ""}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Leaderboard unavailable");
        const d = await res.json();
        if (!Array.isArray(d.matmidim)) throw new Error("Invalid leaderboard response");
        if (alive && Array.isArray(d.matmidim)) {
          setMatmidim(d.matmidim);
          setLoadState("ready");
          setHasMoreMatmidim(showAll
            ? d.matmidim.length > MAX_VISIBLE_MATMIDIM
            : fullListHasMore ?? (Boolean(d.hasMore) || d.matmidim.length >= MAX_VISIBLE_MATMIDIM));
        }
      } catch {
        // Keep the last successful rankings while a refresh is unavailable.
        if (alive) setLoadState("error");
      }
    }
    poll();
    const iv = setInterval(poll, POLL_MS);
    return () => { alive = false; clearInterval(iv); };
  }, [projectId, showAll, fullListHasMore]);

  async function loadAllMatmidim() {
    setLoadingAll(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/leaderboard?all=1`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.matmidim)) {
        const nextHasMore = data.matmidim.length > MAX_VISIBLE_MATMIDIM;
        setMatmidim(data.matmidim);
        setFullListHasMore(nextHasMore);
        setHasMoreMatmidim(nextHasMore);
        setShowAll(nextHasMore);
      }
    } catch {
      // Ignore leaderboard expansion failures; the top 5 remains available.
    } finally {
      setLoadingAll(false);
    }
  }

  function togglePanel() {
    setIsOpen((open) => {
      if (open) setShowAll(false);
      return !open;
    });
  }

  const visibleMatmidim = (matmidim || []).slice(0, showAll ? matmidim.length : MAX_VISIBLE_MATMIDIM);
  const canToggleAll = showAll || hasMoreMatmidim || (!showAll && fullListHasMore === null && matmidim.length >= MAX_VISIBLE_MATMIDIM);

  const isRtl = locale === "he";
  const panelId = `yasher-koach-${projectId}`;

  return (
    <div
      className="relative w-[220px] max-w-full py-4"
      dir={isRtl ? "rtl" : "ltr"}
      data-testid="yasher-koach"
    >
      <div className="flex flex-col items-center">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          aria-label={t("title")}
          onClick={togglePanel}
          className={cn(
            "relative flex h-28 w-28 shrink-0 flex-col items-center justify-center gap-[5px] rounded-full border border-[#C8AE73] bg-[#FFFBef] px-2.5 pb-2.5 pt-[13px] text-navy shadow-[0_4px_12px_#47391b0a]",
            "transition-colors hover:border-[#AE8A41] hover:bg-[#FFF8E4] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-navy"
          )}
        >
          <span className="pointer-events-none absolute inset-[5px] rounded-full border border-[#E9DDBE]" aria-hidden="true" />
          <Award className="h-[19px] w-[19px] shrink-0 text-[#AF8C43]" strokeWidth={1.4} aria-hidden="true" />
          <span
            className={cn("max-w-[88px] text-center font-heading font-medium tracking-normal", isRtl ? "text-[21px] leading-[26px]" : "text-[18px] leading-[18px]")}
            dir={isRtl ? "rtl" : "ltr"}
          >
            {t("title")}
          </span>
          <span
            className={cn(
              "flex h-[13px] shrink-0 items-center justify-center text-[#AB8841]",
              isOpen && "rotate-180"
            )}
            aria-hidden="true"
          >
            <ChevronDown className="h-[13px] w-[13px]" strokeWidth={1.6} />
          </span>
        </button>

        {isOpen && (
          <div className="w-full">
          <div className="mx-auto h-[13px] w-px bg-[#C8AE73]" aria-hidden="true" />
          <div
            id={panelId}
            className="w-full rounded-lg border border-[#DFCFAC] bg-[#FFFDF8] px-[15px] pt-[5px] shadow-[0_6px_16px_#47391b08]"
            dir={isRtl ? "rtl" : "ltr"}
          >
            {visibleMatmidim.length === 0 ? (
              <p role="status" className="py-5 text-center text-xs leading-relaxed text-muted">
                {t(loadState === "loading" ? "loading" : loadState === "error" ? "unavailable" : "empty")}
              </p>
            ) : (
            <ol aria-label={t("title")} className={cn(showAll && "max-h-72 overflow-y-auto [scrollbar-gutter:stable]")}>
              {visibleMatmidim.map((m, i) => (
                <li
                  key={`${m.name}-${i}`}
                  className="grid min-h-[39px] grid-cols-[13px_minmax(0,1fr)_max-content] items-center gap-2 border-b border-[#EEE7DA] py-2.5 last:border-b-0"
                >
                  <span
                    className="text-[10px] leading-[1.4] text-[#938A77] tabular-nums"
                  >
                    {fmtNum(i + 1, locale)}
                  </span>
                  <span className={cn("break-words text-xs leading-[1.6] text-navy [overflow-wrap:anywhere]", i === 0 && "font-medium")}>
                    {m.name}
                  </span>
                  <span className="text-end font-heading text-lg font-medium leading-[1.2] text-[#987735] tabular-nums">
                    {fmtNum(m.count, locale)}
                  </span>
                </li>
              ))}
            </ol>
            )}
            {canToggleAll && (
              <div className="border-t border-[#E7DCC7]">
                <button
                  type="button"
                  onClick={() => {
                    if (showAll) {
                      setShowAll(false);
                      return;
                    }
                    void loadAllMatmidim();
                  }}
                  disabled={loadingAll}
                  className="flex min-h-11 w-full items-center justify-center gap-[7px] py-[11px] text-[11px] leading-[1.4] text-[#80642E] transition-colors hover:text-navy focus-visible:outline-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loadingAll && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                  {showAll ? t("showTop") : t("showAll")}
                  {!loadingAll && <ArrowRight className={cn("h-3 w-3 shrink-0", isRtl && "rotate-180")} aria-hidden="true" />}
                </button>
              </div>
            )}
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
