"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { YahrzeitCandle } from "@/components/brand/YahrzeitCandle";
import { Search } from "lucide-react";
import { motion } from "framer-motion";
import type { MemorialProject } from "@/lib/types";

interface HomeClientProps {
  memorials?: MemorialProject[];
}

export function HomeClient({ memorials = [] }: HomeClientProps) {
  const t = useTranslations("landing");
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((m, i) => {
                const pct =
                  m.totalPortions > 0
                    ? Math.round(
                        (m.completedPortions / m.totalPortions) * 100
                      )
                    : 0;
                const honorific =
                  (m as MemorialProject & { honorific?: string }).honorific ||
                  (m.gender === "female" ? "\u05E2\u05F4\u05D4" : "\u05D6\u05F4\u05DC");
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                  >
                    <Link href={`/memorial/${m.slug}` as "/memorial/[slug]"}>
                      <div className="rounded-2xl border border-navy/5 bg-white p-6 hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer text-center">
                        <div className="flex justify-center mb-4">
                          <YahrzeitCandle size="sm" />
                        </div>
                        <p className="text-xs text-gold font-medium mb-1">
                          {honorific}
                        </p>
                        <h3
                          className="font-heading text-lg font-bold text-navy mb-1"
                          dir="rtl"
                        >
                          {`${m.nameHebrew} ${m.familyNameHebrew || ""}`.trim()}
                        </h3>
                        {(m.nameEnglish || m.familyNameEnglish) && (
                          <p className="font-serif italic text-muted text-sm mb-3">
                            {`${m.nameEnglish || ""} ${m.familyNameEnglish || ""}`.trim()}
                          </p>
                        )}
                        <div className="flex flex-wrap justify-center gap-1 mb-3">
                          {m.tracks.map((track) => (
                            <span
                              key={track}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-gold/10 text-gold-deep font-medium"
                            >
                              {track === "mishnayos"
                                ? "\u05DE\u05E9\u05E0\u05D9\u05D5\u05EA"
                                : track === "tehillim"
                                  ? "\u05EA\u05D4\u05D9\u05DC\u05D9\u05DD"
                                  : track === "shnayim_mikra"
                                    ? "\u05E9\u05E0\u05D9\u05D9\u05DD \u05DE\u05E7\u05E8\u05D0"
                                    : track === "kabalos"
                                      ? "\u05E7\u05D1\u05DC\u05D5\u05EA"
                                      : track === "daf_yomi"
                                        ? "\u05D3\u05E3 \u05D9\u05D5\u05DE\u05D9"
                                        : "\u05E7\u05D1\u05DC\u05D5\u05EA"}
                            </span>
                          ))}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-muted">
                            <span>
                              {m.claimedPortions}/{m.totalPortions}
                            </span>
                            <span>{pct}%</span>
                          </div>
                          <Progress value={pct} className="h-1.5" />
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
