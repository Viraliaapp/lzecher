import { getAdminDb } from "@/lib/firebase/admin";
import { notFound } from "next/navigation";
import { MemorialPageClient } from "@/components/memorial/MemorialPageClient";
import type { MemorialProject, Portion } from "@/lib/types";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const adminDb = getAdminDb();
  const snap = await adminDb
    .collection("lzecher_projects")
    .where("slug", "==", slug)
    .limit(1)
    .get();

  if (snap.empty) return { title: "Memorial · Lzecher" };

  const project = snap.docs[0].data() as MemorialProject;
  const title = `${project.nameEnglish} · Lzecher`;
  const description = `Honor the memory of ${project.nameHebrew} (${project.nameEnglish}) through communal Torah learning. Claim a portion of Mishnayos, Tehillim, or Mitzvot l'iluy nishmas.`;

  return {
    title,
    description,
    alternates: { canonical: `https://lzecher.com/${locale}/memorial/${slug}` },
    openGraph: {
      title,
      description,
      url: `https://lzecher.com/${locale}/memorial/${slug}`,
      type: "article",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function MemorialPage({ params }: Props) {
  const { slug } = await params;
  const adminDb = getAdminDb();

  const snap = await adminDb
    .collection("lzecher_projects")
    .where("slug", "==", slug)
    .where("status", "in", ["active", "completed"])
    .limit(1)
    .get();

  if (snap.empty) notFound();

  const projectDoc = snap.docs[0];
  const project = { id: projectDoc.id, ...projectDoc.data() } as MemorialProject;

  const portionsSnap = await adminDb
    .collection("lzecher_portions")
    .where("projectId", "==", project.id)
    .orderBy("order")
    .get();

  const portions = portionsSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as Portion)
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${project.nameEnglish} - Memorial Page`,
    description: `Torah learning dedicated l'iluy nishmas ${project.nameHebrew}`,
    url: `https://lzecher.com/en/memorial/${project.slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MemorialPageClient project={project} portions={portions} />
    </>
  );
}
