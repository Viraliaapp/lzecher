import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BookOpen, Flame, Heart, Music, ScrollText } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";

const SECTIONS = [
  { key: "mishnayos", icon: BookOpen, color: "bg-moed/10 text-moed", featured: false },
  { key: "tehillim", icon: Music, color: "bg-kodashim/10 text-kodashim", featured: false },
  { key: "kaddish", icon: Flame, color: "bg-gold/10 text-gold", featured: true },
  { key: "shnayimMikra", icon: ScrollText, color: "bg-zeraim/10 text-zeraim", featured: false },
  { key: "kabalos", icon: Heart, color: "bg-nashim/10 text-nashim", featured: false },
] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "halachicGuidance" });
  return {
    title: `${t("title")} · Lzecher`,
    description: t("subtitle"),
    alternates: { canonical: `https://lzecher.com/${locale}/halachic-guidance` },
  };
}

export default function HalachicGuidancePage() {
  const t = useTranslations("halachicGuidance");
  const richText = {
    strong: (chunks: ReactNode) => <strong className="font-semibold text-navy">{chunks}</strong>,
    source: (chunks: ReactNode) => <span className="font-semibold text-navy">{chunks}</span>,
  };

  return (
    <>
      <Navbar />
      <main className="bg-cream">
        {/* Hero */}
        <div className="bg-navy text-cream py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-gold/10 mb-5">
              <BookOpen className="h-7 w-7 text-gold" />
            </div>
            <h1 className="font-heading text-4xl sm:text-5xl font-bold mb-4">
              {t("title")}
            </h1>
            <p className="text-cream/70 text-lg font-serif italic">
              {t("subtitle")}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16">
          <p className="text-muted leading-relaxed mb-10 text-lg">
            {t.rich("intro", richText)}
          </p>

          {/* Gold divider */}
          <div className="flex items-center gap-4 mb-10">
            <div className="h-px flex-1 bg-gold/20" />
            <span className="text-gold text-lg">&#x2727;</span>
            <div className="h-px flex-1 bg-gold/20" />
          </div>

          <div className="space-y-8">
            {SECTIONS.map(({ key, icon: Icon, color, featured }) => (
              <div
                key={key}
                className={`rounded-xl border bg-white p-6 sm:p-8 ${
                  featured
                    ? "relative overflow-hidden border-gold/40 bg-gradient-to-b from-white to-gold/5"
                    : "border-navy/5"
                }`}
              >
                {featured && <div className="absolute inset-y-0 end-0 w-1 bg-gold" aria-hidden="true" />}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="font-heading text-xl font-semibold text-navy">
                    {t(`${key}_title`)}
                  </h2>
                </div>
                <p className="text-muted leading-relaxed">
                  {key === "kaddish" ? t.rich("kaddish_content", richText) : t(`${key}_content`)}
                </p>
                {key === "kaddish" && (
                  <>
                    <span className="mt-4 inline-flex rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
                      {t("kaddish_sourceTag")}
                    </span>
                    <div className="mt-5 rounded-xl border border-gold/20 bg-gold/5 p-4 sm:p-5">
                      <h3 className="mb-2 font-heading text-base font-semibold text-navy">
                        {t("kaddish_quote_title")}
                      </h3>
                      <p className="text-muted leading-relaxed">
                        {t.rich("kaddish_quote_intro", richText)}
                      </p>
                      <p className="mt-3 text-muted leading-relaxed">
                        {t.rich("kaddish_quote_content", richText)}
                      </p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Communal learning section */}
          <div className="mt-8 rounded-xl border border-navy/5 bg-white p-6 sm:p-8">
            <h2 className="font-heading text-xl font-semibold text-navy mb-3">
              {t("general_title")}
            </h2>
            <p className="text-muted leading-relaxed">{t("general_content")}</p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
