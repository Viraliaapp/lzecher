import { NextResponse } from "next/server";
import { getTehillimChapter, TEHILLIM_TEXT_SOURCE } from "@/lib/tehillim-text";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chapter: string }> }
) {
  const { chapter: rawChapter } = await params;
  const chapter = Number(rawChapter);
  const data = getTehillimChapter(chapter);

  if (!data) {
    return NextResponse.json({ error: "Invalid Tehillim chapter" }, { status: 404 });
  }

  return NextResponse.json(
    {
      ...data,
      source: {
        provider: TEHILLIM_TEXT_SOURCE.provider,
        work: TEHILLIM_TEXT_SOURCE.work,
        hebrewVersionTitle: TEHILLIM_TEXT_SOURCE.hebrewVersionTitle,
        license: TEHILLIM_TEXT_SOURCE.license,
      },
    },
    { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } }
  );
}
