export interface CvProfile {
  fullName: string | null;
  qualifications: string[];
  yearsExperience: number | null;
  skills: string[];
  sectors: string[];
  summary: string;
  raw: string;
}

export interface CvUpload {
  filename: string;
  mimeType: string;
  bytes: Buffer;
}

export async function parseCv(_upload: CvUpload): Promise<CvProfile> {
  // TODO:
  //   - PDF: pdf-parse → text
  //   - DOCX: mammoth → text
  //   - text → Claude (claude-sonnet-4-6) → normalized CvProfile JSON
  throw new Error("parseCv not implemented yet");
}
