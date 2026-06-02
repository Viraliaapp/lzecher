import type { MetadataRoute } from "next";
import { getAdminDb } from "@/lib/firebase/admin";

const BASE_URL = "https://lzecher.com";
const LOCALES = ["en", "he", "es", "fr"];

const STATIC_ROUTES = [
  { path: "", changeFrequency: "weekly" as const, priority: 1.0 },
  { path: "/about", changeFrequency: "monthly" as const, priority: 0.7 },
  { path: "/halachic-guidance", changeFrequency: "monthly" as const, priority: 0.6 },
  { path: "/privacy", changeFrequency: "monthly" as const, priority: 0.3 },
  { path: "/terms", changeFrequency: "monthly" as const, priority: 0.3 },
  { path: "/contact", changeFrequency: "monthly" as const, priority: 0.4 },
  { path: "/login", changeFrequency: "monthly" as const, priority: 0.5 },
  { path: "/create", changeFrequency: "monthly" as const, priority: 0.6 },
];

function languageAlternates(path: string) {
  return {
    he: `${BASE_URL}/he${path}`,
    en: `${BASE_URL}/en${path}`,
    es: `${BASE_URL}/es${path}`,
    fr: `${BASE_URL}/fr${path}`,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // Static routes for all locales
  for (const route of STATIC_ROUTES) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${BASE_URL}/${locale}${route.path}`,
        lastModified: new Date(),
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates: { languages: languageAlternates(route.path) },
      });
    }
  }

  // Dynamic memorial pages from Firestore
  try {
    const db = getAdminDb();
    const snap = await db
      .collection("lzecher_projects")
      .where("status", "==", "active")
      .get();

    for (const doc of snap.docs) {
      const data = doc.data();
      // Do not list password-protected projects' detail in the sitemap.
      if (data.passwordHash) continue;
      for (const locale of LOCALES) {
        entries.push({
          url: `${BASE_URL}/${locale}/memorial/${data.slug}`,
          lastModified: data.updatedAt ? new Date(data.updatedAt) : new Date(),
          changeFrequency: "weekly",
          priority: 0.8,
          alternates: { languages: languageAlternates(`/memorial/${data.slug}`) },
        });
      }
    }
  } catch {
    // Firestore may not be available during build
  }

  return entries;
}
