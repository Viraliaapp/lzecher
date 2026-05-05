import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const scope = searchParams.get("scope");
    const scopeId = searchParams.get("scopeId");

    if (!projectId || !scope) {
      return NextResponse.json({ error: "Missing projectId or scope" }, { status: 400 });
    }

    const db = getAdminDb();
    let query = db.collection("lzecher_portions").where("projectId", "==", projectId);

    if (scope === "shas") {
      query = query.where("trackType", "==", "mishnayos");
    } else if (scope === "seder") {
      query = query.where("trackType", "==", "mishnayos").where("seder", "==", scopeId);
    } else if (scope === "masechta") {
      query = query.where("trackType", "==", "mishnayos").where("masechet", "==", scopeId);
    } else if (scope === "whole_tehillim") {
      query = query.where("trackType", "==", "tehillim");
    } else if (scope === "tehillim_book") {
      query = query.where("trackType", "==", "tehillim");
    } else {
      return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
    }

    const snap = await query.get();
    let docs = snap.docs;

    // Filter tehillim by book if needed
    if (scope === "tehillim_book" && scopeId) {
      const ranges: Record<string, [number, number]> = {
        "1": [1, 41], "2": [42, 72], "3": [73, 89], "4": [90, 106], "5": [107, 150]
      };
      const r = ranges[scopeId];
      if (r) docs = docs.filter(d => { const m = d.data().mizmor || 0; return m >= r[0] && m <= r[1]; });
    }

    const total = docs.length;
    const available = docs.filter(d => d.data().status === "available").length;
    const taken = total - available;
    const takenBy = [...new Set(
      docs.filter(d => d.data().status !== "available" && d.data().claimedByName)
        .map(d => d.data().claimedByName)
    )].slice(0, 5);

    return NextResponse.json({ total, available, taken, takenBy });
  } catch (err) {
    console.error("Preview bulk error:", err);
    return NextResponse.json({ error: "Failed to preview" }, { status: 500 });
  }
}
