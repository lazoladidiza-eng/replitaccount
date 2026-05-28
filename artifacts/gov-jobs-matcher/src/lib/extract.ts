import path from "node:path";
import pdf from "pdf-parse/lib/pdf-parse.js";
import mammoth from "mammoth";

export async function extractText(filename: string, bytes: Buffer): Promise<string> {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".pdf") {
    const result = await pdf(bytes);
    return result.text;
  }
  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ buffer: bytes });
    return result.value;
  }
  if (ext === ".txt" || ext === ".md") {
    return bytes.toString("utf8");
  }
  throw new Error(`Unsupported file type: ${ext} (${filename})`);
}
