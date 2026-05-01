"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { YahrzeitCandle } from "@/components/brand/YahrzeitCandle";
import { Search } from "lucide-react";
import type { MemorialProject } from "@/lib/types";

interface Props {
  memorials: MemorialProject[];
}

export function MemorialsClient({ memorials }: Props) {
  const t = useTranslations("memorials");
  const [search, setSearch] = useState("");

  const filtered = memorials.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.nameHebrew.toLowerCase().includes(q) ||
      (m.nameEnglish?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <main className="bg-cream min-h-screen">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-navy mb-2">
            {t("title")}
          </h1>
          <p className="text-muted">
            {t("subtitle", { count: memorials.length })}
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-md mx-auto mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="flex justify-center mb-6">
              <YahrzeitCandle size="md" />
            </div>
            <p className="text-muted leading-relaxed max-w-md mx-auto mb-6">
              {search ? t("noResults") : t("emptyState")}
            </p>
            {!search && (
              <Link href="/create">
                <Button>{t("createFirst")}</Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((m) => {
              const pct = m.totalPortions > 0 ? Math.round((m.completedPortions / m.totalPortions) * 100) : 0;
              const honorific = (m as MemorialProject & { honorific?: string }).honorific ||
                (m.gender === "female" ? "ע״ה" : "ז״ל");
              return (
                <Link key={m.id} href={`/memorial/${m.slug}` as "/memorial/[slug]"}>
                  <div className="rounded-2xl border border-navy/5 bg-white p-6 hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer text-center">
                    <div className="flex justify-center mb-4">
                      <YahrzeitCandle size="sm" />
                    </div>
                    <p className="text-xs text-gold font-medium mb-1">{honorific}</p>
                    <h3 className="font-heading text-lg font-bold text-navy mb-1" dir="rtl">
                      {m.nameHebrew}
                    </h3>
                    {m.nameEnglish && (
                      <p className="font-serif italic text-muted text-sm mb-3">{m.nameEnglish}</p>
                    )}
                    <div className="flex flex-wrap justify-center gap-1 mb-3">
                      {m.tracks.map((track) => (
                        <span key={track} className="text-[10px] px-2 py-0.5 rounded-full bg-gold/10 text-gold-deep font-medium">
                          {track === "mishnayos" ? "משניות" : track === "tehillim" ? "תהילים" : track === "shnayim_mikra" ? "שניים מקרא" : track === "mussar" ? "מוסר" : "מצוות"}
                        </span>
                      ))}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span>{m.claimedPortions}/{m.totalPortions}</span>
                        <span>{pct}%</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
