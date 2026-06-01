import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const snap = await getAdminDb()
      .collection("lzecher_project_photos")
      .doc(id)
      .get();

    if (!snap.exists) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    const data = snap.data() || {};
    const contentType = typeof data.contentType === "string" ? data.contentType : "image/jpeg";
    const base64 = typeof data.data === "string" ? data.data : "";
    const bytes = Buffer.from(base64, "base64");
    if (bytes.length === 0) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=300, s-maxage=86400",
      },
    });
  } catch (err) {
    console.error("[projects/photo-image]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
