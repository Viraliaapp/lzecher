"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { YahrzeitCandle } from "@/components/brand/YahrzeitCandle";
import { motion } from "framer-motion";

export function HomeClient() {
  const t = useTranslations("landing");

  return (
    <main>
      {/* ── HERO ── */}
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

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 py-20 sm:py-28 lg:py-36 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Candle */}
            <div className="flex justify-center mb-8">
              <YahrzeitCandle size="lg" />
            </div>

            {/* Eyebrow */}
            <p className="font-serif italic text-gold text-base sm:text-lg tracking-wide mb-4">
              {t("heroEyebrow")}
            </p>

            {/* Heading */}
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-cream leading-[1.15] mb-3">
              {t("heroLine1")}
            </h1>
            <h1 className="font-serif italic text-gold text-3xl sm:text-4xl lg:text-5xl mb-4">
              {t("heroLine2")}
            </h1>

            {/* Hebrew sub */}
            <p className="font-heading text-navy-soft text-lg sm:text-xl mb-6" dir="rtl">
              {t("heroHebrew")}
            </p>

            {/* Description */}
            <p className="text-cream/60 text-base sm:text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
              {t("heroDescription")}
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/create">
                <Button size="xl">{t("createMemorial")}</Button>
              </Link>
              <Link href="/about">
                <Button
                  variant="outline"
                  size="xl"
                  className="border-cream/20 text-cream hover:bg-cream/10"
                >
                  {t("viewMemorials")}
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-cream to-transparent" />
      </section>

      {/* ── HEBREW DIVIDER ── */}
      <div className="bg-cream py-8">
        <div className="flex items-center justify-center gap-4 max-w-md mx-auto px-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/30" />
          <span className="font-heading text-gold/70 text-sm whitespace-nowrap" dir="rtl">
            · זכר צדיק לברכה ·
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/30" />
        </div>
      </div>

      {/* ── PULL QUOTE ── */}
      <section className="bg-cream py-8 sm:py-12">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <blockquote className="font-serif italic text-charcoal/60 text-lg sm:text-xl leading-relaxed">
            &ldquo;{t("pullQuote")}&rdquo;
          </blockquote>
          <p className="mt-3 text-sm text-muted font-serif italic">{t("pullQuoteSource")}</p>
        </div>
      </section>

      {/* ── MEMORIAL CARDS (empty state for now) ── */}
      <section className="bg-cream py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="font-serif italic text-gold text-base mb-2">
              {t("memorialsEyebrow")}
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-navy">
              {t("memorialsTitle")}{" "}
              <span className="font-serif italic text-gold">{t("memorialsAccent")}</span>
            </h2>
          </div>

          {/* Empty state */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="rounded-2xl border border-gold/10 bg-white p-12 text-center max-w-lg mx-auto"
          >
            <div className="flex justify-center mb-6">
              <YahrzeitCandle size="sm" />
            </div>
            <p className="text-muted leading-relaxed mb-6">
              {t("memorialsEmpty")}
            </p>
            <Link href="/create">
              <Button>{t("createMemorial")}</Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="bg-navy py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center mb-16">
            <p className="font-serif italic text-gold text-base mb-2">
              {t("howEyebrow")}
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-cream">
              {t("howTitle")}{" "}
              <span className="font-serif italic text-gold">{t("howAccent")}</span>
            </h2>
          </div>

          <div className="space-y-12 max-w-2xl mx-auto">
            {(["create", "share", "siyum"] as const).map((step, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="flex items-start gap-6"
              >
                <div className="flex items-center gap-3 shrink-0">
                  <div className="h-px w-8 bg-gold/30" />
                  <span className="font-serif italic text-gold text-lg">
                    {["i", "ii", "iii"][i]}.
                  </span>
                  <div className="h-px w-8 bg-gold/30" />
                </div>
                <div>
                  <h3 className="font-heading text-lg font-semibold text-cream mb-1">
                    {t(`how_${step}_title`)}
                  </h3>
                  <p className="text-cream/50 text-sm leading-relaxed">
                    {t(`how_${step}_desc`)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="bg-cream py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            <div>
              <p className="font-serif italic text-gold text-4xl sm:text-5xl mb-2">4,192</p>
              <p className="text-sm text-muted">{t("statMishnayos")}</p>
            </div>
            <div>
              <p className="font-heading text-navy text-4xl sm:text-5xl font-bold mb-2">63</p>
              <p className="text-sm text-muted">{t("statMasechtot")}</p>
            </div>
            <div>
              <p className="font-serif italic text-gold text-4xl sm:text-5xl mb-2">&infin;</p>
              <p className="text-sm text-muted">{t("statFree")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="bg-navy py-20 sm:py-28 overflow-hidden relative">
        <div className="absolute inset-0 opacity-[0.04]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(201,169,97,0.5) 1px, transparent 0)`,
              backgroundSize: "32px 32px",
            }}
          />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 sm:px-6 text-center">
          <div className="flex justify-center mb-6">
            <YahrzeitCandle size="sm" />
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-cream mb-2">
            {t("ctaLine1")}{" "}
            <span className="font-serif italic text-gold">{t("ctaAccent")}</span>
          </h2>
          <p className="font-serif italic text-cream/50 text-lg mb-10">
            {t("ctaSubtitle")}
          </p>
          <Link href="/create">
            <Button size="xl">{t("createMemorial")}</Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
