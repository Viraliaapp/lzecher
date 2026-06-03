"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { YahrzeitCandle } from "@/components/brand/YahrzeitCandle";
import { Check, Grid2X2, List, Search, Lock } from "lucide-react";
import { motion } from "framer-motion";
import type { MemorialProject, TrackType } from "@/lib/types";
import { progressFromProject, cyclesLabel } from "@/lib/progress";
import { GlobalCounter, SiteViewsCounter } from "@/components/activity/GlobalCounter";
import { ActivityBubbles } from "@/components/activity/ActivityBubbles";

interface HomeClientProps {
  memorials?: MemorialProject[];
}

const TRACK_LABELS: Record<TrackType, { he: string; en: string; es: string; fr: string }> = {
  mishnayos: { he: "משניות", en: "Mishnayos", es: "Mishnayot", fr: "Mishnayot" },
  tehillim: { he: "תהילים", en: "Tehillim", es: "Tehilim", fr: "Tehilim" },
  shnayim_mikra: { he: "שניים מקרא", en: "Shnayim Mikra", es: "Shnaim Mikra", fr: "Chnayim Mikra" },
  kabalos: { he: "קבלות טובות", en: "Kabalos", es: "Kabalot", fr: "Kabalot" },
  daf_yomi: { he: "דף יומי", en: "Daf Yomi", es: "Daf Yomi", fr: "Daf Yomi" },
};

function trackLabel(track: TrackType, locale: string): string {
  const map = TRACK_LABELS[track];
  return map?.[locale as keyof typeof map] ?? map?.en ?? track;
}

function FamilyDedication() {
  const names = [
    'ר\' רפאל הכהן בן ר\' יצחק ז"ל',
    'מרת ריבה רבקה בת ר\' חיים ע"ה',
    'ר\' יצחק בן ר\' ניסים ז"ל',
    'מרת רות בת ר\' ליאו אליעזר ע"ה',
    'מרת עירית בת ר\' יצחק ע"ה',
    "וכל זקנינו וקרובינו",
  ];
  const dedicationLine = names.join(" • ");

  return (
    <section className="border-b border-gold/15 bg-white px-4 pb-3 pt-0 sm:px-6" dir="rtl" aria-label={`לעילוי נשמת ${dedicationLine}`}>
      <div
        className="mx-auto flex max-w-3xl items-center justify-center gap-2 overflow-hidden text-center text-[11.5px] leading-5 text-muted sm:text-xs"
        title={`לעילוי נשמת ${dedicationLine} ת.נ.צ.ב.ה`}
      >
        <div className="relative h-6 w-3.5 shrink-0 drop-shadow-[0_5px_10px_rgba(201,166,91,0.22)]" aria-hidden="true">
          <span className="absolute left-1/2 top-0 h-3 w-2 -translate-x-1/2 rounded-[50%] bg-[radial-gradient(circle_at_50%_62%,#fff7bf_0_20%,#e9c66a_45%,#b98a35_70%,transparent_73%)] shadow-[0_0_10px_rgba(218,176,82,0.42)]" />
          <span className="absolute left-1/2 top-3 h-1.5 w-px -translate-x-1/2 rounded-full bg-[#6e5531]" />
          <span className="absolute bottom-0 left-1/2 h-4 w-2.5 -translate-x-1/2 rounded-sm border border-gold/20 bg-gradient-to-b from-[#fff9e7] to-[#f5ead0]" />
        </div>
        <span className="shrink-0 font-heading font-bold text-gold-deep">{"לע\"נ"}</span>
        <span className="min-w-0 truncate text-navy/62">{dedicationLine}</span>
        <span className="shrink-0 font-heading text-[10px] font-bold tracking-[0.12em] text-gold-deep sm:text-[11px]">ת.נ.צ.ב.ה</span>
      </div>
    </section>
  );
}

export function HomeClient({ memorials = [] }: HomeClientProps) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const showEnglishNames = locale === "en";
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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

      {/* ── FAMILY DEDICATION ── */}
      <FamilyDedication />

      {/* ── LIVE ACTIVITY BUBBLES ── */}
      <ActivityBubbles />

      {/* ── MEMORIALS DIRECTORY ── */}
      <section className="bg-cream py-8 sm:py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {/* Search */}
          <div className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="inline-flex rounded-full border border-navy/10 bg-white p-1 shadow-sm" role="group" aria-label={locale === "he" ? "בחירת תצוגה" : "Choose view"}>
              {[
                { key: "grid" as const, icon: Grid2X2, label: locale === "he" ? "תצוגת כרטיסים" : "Grid view" },
                { key: "list" as const, icon: List, label: locale === "he" ? "תצוגת רשימה" : "List view" },
              ].map((option) => {
                const Icon = option.icon;
                const active = viewMode === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setViewMode(option.key)}
                    className={`relative grid h-9 w-11 place-items-center rounded-full transition ${active ? "bg-gold text-navy shadow-sm" : "text-navy/65 hover:bg-cream"}`}
                    title={option.label}
                    aria-label={option.label}
                    aria-pressed={active}
                  >
                    <Icon className="h-4 w-4" />
                    {active && <Check className="absolute -bottom-0.5 -end-0.5 h-3.5 w-3.5 rounded-full bg-white p-0.5 text-navy shadow-sm" />}
                  </button>
                );
              })}
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
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                    className="h-full w-full"
                  >
                    <Link href={`/memorial/${m.slug}` as "/memorial/[slug]"} className="block h-full">
                      <div
                        className="group flex h-full min-h-[390px] cursor-pointer flex-col overflow-hidden rounded-[18px]"
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
                            minHeight: "178px",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
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
                            style={{ fontWeight: 900, fontSize: "21px", color: "#FAF6EC", marginTop: "4px", direction: "rtl", overflowWrap: "break-word" }}
                          >
                            {`${hebrewName} ${honorific}`}
                          </h3>
                          {/* English name accent */}
                          {showEnglishNames && (m.nameEnglish || m.familyNameEnglish) && (
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
                          style={{ background: "#F2E8CC", padding: "14px 16px 12px", textAlign: "center", minHeight: "104px" }}
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
                              style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: "#C9A961", borderRadius: "3px", transition: "width 0.6s ease" }}
                            />
                          </div>
                        </div>

                        {/* 3 — Per-track stat line */}
                        <div
                          style={{ background: "#FAF6EC", padding: "9px 12px", minHeight: "48px", textAlign: "center", display: "grid", placeItems: "center" }}
                        >
                          {(() => {
                            const parts: string[] = [];
                            const mC = byTrack.mishnayos || 0;
                            const tC = byTrack.tehillim || 0;
                            const kC = byTrack.kabalos || 0;
                            if (mC > 0) parts.push(`${mC} ${locale === "he" ? "משניות" : "Mishnayos"}`);
                            if (tC > 0) parts.push(`${tC} ${locale === "he" ? "תהילים" : "Tehillim"}`);
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
                            marginTop: "auto",
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
          ) : (
            <div className="space-y-3">
              {filtered.map((m, i) => {
                const prog = progressFromProject(m);
                const pct = prog.pct;
                const cyclesText = cyclesLabel(prog.cycles, locale);
                const honorific =
                  (m as MemorialProject & { honorific?: string }).honorific ||
                  (m.gender === "female" ? "ע״ה" : "ז״ל");
                const hebrewName = `${m.nameHebrew} ${m.familyNameHebrew || ""}`.trim();
                const hebrewDate = (m as MemorialProject & { dateOfPassingHebrew?: string }).dateOfPassingHebrew;
                const isProtected = (m as MemorialProject & { isPasswordProtected?: boolean }).isPasswordProtected;

                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, delay: i * 0.03 }}
                  >
                    <Link href={`/memorial/${m.slug}` as "/memorial/[slug]"} className="block">
                      <div className="rounded-xl border border-navy/10 bg-white p-3 shadow-sm transition hover:border-gold/35 hover:shadow-md sm:p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-navy">
                              <YahrzeitCandle size="sm" className="scale-75" />
                            </div>
                            <div className="min-w-0 text-start">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-heading text-lg font-bold text-navy" dir="rtl">
                                  {`${hebrewName} ${honorific}`}
                                </h3>
                                {isProtected && (
                                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gold/10 text-gold-deep" title={t("protectedBadge")}>
                                    <Lock className="h-3.5 w-3.5" />
                                  </span>
                                )}
                              </div>
                              {hebrewDate && <p className="text-xs text-muted" dir="rtl">{hebrewDate}</p>}
                              {showEnglishNames && (m.nameEnglish || m.familyNameEnglish) && (
                                <p className="truncate font-serif text-sm italic text-muted">
                                  {`${m.nameEnglish || ""} ${m.familyNameEnglish || ""}`.trim()}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="min-w-[160px] sm:w-56">
                            <div className="mb-1 flex items-center justify-between text-xs text-muted">
                              <span>{t("takenLabel")}</span>
                              <span className="font-heading text-lg font-bold text-gold-deep">{pct}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-navy/10">
                              <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted">
                              <span>{(m.participantCount || 0).toLocaleString()} {locale === "he" ? "משתתפים" : "participants"}</span>
                              {cyclesText && <span className="font-medium text-green-700">{cyclesText}</span>}
                            </div>
                          </div>
                          <div className="shrink-0 rounded-lg bg-navy px-4 py-2 text-center font-heading text-sm font-bold text-cream">
                            {t("cardCta")}
                          </div>
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
      <SiteViewsCounter />
    </main>
  );
}
