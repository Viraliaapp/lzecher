import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/auth-roles";

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();
    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    await requireAdmin(idToken, "projects");

    const db = getAdminDb();
    const snap = await db
      .collection("lzecher_projects")
      .orderBy("createdAt", "desc")
      .get();

    const projects = snap.docs.map((doc) => {
      const data = doc.data();
      const { passwordHash, passwordSalt, ...safe } = data;
      void passwordSalt;
      return {
        id: doc.id,
        ...safe,
        isPasswordProtected: Boolean(passwordHash),
      };
    });

    return NextResponse.json({ projects });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.startsWith("FORBIDDEN:")) {
      return NextResponse.json({ error: message.replace("FORBIDDEN:", "") }, { status: 403 });
    }
    console.error("[admin/projects/list]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
