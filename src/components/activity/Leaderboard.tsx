"use client";

/**
 * "Yasher Koach" — a small recognition panel for top takers in THIS project.
 * Seeded from SSR (project.topMatmidim) and refreshed by polling every ~20s. Warm,
 * not gamified: a small candle marker, no trophies.
 */
import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { fmtNum } from "@/lib/activity-format";

interface Matmid {
  name: string;
  count: number;
}

const POLL_MS = 20000;

export function Leaderboard({ projectId, initial }: { projectId: string; initial?: Matmid[] }) {
  const t = useTranslations("leaderboard");
  const locale = useLocale();
  const [matmidim, setMatmidim] = useState<Matmid[]>(initial || []);

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

  if (!matmidim || matmidim.length === 0) return null;

  const isRtl = locale === "he";

  return (
    <div className="w-full max-w-[320px] px-4 sm:px-0 py-5" dir={isRtl ? "rtl" : "ltr"}>
      <div className="rounded-xl p-4" style={{ background: "#FFFDF8", border: "1px solid rgba(201,162,75,0.24)" }}>
        <div className="mb-3">
          <h3 className="font-heading font-bold text-navy text-base">{t("title")}</h3>
          <p className="text-xs text-muted mt-0.5">{t("subtitle")}</p>
        </div>
        <ol className="space-y-1">
          {matmidim.map((m, i) => (
            <li
              key={`${m.name}-${i}`}
              className="flex items-center justify-between rounded-lg px-2.5 py-1.5"
              style={{ background: i % 2 === 0 ? "rgba(201,162,75,0.06)" : "transparent" }}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span
                  className="inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold shrink-0"
                  style={{ background: "rgba(201,162,75,0.18)", color: "#8B6F2E" }}
                >
                  {fmtNum(i + 1, locale)}
                </span>
                <span className="font-serif text-navy truncate" style={{ fontFamily: "'Frank Ruhl Libre', Georgia, serif" }}>
                  {m.name}
                </span>
              </span>
              <span className="text-sm font-bold shrink-0" style={{ color: "#C9A961" }}>
                {fmtNum(m.count, locale)}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
