import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import crypto from "crypto";

const VALID_REASONS = [
  "inappropriate",
  "wrong_info",
  "hateful",
  "spam",
  "photo",
  "other",
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { reason, details, email } = body;

    if (!reason || !VALID_REASONS.includes(reason)) {
      return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
    }

    // Rate limit: 3 reports per IP per hour
    const ip = getClientIp(request);
    const rl = await checkRateLimit("claimCreateAnon", `report:${ip}:${slug}`);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many reports. Please try again later." },
        { status: 429 }
      );
    }

    const db = getAdminDb();

    // Find the project by slug
    const projSnap = await db
      .collection("lzecher_projects")
      .where("slug", "==", slug)
      .limit(1)
      .get();

    if (projSnap.empty) {
      return NextResponse.json({ error: "Memorial not found" }, { status: 404 });
    }

    const project = projSnap.docs[0];
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);

    // Create report
    const reportRef = db.collection("lzecher_reports").doc();
    await reportRef.set({
      id: reportRef.id,
      projectId: project.id,
      projectSlug: slug,
      reason,
      details: details?.slice(0, 500) || null,
      reporterEmail: email || null,
      reporterIpHash: ipHash,
      reportedAt: Date.now(),
      status: "open",
    });

    // Increment reports count on project
    await project.ref.update({
      reportsCount: (project.data().reportsCount || 0) + 1,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Report error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
