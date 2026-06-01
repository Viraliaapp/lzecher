/**
 * POST /api/memorials/[slug]/access  { password }
 *
 * Server-side password gate for protected memorial projects. Verifies the password
 * against the scrypt hash stored on the project doc, rate-limits attempts per
 * project+IP, and on success sets a signed httpOnly cookie remembering access on
 * this device (180 days). The cookie — not the password — is what the SSR memorial
 * page checks. The hash/salt are never sent to the client.
 *
 * Scope: lzecher_projects only.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyPassword, isProtected } from "@/lib/password";
import { signToken, TTL } from "@/lib/signed-tokens";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const accessCookieName = (projectId: string) => `lz_access_${projectId}`;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { password } = await request.json();

    const db = getAdminDb();
    const snap = await db
      .collection("lzecher_projects")
      .where("slug", "==", slug)
      .limit(1)
      .get();
    if (snap.empty) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const doc = snap.docs[0];
    const project = doc.data();
    const projectId = doc.id;

    // Not protected → nothing to verify (defensive; client shouldn't call this)
    if (!isProtected(project as { passwordHash?: string | null })) {
      return NextResponse.json({ success: true, alreadyOpen: true });
    }

    // Rate limit per project + IP to prevent brute force
    const ip = getClientIp(request);
    const rl = await checkRateLimit("passwordAttemptPerProjectIp", `${projectId}:${ip}`);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a few minutes and try again." },
        { status: 429 }
      );
    }

    if (typeof password !== "string" || !password.trim()) {
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }

    const ok = verifyPassword(password.trim(), project.passwordHash, project.passwordSalt);
    if (!ok) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    // Issue a signed device token scoped to THIS project, set as httpOnly cookie.
    const token = signToken({ purpose: "project_access", projectId }, TTL.PROJECT_ACCESS);
    const res = NextResponse.json({ success: true });
    res.cookies.set(accessCookieName(projectId), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(TTL.PROJECT_ACCESS / 1000),
    });
    return res;
  } catch (err) {
    console.error("[memorial-access] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
