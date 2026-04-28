import { getTranslations } from "next-intl/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { TracksSection } from "@/components/landing/TracksSection";
import { CTASection } from "@/components/landing/CTASection";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing" });
  return {
    title: "Lzecher · Memorial Learning Platform",
    description: t("heroDescription"),
    alternates: { canonical: `https://lzecher.com/${locale}` },
    openGraph: {
      title: "Lzecher · Memorial Learning Platform",
      description: t("heroDescription"),
      url: `https://lzecher.com/${locale}`,
      type: "website",
    },
    twitter: { card: "summary_large_image" },
  };
}

export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Lzecher",
    url: "https://lzecher.com",
    description:
      "A free multilingual memorial learning platform for organizing communal Torah study l'iluy nishmas.",
    sameAs: [],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <TracksSection />
        <HowItWorksSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
