import { extractJson } from "../lib/claude";
import {
  MatchResultSchema,
  type CvProfile,
  type MatchResult,
  type ParsedPost,
} from "../lib/schemas";

const SCORE_SYSTEM = `You score a single South African public-service job post against a candidate's CV profile.
Return JSON only matching this shape (no prose):
{
  "score": number,                    // 0-100 fit score
  "matchedRequirements": string[],    // concrete CV evidence that satisfies each met requirement
  "gaps": string[],                   // requirements the CV does not clearly satisfy
  "recommendedActions": string[],     // concrete next steps to close gaps or strengthen application
  "rationale": string                 // 2-3 sentence justification of the score
}

Scoring guidance:
- 90-100: clear over-match, candidate exceeds requirements
- 75-89: strong fit, all minimums met, most preferred met
- 60-74: meets minimums, some preferred missing
- 40-59: partial fit, notable gaps
- below 40: poor fit, do not recommend applying`;

export async function scoreMatch(
  post: ParsedPost,
  cv: CvProfile,
): Promise<MatchResult> {
  const user = `JOB POST:
Title: ${post.post}
Department: ${post.department}
Salary level: ${post.salaryLevel ?? "n/a"} (${post.salaryRange ?? "n/a"})
Location: ${post.location}
Reference: ${post.referenceNo ?? "n/a"}
Minimum qualification: ${post.minQualification}
Minimum experience: ${post.minYearsExperience ?? "n/a"} years
Requirements:
${post.requirements}
${post.duties ? `Duties:\n${post.duties}\n` : ""}

CANDIDATE PROFILE:
Name: ${cv.fullName ?? "(unspecified)"}
Highest qualification: ${cv.highestQualification}
All qualifications: ${cv.qualifications.join("; ") || "none listed"}
Years experience: ${cv.yearsExperience ?? "unspecified"}
Skills: ${cv.skills.join(", ") || "none listed"}
Sectors: ${cv.sectors.join(", ") || "none listed"}
Summary: ${cv.summary}

Score this fit.`;

  return extractJson({
    system: SCORE_SYSTEM,
    user,
    schema: MatchResultSchema,
    maxTokens: 1024,
  });
}
