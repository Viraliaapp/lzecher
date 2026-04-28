import { useTranslations } from "next-intl";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BookOpen, Music, ScrollText, Heart } from "lucide-react";

const SECTIONS = [
  { key: "mishnayos", icon: BookOpen, color: "bg-moed/10 text-moed" },
  { key: "tehillim", icon: Music, color: "bg-kodashim/10 text-kodashim" },
  { key: "shnayimMikra", icon: ScrollText, color: "bg-zeraim/10 text-zeraim" },
  { key: "mitzvot", icon: Heart, color: "bg-nashim/10 text-nashim" },
] as const;

export default function HalachicGuidancePage() {
  const t = useTranslations("halachicGuidance");

  return (
    <>
      <Navbar />
      <main className="bg-cream">
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

        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16">
          <p className="text-muted leading-relaxed mb-10">{t("intro")}</p>

          <div className="space-y-8">
            {SECTIONS.map(({ key, icon: Icon, color }) => (
              <div key={key} className="rounded-xl border border-navy/5 bg-white p-6">
                <div className="flex items-center gap-3 mb-3">
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

          <div className="rounded-xl border border-navy/5 bg-white p-6">
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
