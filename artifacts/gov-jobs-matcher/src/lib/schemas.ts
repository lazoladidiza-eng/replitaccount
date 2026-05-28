import { z } from "zod/v4";

export const QualificationLevel = z.enum([
  "matric",
  "certificate",
  "diploma",
  "degree",
  "honours",
  "masters",
  "phd",
  "unknown",
]);
export type QualificationLevel = z.infer<typeof QualificationLevel>;

export const CvProfileSchema = z.object({
  fullName: z.string().nullable(),
  highestQualification: QualificationLevel,
  qualifications: z.array(z.string()),
  yearsExperience: z.number().min(0).max(60).nullable(),
  skills: z.array(z.string()),
  sectors: z.array(z.string()),
  summary: z.string(),
});
export type CvProfile = z.infer<typeof CvProfileSchema>;

export const ParsedPostSchema = z.object({
  referenceNo: z.string().nullable(),
  post: z.string(),
  department: z.string(),
  salaryLevel: z.number().int().min(1).max(16).nullable(),
  salaryRange: z.string().nullable(),
  location: z.string(),
  requirements: z.string(),
  duties: z.string().nullable(),
  closingDate: z.string().nullable(),
  minQualification: QualificationLevel,
  minYearsExperience: z.number().min(0).max(40).nullable(),
});
export type ParsedPost = z.infer<typeof ParsedPostSchema>;

export const ParsedPostsResponseSchema = z.object({
  posts: z.array(ParsedPostSchema),
});

export const MatchResultSchema = z.object({
  score: z.number().min(0).max(100),
  matchedRequirements: z.array(z.string()),
  gaps: z.array(z.string()),
  recommendedActions: z.array(z.string()),
  rationale: z.string(),
});
export type MatchResult = z.infer<typeof MatchResultSchema>;
