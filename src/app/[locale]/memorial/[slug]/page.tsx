import { getAdminDb } from "@/lib/firebase/admin";
import { notFound } from "next/navigation";
import { MemorialPageClient } from "@/components/memorial/MemorialPageClient";
import type { MemorialProject, Portion } from "@/lib/types";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function MemorialPage({ params }: Props) {
  const { slug } = await params;
  const adminDb = getAdminDb();

  // Find project by slug
  const snap = await adminDb
    .collection("lzecher_projects")
    .where("slug", "==", slug)
    .where("status", "in", ["active", "completed"])
    .limit(1)
    .get();

  if (snap.empty) notFound();

  const projectDoc = snap.docs[0];
  const project = { id: projectDoc.id, ...projectDoc.data() } as MemorialProject;

  // Load portions
  const portionsSnap = await adminDb
    .collection("lzecher_portions")
    .where("projectId", "==", project.id)
    .orderBy("order")
    .get();

  const portions = portionsSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as Portion)
  );

  return <MemorialPageClient project={project} portions={portions} />;
}
