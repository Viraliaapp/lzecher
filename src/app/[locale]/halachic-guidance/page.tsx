import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BookOpen, Music, ScrollText, Heart } from "lucide-react";
import type { Metadata } from "next";

const SECTIONS = [
  { key: "mishnayos", icon: BookOpen, color: "bg-moed/10 text-moed" },
  { key: "tehillim", icon: Music, color: "bg-kodashim/10 text-kodashim" },
  { key: "shnayimMikra", icon: ScrollText, color: "bg-zeraim/10 text-zeraim" },
  { key: "kabalos", icon: Heart, color: "bg-nashim/10 text-nashim" },
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
          <p className="text-muted leading-relaxed mb-10 text-lg">{t("intro")}</p>

          {/* Gold divider */}
          <div className="flex items-center gap-4 mb-10">
            <div className="h-px flex-1 bg-gold/20" />
            <span className="text-gold text-lg">&#x2727;</span>
            <div className="h-px flex-1 bg-gold/20" />
          </div>

          <div className="space-y-8">
            {SECTIONS.map(({ key, icon: Icon, color }) => (
              <div key={key} className="rounded-xl border border-navy/5 bg-white p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="font-heading text-xl font-semibold text-navy">
                    {t(`${key}_title`)}
                  </h2>
                </div>
                <p className="text-muted leading-relaxed">{t(`${key}_content`)}</p>
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

          {/* Disclaimer */}
          <div className="mt-10 rounded-xl bg-cream-warm border border-gold/10 p-6 sm:p-8 text-center">
            <p className="text-navy/70 text-sm leading-relaxed font-serif italic">
              {t("disclaimer")}
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
