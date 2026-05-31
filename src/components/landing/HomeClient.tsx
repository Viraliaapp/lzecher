"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { YahrzeitCandle } from "@/components/brand/YahrzeitCandle";
import { Search, Lock } from "lucide-react";
import { motion } from "framer-motion";
import type { MemorialProject, TrackType } from "@/lib/types";
import { progressFromProject, cyclesLabel } from "@/lib/progress";
import { GlobalCounter } from "@/components/activity/GlobalCounter";
import { ActivityBubbles } from "@/components/activity/ActivityBubbles";

interface HomeClientProps {
  memorials?: MemorialProject[];
}

const TRACK_LABELS: Record<TrackType, { he: string; en: string; es: string; fr: string }> = {
  mishnayos: { he: "משניות", en: "Mishnayos", es: "Mishnayot", fr: "Mishnayot" },
  tehillim: { he: "תהלים", en: "Tehillim", es: "Tehilim", fr: "Tehilim" },
  shnayim_mikra: { he: "שניים מקרא", en: "Shnayim Mikra", es: "Shnaim Mikra", fr: "Chnayim Mikra" },
  kabalos: { he: "קבלות טובות", en: "Kabalos", es: "Kabalot", fr: "Kabalot" },
  daf_yomi: { he: "דף יומי", en: "Daf Yomi", es: "Daf Yomi", fr: "Daf Yomi" },
};

function trackLabel(track: TrackType, locale: string): string {
  const map = TRACK_LABELS[track];
  return map?.[locale as keyof typeof map] ?? map?.en ?? track;
}

export function HomeClient({ memorials = [] }: HomeClientProps) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const [search, setSearch] = useState("");

  const filtered = memorials.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.nameHebrew.toLowerCase().includes(q) ||
      (m.familyNameHebrew?.toLowerCase().includes(q) ?? false) ||
      (m.nameEnglish?.toLowerCase().includes(q) ?? false) ||
      (m.familyNameEnglish?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <main>
      {/* ── SLIM HERO ── */}
      <section className="relative bg-navy overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(201,169,97,0.4) 1px, transparent 0)`,
              backgroundSize: "40px 40px",
            }}
          />
        </div>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 py-10 sm:py-14 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex justify-center mb-4">
              <YahrzeitCandle size="sm" />
            </div>

            <p className="font-serif italic text-gold text-sm tracking-wide mb-2">
              {t("heroEyebrow")}
            </p>

            <h1 className="font-heading text-3xl sm:text-4xl font-bold text-cream mb-1">
              {t("heroLine1")}
            </h1>
            <h2 className="font-serif italic text-gold text-2xl sm:text-3xl mb-3">
              {t("heroLine2")}
            </h2>

            <p className="text-cream/60 text-sm sm:text-base mb-6">
              {t("heroDescription")}
            </p>

            <Link href="/create">
              <Button size="lg">{t("createMemorial")}</Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── GLOBAL LIVE COUNTER ── */}
      <GlobalCounter />

      {/* ── LIVE ACTIVITY BUBBLES ── */}
      <ActivityBubbles />

      {/* ── MEMORIALS DIRECTORY ── */}
      <section className="bg-cream py-8 sm:py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {/* Search */}
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Memorial cards grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="flex justify-center mb-6">
                <YahrzeitCandle size="md" />
              </div>
              <p className="text-muted leading-relaxed max-w-md mx-auto mb-6">
                {search ? t("noResults") : t("memorialsEmpty")}
              </p>
              {!search && (
                <Link href="/create">
                  <Button>{t("createMemorial")}</Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
              {filtered.map((m, i) => {
                // Canonical progress — same definition as the inside memorial hero.
                // Reads denormalized fields written by recomputeProjectProgress().
                const byTrack = (m as MemorialProject & { claimedByTrack?: Record<string, number> }).claimedByTrack || {};
                const prog = progressFromProject(m);
                const pct = prog.pct;
                const cyclesText = cyclesLabel(prog.cycles, locale);
                const honorific =
                  (m as MemorialProject & { honorific?: string }).honorific ||
                  (m.gender === "female" ? "ע״ה" : "ז״ל");
                const hebrewName = `${m.nameHebrew} ${m.familyNameHebrew || ""}`.trim();
                const hebrewDate = (m as MemorialProject & { dateOfPassingHebrew?: string }).dateOfPassingHebrew;

                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                    className="w-full max-w-[340px]"
                  >
                    <Link href={`/memorial/${m.slug}` as "/memorial/[slug]"}>
                      <div
                        className="rounded-[18px] overflow-hidden cursor-pointer group"
                        style={{
                          boxShadow: "0 4px 20px rgba(15,27,45,0.10)",
                          transition: "transform 0.2s ease, box-shadow 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
                          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 40px rgba(15,27,45,0.18)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(15,27,45,0.10)";
                        }}
                      >
                        {/* 1 — Dark hero band */}
                        <div
                          style={{
                            background: "linear-gradient(165deg, #1B2138 0%, #252C48 60%, #2d2a3a 100%)",
                            padding: "20px 16px 16px",
                            textAlign: "center",
                            position: "relative",
                            overflow: "hidden",
                          }}
                        >
                          {/* Soft gold radial glow */}
                          <div
                            style={{
                              position: "absolute",
                              top: "-60px", left: "50%", transform: "translateX(-50%)",
                              width: "280px", height: "180px",
                              background: "radial-gradient(ellipse, rgba(201,162,75,0.20) 0%, transparent 70%)",
                              pointerEvents: "none",
                            }}
                          />
                          {/* Lock badge for password-protected memorials */}
                          {(m as MemorialProject & { isPasswordProtected?: boolean }).isPasswordProtected && (
                            <div className="absolute top-2 right-2 z-20" title={t("protectedBadge")}>
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full" style={{ background: "rgba(201,162,75,0.18)" }}>
                                <Lock className="h-3 w-3" style={{ color: "rgba(201,162,75,0.9)" }} />
                              </span>
                            </div>
                          )}
                          {/* Mini candle */}
                          <div className="flex justify-center mb-2 relative z-10">
                            <YahrzeitCandle size="sm" />
                          </div>
                          {/* Eyebrow */}
                          <p
                            className="font-serif italic relative z-10"
                            style={{ color: "rgba(201,162,75,0.78)", fontSize: "11px", letterSpacing: "0.12em" }}
                          >
                            — לעילוי נשמת —
                          </p>
                          {/* Name */}
                          <h3
                            className="font-heading relative z-10"
                            style={{ fontWeight: 900, fontSize: "21px", color: "#FAF6EC", marginTop: "4px", direction: "rtl" }}
                          >
                            {`${hebrewName} ${honorific}`}
                          </h3>
                          {/* English name accent */}
                          {(m.nameEnglish || m.familyNameEnglish) && (
                            <p className="font-serif italic relative z-10" style={{ color: "rgba(201,162,75,0.50)", fontSize: "12px", marginTop: "2px" }}>
                              {`${m.nameEnglish || ""} ${m.familyNameEnglish || ""}`.trim()}
                            </p>
                          )}
                          {/* Date */}
                          {hebrewDate && (
                            <p className="relative z-10" style={{ color: "rgba(250,246,236,0.38)", fontSize: "12px", marginTop: "3px" }} dir="rtl">
                              {hebrewDate}
                            </p>
                          )}
                        </div>

                        {/* 2 — Gold-pale stat band */}
                        <div
                          style={{ background: "#F2E8CC", padding: "14px 16px 12px", textAlign: "center" }}
                        >
                          <p
                            className="font-heading"
                            style={{ fontWeight: 900, fontSize: "30px", color: "#C9A961", lineHeight: 1 }}
                          >
                            {pct}%
                          </p>
                          <p style={{ fontSize: "11px", color: "#8B7355", marginTop: "3px", marginBottom: cyclesText ? "4px" : "8px" }}>
                            {t("takenLabel")}
                          </p>
                          {cyclesText && (
                            <p style={{ fontSize: "10px", fontWeight: 700, color: "#5B7A52", marginBottom: "8px" }} dir={locale === "he" ? "rtl" : "ltr"}>
                              {cyclesText}
                            </p>
                          )}
                          {/* Thin progress bar */}
                          <div
                            style={{ height: "5px", borderRadius: "3px", background: "rgba(15,27,45,0.08)", overflow: "hidden" }}
                          >
                            <div
                              style={{ height: "100%", width: `${pct}%`, background: "#C9A961", borderRadius: "3px", transition: "width 0.6s ease" }}
                            />
                          </div>
                        </div>

                        {/* 3 — Per-track stat line */}
                        <div
                          style={{ background: "#FAF6EC", padding: "9px 12px", minHeight: "36px", textAlign: "center" }}
                        >
                          {(() => {
                            const parts: string[] = [];
                            const mC = byTrack.mishnayos || 0;
                            const tC = byTrack.tehillim || 0;
                            const kC = byTrack.kabalos || 0;
                            if (mC > 0) parts.push(`${mC} ${locale === "he" ? "משניות" : "Mishnayos"}`);
                            if (tC > 0) parts.push(`${tC} ${locale === "he" ? "תהלים" : "Tehillim"}`);
                            if (kC > 0) parts.push(`${kC} ${locale === "he" ? "קבלות טובות" : "Kabalos"}`);
                            if ((m.participantCount || 0) > 0) parts.push(`${m.participantCount} ${locale === "he" ? "משתתפים" : "participants"}`);
                            if (parts.length === 0) {
                              m.tracks.forEach(track => parts.push(trackLabel(track, locale)));
                            }
                            return (
                              <p style={{ fontSize: "10px", color: "#6B5323", lineHeight: 1.6 }}>
                                {parts.join(" · ")}
                              </p>
                            );
                          })()}
                        </div>

                        {/* 4 — Navy CTA band */}
                        <div
                          style={{
                            background: "#0F1B2D",
                            padding: "11px 16px",
                            textAlign: "center",
                          }}
                        >
                          <p
                            className="font-heading"
                            style={{ fontWeight: 700, fontSize: "13px", color: "#FAF6EC", letterSpacing: "0.02em" }}
                          >
                            {t("cardCta")}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
