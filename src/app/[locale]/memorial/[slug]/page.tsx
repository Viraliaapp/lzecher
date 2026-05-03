import { getAdminDb } from "@/lib/firebase/admin";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MemorialPageClient } from "@/components/memorial/MemorialPageClient";
import type { MemorialProject, Portion } from "@/lib/types";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
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

  const displayName = project.nameEnglish || project.nameHebrew;
  const title = `${displayName} · Lzecher`;
  const description = `Honor the memory of ${project.nameHebrew}${project.nameEnglish ? ` (${project.nameEnglish})` : ""} through communal Torah learning.`;

  return {
    title,
    description,
    alternates: { canonical: `https://lzecher.com/${locale}/memorial/${slug}` },
    openGraph: { title, description, url: `https://lzecher.com/${locale}/memorial/${slug}`, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function MemorialPage({ params }: Props) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);

  if (!project) {
    notFound();
  }

  // Only show active/completed/pending_moderation projects
  if (!["active", "completed", "pending_moderation"].includes(project.status)) {
    notFound();
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
    name: `${project.nameEnglish || project.nameHebrew} - Memorial Page`,
    description: `Torah learning dedicated l'iluy nishmas ${project.nameHebrew}`,
    url: `https://lzecher.com/en/memorial/${project.slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />
      <MemorialPageClient project={project} portions={portions} />
      <Footer />
    </>
  );
}
