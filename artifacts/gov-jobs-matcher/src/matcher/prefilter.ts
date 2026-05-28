import type { CvProfile, ParsedPost, QualificationLevel } from "../lib/schemas";

const QUAL_RANK: Record<QualificationLevel, number> = {
  unknown: 0,
  matric: 1,
  certificate: 2,
  diploma: 3,
  degree: 4,
  honours: 5,
  masters: 6,
  phd: 7,
};

export interface PrefilterDecision {
  pass: boolean;
  reason?: string;
}

export function prefilter(post: ParsedPost, cv: CvProfile): PrefilterDecision {
  const cvRank = QUAL_RANK[cv.highestQualification];
  const postRank = QUAL_RANK[post.minQualification];

  if (postRank > 0 && cvRank > 0 && cvRank < postRank) {
    return {
      pass: false,
      reason: `requires ${post.minQualification} but CV tops out at ${cv.highestQualification}`,
    };
  }

  if (
    post.minYearsExperience !== null &&
    cv.yearsExperience !== null &&
    cv.yearsExperience + 1 < post.minYearsExperience
  ) {
    return {
      pass: false,
      reason: `requires ${post.minYearsExperience}y experience, CV has ${cv.yearsExperience}y`,
    };
  }

  return { pass: true };
}
