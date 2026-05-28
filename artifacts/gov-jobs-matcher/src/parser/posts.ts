import type { RawCircular } from "../scrapers";

export interface ParsedPost {
  source: "dpsa" | "gazette";
  sourceUrl: string;
  referenceNo: string | null;
  post: string;
  department: string;
  salaryLevel: string | null;
  location: string;
  requirements: string;
  duties: string | null;
  closingDate: string | null;
  rawExcerpt: string;
}

export async function parseCircular(_raw: RawCircular): Promise<ParsedPost[]> {
  // TODO: pdf-parse (PDFs) or cheerio (HTML) to extract text, then call
  // Claude (claude-sonnet-4-6) to segment a multi-post circular into
  // individual ParsedPost rows. Free-form layouts make regex brittle, so
  // structuring via the model is the planned approach.
  return [];
}
