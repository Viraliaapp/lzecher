import { useTranslations } from "next-intl";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Heart, Globe } from "lucide-react";

export default function AboutPage() {
  const t = useTranslations("about");

  return (
    <>
      <Navbar />
      <main className="bg-cream">
        <div className="bg-navy text-cream py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
            <h1 className="font-heading text-4xl sm:text-5xl font-bold mb-4">
              {t("title")}
            </h1>
            <p className="text-cream/70 text-lg font-serif italic">
              {t("subtitle")}
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16">
          <div className="space-y-8">
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10">
                  <Heart className="h-5 w-5 text-gold-deep" />
                </div>
                <h2 className="font-heading text-2xl font-bold text-navy">Our Mission</h2>
              </div>
              <p className="text-muted leading-relaxed">{t("mission")}</p>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10">
                  <Globe className="h-5 w-5 text-gold-deep" />
                </div>
                <h2 className="font-heading text-2xl font-bold text-navy">Our Vision</h2>
              </div>
              <p className="text-muted leading-relaxed">{t("vision")}</p>
            </section>

            <section>
              <p className="text-muted leading-relaxed">{t("howItHelps")}</p>
            </section>

            <section>
              <p className="text-muted leading-relaxed">{t("community")}</p>
            </section>

            <section className="rounded-xl bg-cream-glow border border-gold/10 p-6 text-center">
              <p className="text-navy font-serif italic leading-relaxed">{t("dedication")}</p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
