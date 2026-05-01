import { getTranslations } from "next-intl/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MemorialsClient } from "@/components/memorial/MemorialsClient";
import type { MemorialProject } from "@/lib/types";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "memorials" });
  return {
    title: `${t("title")} · Lzecher`,
    description: t("subtitle"),
    alternates: { canonical: `https://lzecher.com/${locale}/memorials` },
  };
}

async function getPublicMemorials(): Promise<MemorialProject[]> {
  try {
    const db = getAdminDb();
    const snap = await db
      .collection("lzecher_projects")
      .where("status", "==", "active")
      .get();
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as MemorialProject))
      .filter((p) => p.isPublic)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch {
    return [];
  }
}

export default async function MemorialsPage() {
  const memorials = await getPublicMemorials();

  return (
    <>
      <Navbar />
      <MemorialsClient memorials={memorials} />
      <Footer />
    </>
  );
}
