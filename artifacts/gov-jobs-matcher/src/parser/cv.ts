import { extractJson } from "../lib/claude";
import { extractText } from "../lib/extract";
import { CvProfileSchema, type CvProfile } from "../lib/schemas";

export interface CvUpload {
  filename: string;
  mimeType?: string;
  bytes: Buffer;
}

const CV_SYSTEM = `You extract structured profiles from CVs of South African candidates targeting public-service roles.
Return JSON only matching this shape (no prose):
{
  "fullName": string | null,
  "highestQualification": "matric" | "certificate" | "diploma" | "degree" | "honours" | "masters" | "phd" | "unknown",
  "qualifications": string[],   // each qualification as written, e.g. "BCom Accounting (UCT, 2018)"
  "yearsExperience": number | null,  // total professional years; null if unclear
  "skills": string[],           // concise skill phrases
  "sectors": string[],          // industries / departments worked in
  "summary": string             // 2-3 sentence positioning statement
}
Be conservative: if a field is genuinely unclear, return null or an empty array rather than guessing.`;

export async function parseCv(upload: CvUpload): Promise<CvProfile> {
  const raw = await extractText(upload.filename, upload.bytes);
  if (!raw.trim()) {
    throw new Error(
      `No text extracted from ${upload.filename}. The file may be a scanned image without an OCR layer.`,
    );
  }

  return extractJson({
    system: CV_SYSTEM,
    user: `CV TEXT (${upload.filename}):\n\n${raw}`,
    schema: CvProfileSchema,
    maxTokens: 2048,
  });
}
