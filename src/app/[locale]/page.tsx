import { getTranslations } from "next-intl/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HomeClient } from "@/components/landing/HomeClient";
import { getAdminDb } from "@/lib/firebase/admin";
import type { MemorialProject } from "@/lib/types";
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

async function getPublicMemorials(): Promise<MemorialProject[]> {
  try {
    const db = getAdminDb();
    // Simple query avoiding composite index requirement
    const snap = await db
      .collection("lzecher_projects")
      .where("status", "==", "active")
      .limit(200)
      .get();
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as MemorialProject))
      .filter((p) => p.isPublic)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const memorials = await getPublicMemorials();

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
      <HomeClient memorials={memorials} />
      <Footer />
    </>
  );
}
