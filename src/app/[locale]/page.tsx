import { getTranslations } from "next-intl/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HomeClient } from "@/components/landing/HomeClient";
import { getAdminDb } from "@/lib/firebase/admin";
import type { MemorialProject } from "@/lib/types";
import type { Metadata } from "next";

const BASE_URL = "https://lzecher.com";

function localizedAlternates(locale: string, path = "") {
  const normalized = path ? `/${path.replace(/^\/+/, "")}` : "";
  return {
    canonical: `${BASE_URL}/${locale}${normalized}`,
    languages: {
      he: `${BASE_URL}/he${normalized}`,
      en: `${BASE_URL}/en${normalized}`,
      es: `${BASE_URL}/es${normalized}`,
      fr: `${BASE_URL}/fr${normalized}`,
      "x-default": `${BASE_URL}/he${normalized}`,
    },
  };
}

function homeMeta(locale: string, description: string) {
  if (locale === "he") {
    return {
      title: "לזכר · לימוד תורה לעילוי נשמה",
      description: "יצירת דפי הנצחה ללימוד משניות, תהילים, שניים מקרא וקבלות טובות לעילוי נשמת יקיריכם.",
    };
  }
  return {
    title: "Lzecher · Memorial Learning Platform",
    description,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing" });
  const meta = homeMeta(locale, t("heroDescription"));
  return {
    title: meta.title,
    description: meta.description,
    alternates: localizedAlternates(locale),
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `${BASE_URL}/${locale}`,
      type: "website",
      locale: locale === "he" ? "he_IL" : locale,
    },
    twitter: { card: "summary_large_image", title: meta.title, description: meta.description },
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
    // All active projects are now VISIBLE in the directory (card-level info only).
    // Password protection (if any) gates opening the full memorial, not the card.
    // IMPORTANT: project only card-safe fields to the client — never ship the password
    // hash/salt or full tribute/bio detail to the browser from the directory.
    return snap.docs
      .map((d) => {
        const p = d.data();
        const card: MemorialProject = {
          id: d.id,
          slug: p.slug,
          nameHebrew: p.nameHebrew,
          familyNameHebrew: p.familyNameHebrew,
          nameEnglish: p.nameEnglish,
          familyNameEnglish: p.familyNameEnglish,
          gender: p.gender,
          honorific: p.honorific,
          tracks: p.tracks || [],
          status: p.status,
          createdAt: p.createdAt,
          // card stats
          totalPortions: p.totalPortions || 0,
          claimedPortions: p.claimedPortions || 0,
          completedPortions: p.completedPortions || 0,
          participantCount: p.participantCount || 0,
          totalSets: p.totalSets,
          claimedByTrack: p.claimedByTrack,
          progressPct: p.progressPct,
          completedProgressPct: p.completedProgressPct,
          completedCycles: p.completedCycles,
          isPasswordProtected: Boolean(p.passwordHash),
          // carried-through display-only extras (Hebrew date)
          ...(p.dateOfPassingHebrew ? { dateOfPassingHebrew: p.dateOfPassingHebrew } : {}),
        } as MemorialProject;
        return card;
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const memorials = await getPublicMemorials();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Lzecher",
        url: BASE_URL,
        description:
          "A free multilingual memorial learning platform for organizing communal Torah study l'iluy nishmas.",
        sameAs: [],
      },
      {
        "@type": "WebSite",
        name: "Lzecher",
        alternateName: "לזכר",
        url: BASE_URL,
        inLanguage: ["he", "en", "es", "fr"],
      },
    ],
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
