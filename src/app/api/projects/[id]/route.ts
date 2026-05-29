import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyToken } from "@/lib/auth-roles";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { idToken } = body;
    if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let decoded: Awaited<ReturnType<typeof verifyToken>>;
    try {
      decoded = await verifyToken(idToken);
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    const uid = decoded.uid;
    const isAdmin = decoded.isAdmin || decoded.isSuperAdmin;

    const db = getAdminDb();
    const snap = await db.collection("lzecher_projects").doc(id).get();
    if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data = snap.data()!;
    const isOwner = data.createdBy === uid;
    if (!isOwner && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Never ship the password hash/salt to the client — only whether one is set.
    const { passwordHash, passwordSalt, ...safe } = data;
    void passwordHash; void passwordSalt;
    return NextResponse.json({ ...safe, id: snap.id, isPasswordProtected: Boolean(passwordHash) });
  } catch (err) {
    console.error("[projects/:id GET] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
