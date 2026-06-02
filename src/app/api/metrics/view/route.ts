import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";

const LOCALES = new Set(["en", "he", "es", "fr"]);

function dayKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

function cleanPath(value: unknown) {
  if (typeof value !== "string") return "/";
  const path = value.split("?")[0].split("#")[0].trim();
  if (!path.startsWith("/")) return "/";
  return path.slice(0, 240);
}

function cleanLocale(value: unknown) {
  return typeof value === "string" && LOCALES.has(value) ? value : "en";
}

function routeKey(path: string) {
  if (/^\/(?:en|he|es|fr)\/?$/.test(path)) return "home";
  if (path.includes("/memorial/")) return "memorial";
  if (path.includes("/memorials")) return "memorials";
  if (path.includes("/create")) return "create";
  if (path.includes("/halachic-guidance")) return "halachic_guidance";
  if (path.includes("/contact")) return "contact";
  if (path.includes("/login")) return "login";
  return "other";
}

function slugFromPath(path: string) {
  const match = path.match(/^\/(?:en|he|es|fr)\/memorial\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const now = Date.now();
    const locale = cleanLocale(body.locale);
    const path = cleanPath(body.path);
    const route = routeKey(path);
    const day = dayKey(now);
    const db = getAdminDb();

    let projectId: string | null = null;
    let projectSlug: string | null = null;
    let projectName: string | null = null;
    const slug = slugFromPath(path);
    if (slug) {
      const projectSnap = await db
        .collection("lzecher_projects")
        .where("slug", "==", slug)
        .limit(1)
        .get();
      if (!projectSnap.empty) {
        const doc = projectSnap.docs[0];
        const data = doc.data();
        projectId = doc.id;
        projectSlug = slug;
        projectName = [data.nameHebrew, data.familyNameHebrew].filter(Boolean).join(" ").trim() || slug;
      }
    }

    const updates: Record<string, unknown> = {
      scope: "site",
      dayKey: day,
      updatedAt: now,
      total: FieldValue.increment(1),
      [`byLocale.${locale}`]: FieldValue.increment(1),
      [`byRoute.${route}`]: FieldValue.increment(1),
    };

    if (projectId) {
      updates[`projectViews.${projectId}`] = FieldValue.increment(1);
      updates[`projectSlugs.${projectId}`] = projectSlug;
      updates[`projectNames.${projectId}`] = projectName;
    }

    await db.collection("lzecher_view_stats").doc(`site_${day}`).set(updates, { merge: true });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[metrics/view]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
