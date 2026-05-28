import type { CvProfile, MatchResult, ParsedPost } from "../lib/schemas";

export interface ScoredPost {
  post: ParsedPost;
  match: MatchResult;
  sourceFile: string;
}

export interface CvReport {
  cvFilename: string;
  cv: CvProfile;
  topMatches: ScoredPost[];
  totalCandidates: number;
  filteredOut: number;
}

export function renderCvReport(report: CvReport): string {
  const lines: string[] = [];
  lines.push(`# Top matches for ${report.cv.fullName ?? report.cvFilename}`);
  lines.push("");
  lines.push(`_Source CV:_ \`${report.cvFilename}\``);
  lines.push(
    `_Highest qualification:_ ${report.cv.highestQualification} | ` +
      `_Experience:_ ${report.cv.yearsExperience ?? "?"}y | ` +
      `_Scored ${report.topMatches.length} of ${report.totalCandidates} posts (${report.filteredOut} prefiltered)_`,
  );
  lines.push("");
  lines.push(`> ${report.cv.summary}`);
  lines.push("");

  if (report.topMatches.length === 0) {
    lines.push("_No matches surfaced. Either no posts cleared the prefilter, or no posts were provided._");
    return lines.join("\n");
  }

  report.topMatches.forEach((entry, idx) => {
    const { post, match } = entry;
    lines.push(`## ${idx + 1}. ${post.post} — score ${match.score}`);
    lines.push("");
    lines.push(
      `**${post.department}** | Salary level ${post.salaryLevel ?? "?"} | ` +
        `${post.location} | Closes ${post.closingDate ?? "?"} | Ref ${post.referenceNo ?? "?"}`,
    );
    lines.push(`_Source:_ \`${entry.sourceFile}\``);
    lines.push("");
    lines.push(`**Why this scored ${match.score}:** ${match.rationale}`);
    lines.push("");
    if (match.matchedRequirements.length) {
      lines.push("**Matched requirements:**");
      for (const m of match.matchedRequirements) lines.push(`- ${m}`);
      lines.push("");
    }
    if (match.gaps.length) {
      lines.push("**Gaps:**");
      for (const g of match.gaps) lines.push(`- ${g}`);
      lines.push("");
    }
    if (match.recommendedActions.length) {
      lines.push("**Recommended actions:**");
      for (const a of match.recommendedActions) lines.push(`- ${a}`);
      lines.push("");
    }
  });

  return lines.join("\n");
}
