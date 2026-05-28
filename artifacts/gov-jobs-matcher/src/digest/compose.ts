import type { CvProfile, MatchResult, ParsedPost } from "../lib/schemas";
import type { DigestEmail } from "../lib/email";

export interface DigestEntry {
  post: ParsedPost;
  match: MatchResult;
}

export function composeDigest(
  _to: string,
  _cv: CvProfile,
  _entries: DigestEntry[],
): DigestEmail {
  // TODO (Phase 2): render an HTML+text email digest. Phase 1 surfaces
  // results via Markdown files written by digest/report.ts.
  throw new Error("composeDigest not implemented yet");
}
