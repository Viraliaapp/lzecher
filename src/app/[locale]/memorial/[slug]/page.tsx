import { getAdminDb } from "@/lib/firebase/admin";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MemorialPageClient } from "@/components/memorial/MemorialPageClient";
import { PasswordGate } from "@/components/memorial/PasswordGate";
import { hasProjectAccess } from "@/lib/project-access";
import { isProtected } from "@/lib/password";
import { formatHebrewHonoreeName } from "@/lib/honoree-name";
import type { MemorialProject, Portion } from "@/lib/types";
import type { Metadata } from "next";

const BASE_URL = "https://lzecher.com";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

function localizedAlternates(locale: string, slug: string) {
  return {
    canonical: `${BASE_URL}/${locale}/memorial/${slug}`,
    languages: {
      he: `${BASE_URL}/he/memorial/${slug}`,
      en: `${BASE_URL}/en/memorial/${slug}`,
      es: `${BASE_URL}/es/memorial/${slug}`,
      fr: `${BASE_URL}/fr/memorial/${slug}`,
      "x-default": `${BASE_URL}/he/memorial/${slug}`,
    },
  };
}

async function getProjectBySlug(slug: string) {
  try {
    const adminDb = getAdminDb();
    const snap = await adminDb
      .collection("lzecher_projects")
      .where("slug", "==", slug)
      .limit(1)
      .get();
    if (snap.empty) return null;
    const data = snap.docs[0].data();
    return { id: snap.docs[0].id, ...data } as MemorialProject;
  } catch (err) {
    console.error("Memorial query failed:", err);
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) return { title: "Memorial · Lzecher" };

  const hebrewDisplay = formatHebrewHonoreeName(project, { includeParents: true });
  const hebrewDisplayWithHonorific = formatHebrewHonoreeName(project, { includeParents: true, includeHonorific: true });
  const englishDisplay = `${project.nameEnglish || project.nameHebrew} ${project.familyNameEnglish || ""}`.trim();
  const title = locale === "he"
    ? `${hebrewDisplayWithHonorific} · לזכר`
    : `${englishDisplay || hebrewDisplay} · Lzecher`;
  const description = locale === "he"
    ? `הצטרפו ללימוד תורה לעילוי נשמת ${hebrewDisplayWithHonorific}.`
    : `Honor the memory of ${project.nameHebrew}${project.nameEnglish ? ` (${project.nameEnglish})` : ""} through communal Torah learning.`;

  return {
    title,
    description,
    alternates: localizedAlternates(locale, slug),
    openGraph: { title, description, url: `${BASE_URL}/${locale}/memorial/${slug}`, type: "article", locale: locale === "he" ? "he_IL" : locale },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function MemorialPage({ params }: Props) {
  const { locale, slug } = await params;
  const project = await getProjectBySlug(slug);

  if (!project) {
    notFound();
  }

  // Only show active/completed/pending_moderation projects
  if (!["active", "completed", "pending_moderation"].includes(project.status)) {
    notFound();
  }

  // ── Password gate ──────────────────────────────────────────────────────────
  // Protected projects: do NOT fetch or ship full detail (portions/tribute) until
  // the device cookie proves the password was entered. Card-level info only.
  if (isProtected(project) && !(await hasProjectAccess(project.id))) {
    const hebrewName = formatHebrewHonoreeName(project, { includeParents: true });
    const englishName = `${project.nameEnglish || ""} ${project.familyNameEnglish || ""}`.trim();
    const hebrewDate = (project as MemorialProject & { dateOfPassingHebrew?: string }).dateOfPassingHebrew;
    return (
      <>
        <Navbar />
        <PasswordGate
          slug={project.slug}
          hebrewName={hebrewName}
          englishName={englishName || undefined}
          hebrewDate={hebrewDate}
        />
        <Footer />
      </>
    );
  }

  let portions: Portion[] = [];
  try {
    const adminDb = getAdminDb();
    // Avoid composite index requirement — sort in JS instead
    const portionsSnap = await adminDb
      .collection("lzecher_portions")
      .where("projectId", "==", project.id)
      .get();
    portions = portionsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Portion))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch (err) {
    console.error("Portions query failed:", err);
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${formatHebrewHonoreeName(project, { includeParents: true })} - ${locale === "he" ? "דף הנצחה" : "Memorial Page"}`,
    description: locale === "he"
      ? `לימוד תורה לעילוי נשמת ${formatHebrewHonoreeName(project, { includeParents: true, includeHonorific: true })}`
      : `Torah learning dedicated l'iluy nishmas ${formatHebrewHonoreeName(project, { includeParents: true })}`,
    url: `${BASE_URL}/${locale}/memorial/${project.slug}`,
    inLanguage: locale,
  };
  const { passwordHash, passwordSalt, ...safeProject } = project;
  void passwordHash;
  void passwordSalt;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />
      <MemorialPageClient
        project={{ ...safeProject, isPasswordProtected: isProtected(project) } as MemorialProject}
        portions={portions}
      />
      <Footer />
    </>
  );
}
