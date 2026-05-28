import type { ParsedPost } from "../parser/posts";
import type { CvProfile } from "../parser/cv";

export interface MatchResult {
  score: number;
  matchedRequirements: string[];
  gaps: string[];
  recommendedActions: string[];
  rationale: string;
}

export async function scoreMatch(
  _post: ParsedPost,
  _cv: CvProfile,
): Promise<MatchResult> {
  // TODO: Claude (claude-sonnet-4-6) prompt comparing post.requirements
  // against cv.{qualifications, skills, yearsExperience, sectors}.
  // Returns a 0-100 score plus structured gap/action analysis.
  throw new Error("scoreMatch not implemented yet");
}
