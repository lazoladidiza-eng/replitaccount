import { extractJson } from "../lib/claude";
import { extractText } from "../lib/extract";
import {
  ParsedPostsResponseSchema,
  type ParsedPost,
} from "../lib/schemas";

export interface CircularInput {
  filename: string;
  bytes: Buffer;
}

export interface ParsedCircular {
  filename: string;
  posts: ParsedPost[];
}

const POSTS_SYSTEM = `You extract individual job posts from South African Public Service Vacancy Circulars (DPSA Z83 format).
A single circular contains many posts grouped by department. For each post, return a JSON object matching this schema:
{
  "referenceNo": string | null,
  "post": string,                 // job title
  "department": string,           // e.g. "Department of Health"
  "salaryLevel": number | null,   // DPSA salary level 1-16
  "salaryRange": string | null,   // verbatim salary string if shown
  "location": string,             // province/city/centre
  "requirements": string,         // verbatim minimum requirements paragraph
  "duties": string | null,        // verbatim duties paragraph if present
  "closingDate": string | null,   // ISO date if you can determine it
  "minQualification": "matric" | "certificate" | "diploma" | "degree" | "honours" | "masters" | "phd" | "unknown",
  "minYearsExperience": number | null
}

Return ONLY a JSON object of the form: { "posts": [ ... ] }
Do not invent posts. Skip pages that are only headers, indexes, or instructions for the Z83 application form.`;

export async function parseCircular(input: CircularInput): Promise<ParsedCircular> {
  const text = await extractText(input.filename, input.bytes);
  if (!text.trim()) {
    return { filename: input.filename, posts: [] };
  }

  const truncated = text.length > 180_000 ? text.slice(0, 180_000) : text;

  const { posts } = await extractJson({
    system: POSTS_SYSTEM,
    user: `CIRCULAR TEXT (${input.filename}):\n\n${truncated}`,
    schema: ParsedPostsResponseSchema,
    maxTokens: 8192,
  });

  return { filename: input.filename, posts };
}
