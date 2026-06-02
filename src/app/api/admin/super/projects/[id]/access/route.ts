import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireSuperAdmin } from "@/lib/auth-roles";
import { accessCookieName } from "@/lib/project-access";
import { signToken, TTL } from "@/lib/signed-tokens";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { idToken, locale = "he" } = await request.json();
    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await requireSuperAdmin(idToken);
    const db = getAdminDb();
    const projectSnap = await db.collection("lzecher_projects").doc(id).get();
    if (!projectSnap.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const project = projectSnap.data() || {};
    const slug = typeof project.slug === "string" ? project.slug : "";
    if (!slug) {
      return NextResponse.json({ error: "Project has no public slug" }, { status: 400 });
    }

    const safeLocale = ["en", "he", "es", "fr"].includes(locale) ? locale : "he";
    const url = `/${safeLocale}/memorial/${slug}`;
    const res = NextResponse.json({
      success: true,
      url,
      passwordProtected: Boolean(project.passwordHash),
    });

    if (project.passwordHash) {
      const token = signToken({ purpose: "project_access", projectId: id }, TTL.PROJECT_ACCESS);
      res.cookies.set(accessCookieName(id), token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: Math.floor(TTL.PROJECT_ACCESS / 1000),
      });
    }

    await db.collection("lzecher_admin_audit").add({
      action: "super_admin_project_access",
      adminUid: decoded.uid,
      adminEmail: decoded.email || null,
      projectId: id,
      projectSlug: slug,
      passwordProtected: Boolean(project.passwordHash),
      at: Date.now(),
      details: {
        reason: "Super admin opened project page for safety review",
      },
    });

    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.startsWith("FORBIDDEN:")) {
      return NextResponse.json({ error: message.replace("FORBIDDEN:", "") }, { status: 403 });
    }
    console.error("[admin/super/projects/access]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
