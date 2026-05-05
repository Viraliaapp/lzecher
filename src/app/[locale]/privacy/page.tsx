import { useTranslations } from "next-intl";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const SECTIONS = [
  "collection",
  "use",
  "sharing",
  "retention",
  "security",
  "rights",
  "contact",
] as const;

export default function PrivacyPage() {
  const t = useTranslations("privacy");

  return (
    <>
      <Navbar />
      <main className="bg-cream">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-navy mb-2">
            {t("title")}
          </h1>
          <p className="text-sm text-muted mb-8">{t("lastUpdated")}</p>

          <p className="text-muted leading-relaxed mb-8">{t("intro")}</p>

          <div className="space-y-6">
            {SECTIONS.map((section) => (
              <div key={section}>
                <h2 className="font-heading text-xl font-semibold text-navy mb-2">
                  {t(`${section}_title`)}
                </h2>
                <p className="text-muted leading-relaxed">
                  {t(`${section}_content`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
