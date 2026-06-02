import tehillimData from "@/data/tehillim-he.json";

export interface TehillimChapter {
  chapter: number;
  ref: string;
  titleHe: string;
  verses: string[];
  verseCount: number;
}

export interface TehillimTextSource {
  provider: string;
  api: string;
  work: string;
  hebrewVersionTitle: string;
  license: string;
  sourceUrl: string;
  generatedAt: string;
  normalization: string;
}

interface TehillimPayload {
  source: TehillimTextSource;
  chapters: TehillimChapter[];
}

const payload = tehillimData as TehillimPayload;

export const TEHILLIM_TEXT_SOURCE = payload.source;

export function getTehillimChapter(chapter: number): TehillimChapter | null {
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 150) return null;
  return payload.chapters.find((item) => item.chapter === chapter) ?? null;
}
