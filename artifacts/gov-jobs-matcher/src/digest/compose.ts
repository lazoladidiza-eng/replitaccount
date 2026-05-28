import type { ParsedPost } from "../parser/posts";
import type { MatchResult } from "../matcher/score";
import type { DigestEmail } from "../lib/email";

export interface DigestEntry {
  post: ParsedPost;
  match: MatchResult;
}

export function composeDigest(_to: string, _entries: DigestEntry[]): DigestEmail {
  // TODO: render an HTML+text digest. Group by score band (>=80, 60-79),
  // include closing date, department, top matched requirements + gaps,
  // and a "next steps" CTA per post.
  throw new Error("composeDigest not implemented yet");
}
